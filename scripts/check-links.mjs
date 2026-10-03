#!/usr/bin/env node
// Mechanical post-sync checks: internal links, Card hrefs, JSX placeholder
// hygiene and /docs-prefix regressions. Regex only, zero tokens.
//
// Usage: node scripts/check-links.mjs [--write-report <file>]
// Exit: 0 when clean, 1 with the failure list on stdout.

import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const DOCS = 'content/docs';
const REPORT = process.argv.includes('--write-report')
	? process.argv[process.argv.indexOf('--write-report') + 1]
	: null;

async function* walk(dir) {
	for (const entry of await readdir(dir, {withFileTypes: true})) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (entry.name.endsWith('.mdx')) yield full;
	}
}

/** Every *.mdx under content/docs, as a site URL. */
async function pageUrls() {
	const urls = new Set(['/']);
	for await (const file of walk(DOCS)) {
		const rel = path.relative(DOCS, file);
		const parts = rel.split(path.sep);
		const stem = parts.at(-1).slice(0, -4);
		const segs = [...parts.slice(0, -1), stem];
		urls.add(`/${segs.join('/')}`);
	}
	return urls;
}

const failures = [];
const pages = await pageUrls();
const files = [];
for await (const file of walk(DOCS)) files.push(file);

for (const file of files.sort()) {
	const text = await readFile(file, 'utf8');
	const rel = path.relative('.', file);

	// 1. Every internal ](/...) link must resolve to a real page.
	for (const href of new Set([...text.matchAll(/\]\((\/[^)#\s]*)/g)].map((m) => m[1]))) {
		if (href === '/' || href.startsWith('/llms') || href.startsWith('/api')) continue;
		if (!pages.has(href)) failures.push(`${rel}: dead link ${href}`);
	}

	// 2. Card hrefs resolve too (same rule, explicit so the report names it).
	for (const href of new Set([...text.matchAll(/<Card[^>]*href="(\/[^"#\s]*)"/g)].map((m) => m[1]))) {
		if (!pages.has(href)) failures.push(`${rel}: dead Card href ${href}`);
	}

	// 3. No /docs/ prefix resurrected by the model.
	for (const href of new Set([...text.matchAll(/(href="|\]\()\/?docs\//g)].map((m) => m[0]))) {
		failures.push(`${rel}: /docs/ prefix reintroduced (${href.trim()})`);
	}

	// 4. No angle-bracket placeholders inside JSX bodies — but only when they
	// look like real placeholders (<id>, <path>), not inline `code` or
	// prose that merely mentions <key> in backticks.
	const jsxBlocks = text.match(/<(Callout|Accordion|Card|Step|Tab)[^>]*>[\s\S]*?<\/\1>/g) ?? [];
	for (const block of jsxBlocks) {
		const inner = block.replace(/^<[^>]*>/, '').replace(/<\/[^>]*>$/, '');
		const stripped = inner.replace(/`[^`]*`/g, '');
		const bad = stripped.match(/<(id|path|name|selector|model|url|dir|file)>/);
		if (bad) failures.push(`${rel}: unescaped placeholder ${bad[0]} inside JSX`);
	}

	// 5. Blank line after every JSX opening tag that is followed by a list.
	const lines = text.split('\n');
	let inFence = false;
	for (let i = 0; i < lines.length - 1; i++) {
		if (lines[i].trim().startsWith('```')) inFence = !inFence;
		if (inFence) continue;
		if (/^<(Callout|Accordion|Step|Tab|Cards|Accordions|Steps|Tabs)[^>]*>$/.test(lines[i].trim())
			&& /^\s*([-*+] |\d+\. )/.test(lines[i + 1])) {
			failures.push(`${rel}:${i + 1}: list directly after JSX tag without blank line`);
		}
	}
}

const out = failures.length === 0
	? 'check-links: clean\n'
	: `check-links: ${failures.length} problem(s)\n${failures.map((f) => `- ${f}`).join('\n')}\n`;

if (REPORT) {
	const {writeFile} = await import('node:fs/promises');
	await writeFile(REPORT, out);
}
console.log(out.trimEnd());
process.exit(failures.length === 0 ? 0 : 1);
