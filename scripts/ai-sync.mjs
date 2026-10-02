#!/usr/bin/env node
// AI doc sync: rewrites the content/docs pages touched by an upstream diff using
// an OpenAI-compatible chat completions endpoint. Plain fetch, no dependencies.
//
// Usage: node scripts/ai-sync.mjs <changed.txt> <out-report.md> [to_sha]
// Env:   AI_BASE_URL, AI_API_KEY, AI_MODEL
// Exit:  0 always when a page is skipped; 1 only when every page failed hard.

import {readFile, writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const [, , changedFile, reportFile, toSha = 'unknown'] = process.argv;
if (!changedFile || !reportFile) {
	console.error('usage: node scripts/ai-sync.mjs <changed.txt> <report.md> [to_sha]');
	process.exit(1);
}

const BASE = process.env.AI_BASE_URL?.replace(/\/$/, '');
const KEY = process.env.AI_API_KEY;
const MODEL = process.env.AI_MODEL;

if (!BASE || !KEY || !MODEL) {
	await writeFile(reportFile, 'AI sync skipped: AI_BASE_URL / AI_API_KEY / AI_MODEL not set in CI.\n');
	console.log('AI sync skipped: missing env');
	process.exit(0);
}

const DOCS = 'content/docs';
const MAX_PAGES = 12;
const MAX_DIFF_PER_FILE = 12_000;

const SYSTEM = [
	'You maintain a documentation site for the tool "omp" (repo can1357/oh-my-pi).',
	'You receive the CURRENT content of one documentation page and the UPSTREAM DIFF that touched its source file.',
	'Rewrite the page so it matches the new upstream behaviour.',
	'',
	'Hard rules:',
	'- Output ONLY the full markdown/MDX page, no commentary, no code fence around it.',
	'- Keep the YAML frontmatter exactly as given (title, description). Never change or drop it.',
	'- Keep the final "Source: [omp.sh](...)" footer line byte-identical.',
	'- Preserve all prose that is still accurate. Change only what the diff affects; add a short paragraph or bullet when the diff adds a real feature.',
	'- Never invent flags, commands, env vars or defaults that do not appear in the diff.',
	'- Keep the page\'s existing structure: headings order, tables, <Steps>, <Tabs>, <Callout>, <Accordions>, <Cards> blocks.',
	'- Internal links use the site root, NOT a /docs prefix: href="/quickstart", never href="/docs/quickstart".',
	'- Fumadocs MDX components available without import: Callout (type="info|warn|error", optional title=""), Steps (each <Step> MUST start with a "### Heading" line then a blank line), Tabs (items={[...]} with matching <Tab value="...">), Accordions/Accordion title="...", Cards/Card title="" description="" href="/slug" (self-closing).',
	'- Never nest a markdown list immediately after an opening JSX tag without a blank line between them.',
	'- Never put angle-bracket placeholders like <id> inside JSX bodies; escape as &lt;id&gt;.',
	'- If the diff is unrelated to this page (formatting, tests, internal refactors with no user-visible effect), output the page unchanged.',
].join('\n');

/** Map an upstream path to the local page it feeds, if any. */
function pageForUpstreamPath(file) {
	const m = file.match(/^docs\/(.+\.mdx?)$/);
	if (!m) return null;
	const slug = m[1].replace(/\.mdx?$/, '').replace(/\/index$/, '');
	return path.join(DOCS, `${slug}.mdx`);
}

async function askModel({pagePath, pageBody, diff}) {
	const res = await fetch(`${BASE}/chat/completions`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`},
		body: JSON.stringify({
			model: MODEL,
			temperature: 0.2,
			messages: [
				{role: 'system', content: SYSTEM},
				{role: 'user', content: `UPSTREAM DIFF\n${diff}\n\nCURRENT PAGE (${pagePath})\n${pageBody}`},
			],
		}),
	});

	if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const json = await res.json();
	return json.choices?.[0]?.message?.content?.trim() ?? '';
}

/** Reject anything that lost the frontmatter, the footer, or looks truncated. */
function validate(before, after) {
	if (!after.startsWith('---')) return 'missing frontmatter';
	if (!after.includes('Source: [omp.sh]')) return 'missing Source footer';
	const fm = (s) => s.slice(0, s.indexOf('\n---', 3));
	if (fm(before) !== fm(after)) return 'frontmatter changed';
	if (after.length < before.length * 0.5) return 'output suspiciously short';
	return null;
}

const changed = (await readFile(changedFile, 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean);
const pages = [...new Set(changed.map(pageForUpstreamPath).filter(Boolean))].slice(0, MAX_PAGES);

const report = [`# AI doc sync (${toSha})`, '', `Pages targeted: ${pages.length}`];
let rewritten = 0;
let skipped = 0;
let failed = 0;

for (const page of pages) {
	let before;
	try {
		before = await readFile(page, 'utf8');
	} catch {
		skipped++;
		continue;
	}

	const rel = page.replace(`${DOCS}/`, '');
	let diff = '';
	try {
		const {stdout} = await execFileAsync(
			'git',
			['diff', '-U3', process.env.SYNC_FROM, process.env.SYNC_TO, '--', `docs/${rel.replace(/\.mdx$/, '.md')}`],
			{maxBuffer: 4_000_000},
		);
		diff = stdout.slice(0, MAX_DIFF_PER_FILE);
	} catch {
		diff = '';
	}

	if (!diff.trim()) {
		skipped++;
		report.push(`- \`${rel}\`: skipped (no usable diff)`);
		continue;
	}

	try {
		const after = await askModel({pagePath: rel, pageBody: before, diff});
		const problem = validate(before, after);
		if (problem) {
			failed++;
			report.push(`- \`${rel}\`: rejected (${problem}) — page left untouched`);
			continue;
		}
		await writeFile(page, `${after}\n`);
		rewritten++;
		report.push(`- \`${rel}\`: rewritten by AI`);
	} catch (err) {
		failed++;
		report.push(`- \`${rel}\`: failed (${String(err).slice(0, 200)}) — page left untouched`);
	}
}

report.push('', `Rewritten: ${rewritten} · skipped: ${skipped} · failed: ${failed}`);
await writeFile(reportFile, `${report.join('\n')}\n`);
console.log(report.at(-1));

process.exit(failed === pages.length && pages.length > 0 ? 1 : 0);
