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

const MODEL_PLACEHOLDERS = new Set(['openrouter/free', 'free', 'openrouter', 'model', 'your-model']);

if (!BASE || !KEY || !MODEL || MODEL_PLACEHOLDERS.has((MODEL ?? '').trim())) {
	await writeFile(
		reportFile,
		`AI sync skipped: set a real model id in AI_MODEL (got "${MODEL ?? '(unset)'}"). "openrouter/free" is not a model — use e.g. meta-llama/llama-3.1-8b-instruct:free.\n`,
	);
	console.log('AI sync skipped: missing or placeholder env (AI_MODEL must be a concrete id, not "openrouter/free")');
	process.exit(0);
}

const DOCS = 'content/docs';
const MAX_PAGES = 20;
const MAX_DIFF_PER_FILE = 12_000;
const MAX_EVIDENCE_CHARS = 1_500;

const SYSTEM = [
	'You maintain a documentation site for the tool "omp" (repo can1357/oh-my-pi).',
	'You receive the CURRENT content of one documentation page, the UPSTREAM DIFF that touched its source file, and EXTRA EVIDENCE: short excerpts from sibling pages that mention the same symbols.',
	'Rewrite the page so it matches the new upstream behaviour.',
	'',
	'Hard rules:',
	'- Output in exactly two blocks. FIRST a section starting with the literal line `EVIDENCE:` followed by one line per factual claim in the form `- <claim> <= <file>:<line>`, where <file>:<line> is a diff hunk header or evidence excerpt the claim comes from. THEN a line with exactly `---PAGE---`, then ONLY the full markdown/MDX page, no commentary, no code fence around it.',
	'- Keep the YAML frontmatter exactly as given (title, description). Never change or drop it.',
	'- Keep the final "Source: [omp.sh](...)" footer line byte-identical.',
	'- Preserve all prose that is still accurate. Change only what the diff affects; add a short paragraph or bullet when the diff adds a real feature.',
	'- Every flag, command, env var, default or behaviour you mention MUST appear either in the diff or in the current page. Never invent values from the evidence excerpts: they are context only.',
	'- Keep the page\'s existing structure: headings order, tables, <Steps>, <Tabs>, <Callout>, <Accordions>, <Cards> blocks.',
	'- Internal links use the site root, NOT a /docs prefix: href="/quickstart", never href="/docs/quickstart".',
	'- Fumadocs MDX components available without import: Callout (type="info|warn|error", optional title=""), Steps (each <Step> MUST start with a "### Heading" line then a blank line), Tabs (items={[...]} with matching <Tab value="...">), Accordions/Accordion title="...", Cards/Card title="" description="" href="/slug" (self-closing).',
	'- Never nest a markdown list immediately after an opening JSX tag without a blank line between them.',
	'- Never put angle-bracket placeholders like <id> inside JSX bodies; escape as &lt;id&gt;.',
	'- If the diff is unrelated to this page (formatting, tests, internal refactors with no user-visible effect), output the page unchanged after the evidence block.',
].join('\n');

/** Map an upstream path to the local page(s) it feeds, if any.
    Returns [{page, direct}] — direct hits by filename, plus reflected pages
    whose body mentions a symbol from the diff (flag, command, env var). */
function directPageForUpstreamPath(file, localIndex) {
	const m = file.match(/^docs\/(.+\.mdx?)$/);
	if (!m) return null;
	const slug = m[1].replace(/\.mdx?$/, '').replace(/\/index$/, '');
	const stem = slug.split('/').at(-1);
	return localIndex.get(stem) ?? null;
}

/** Symbols worth tracing across pages: --flags, /commands, _ENV_VARS_. */
function symbolsInDiff(diff) {
	const found = new Set();
	for (const m of diff.matchAll(/(--[a-z][a-z0-9-]+)/g)) found.add(m[1]);
	for (const m of diff.matchAll(/(\/[a-z][a-z0-9-]+)/g)) {
		if (m[1].length > 2 && !m[1].startsWith('//')) found.add(m[1]);
	}
	for (const m of diff.matchAll(/\b([A-Z][A-Z0-9_]{3,})\b/g)) found.add(m[1]);
	return [...found].slice(0, 12);
}

/** Pages (other than `except`) whose body mentions any of `symbols`. */
async function reflectedPages(symbols, except) {
	if (symbols.length === 0) return [];
	const hits = [];
	const {readdir, readFile} = await import('node:fs/promises');

	async function* walk(dir) {
		for (const e of await readdir(dir, {withFileTypes: true})) {
			const f = path.join(dir, e.name);
			if (e.isDirectory()) yield* walk(f);
			else if (e.name.endsWith('.mdx')) yield f;
		}
	}

	for await (const file of walk(DOCS)) {
		if (file === except) continue;
		const body = await readFile(file, 'utf8');
		const used = symbols.filter((s) => body.includes(s));
		if (used.length > 0) hits.push({page: file, symbols: used.slice(0, 4)});
		if (hits.length >= 6) break;
	}
	return hits;
}

async function askModel({pagePath, pageBody, diff, evidence}) {
	const started = Date.now();
	const evidenceBlock = evidence.length > 0
		? evidence.map((e) => `--- ${e.page} (mentions ${e.symbols.join(', ')})\n${e.excerpt}`).join('\n\n')
		: '(none)';
	const res = await fetch(`${BASE}/chat/completions`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`},
		body: JSON.stringify({
			model: MODEL,
			temperature: 0.2,
			messages: [
				{role: 'system', content: SYSTEM},
				{
					role: 'user',
					content: `UPSTREAM DIFF\n${diff}\n\nEXTRA EVIDENCE (context only, do not quote values from here)\n${evidenceBlock}\n\nCURRENT PAGE (${pagePath})\n${pageBody}`
				},
			],
		}),
	});

	if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const json = await res.json();
	const content = json.choices?.[0]?.message?.content?.trim() ?? '';
	if (!content) {
		const reason = json.choices?.[0]?.finish_reason ?? 'unknown';
		throw new Error(`empty completion (finish_reason=${reason}, ${Date.now() - started}ms)`);
	}
	return content;
}

/** Reject anything that lost the frontmatter, the footer, looks truncated,
    or invents facts the diff and the page never contained. Returns a reason
    string, or null when the rewrite is acceptable. */
function validate(before, after, diff) {
	const [, page] = after.split('---PAGE---');
	if (page === undefined) return 'missing ---PAGE--- separator';
	const body = page.trimStart();
	if (!body.startsWith('---')) return 'missing frontmatter';
	if (!body.includes('Source: [omp.sh]')) return 'missing Source footer';
	const fm = (s) => s.slice(0, s.indexOf('\n---', 3));
	if (fm(before) !== fm(body)) return 'frontmatter changed';
	if (body.length < before.length * 0.5) return 'output suspiciously short';
	// Grounding: every --flag, /command or ENV_VAR introduced by the rewrite
	// must already exist in the diff or the previous page.
	const known = new Set([
		...(diff.match(/[\s"'`](-{1,2}[a-z][a-z0-9-]*|\/[a-z][a-z0-9-]+|[A-Z][A-Z0-9_]{3,})/g) ?? []),
		...(before.match(/[\s"'`](-{1,2}[a-z][a-z0-9-]*|\/[a-z][a-z0-9-]+|[A-Z][A-Z0-9_]{3,})/g) ?? []),
	].map((s) => s.trim().replace(/^["'`]/, '')));
	const codeFree = body.replace(/```[\s\S]*?```/g, '');
	for (const m of codeFree.matchAll(/(--[a-z][a-z0-9-]+)/g)) {
		if (!known.has(m[1]) && !before.includes(m[1])) return `un grounded flag ${m[1]}`;
	}
	for (const m of codeFree.matchAll(/\b([A-Z][A-Z0-9_]{4,})\b/g)) {
		if (!known.has(m[1]) && !before.includes(m[1])) return `ungrounded env ${m[1]}`;
	}
	return null;
}

const changed = (await readFile(changedFile, 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean);

// Local filename index: stem -> full path. The tree is grouped, so a flat
// path.join(DOCS, slug) would miss content/docs/<group>/foo.mdx.
const localIndex = new Map();
{
	const {readdir} = await import('node:fs/promises');

	async function* walkIdx(dir) {
		for (const e of await readdir(dir, {withFileTypes: true})) {
			const f = path.join(dir, e.name);
			if (e.isDirectory()) yield* walkIdx(f);
			else if (e.name.endsWith('.mdx')) yield f;
		}
	}

	for await (const f of walkIdx(DOCS)) localIndex.set(path.basename(f, '.mdx'), f);
}
const directPages = [...new Set(changed.map((f) => directPageForUpstreamPath(f, localIndex)).filter(Boolean))];

const report = [`# AI doc sync (${toSha})`, '', `Pages targeted (direct): ${directPages.length}`];
let rewritten = 0;
let skipped = 0;
let failed = 0;
let reflected = 0;

async function pageDiff(rel) {
	// Upstream uses .md, local pages are .mdx (possibly grouped): resolve by stem.
	const stem = rel.replace(/\.mdx$/, '').split('/').at(-1);
	let diff = '';
	try {
		const {stdout} = await execFileAsync(
			'git',
			['diff', '-U3', process.env.SYNC_FROM, process.env.SYNC_TO, '--', `docs/${stem}.md`, `docs/${stem}.mdx`],
			{maxBuffer: 4_000_000},
		);
		diff = stdout.slice(0, MAX_DIFF_PER_FILE);
	} catch {
		diff = '';
	}
	return diff;
}

async function rewritePage(page, diff, reflectedFrom) {
	let before;
	try {
		before = await readFile(page, 'utf8');
	} catch {
		skipped++;
		return;
	}

	const rel = page.replace(`${DOCS}/`, '');
	if (!diff.trim()) {
		skipped++;
		report.push(`- \`${rel}\`: skipped (no usable diff)`);
		return;
	}

	// Reflected context: short excerpts from sibling pages that mention the
	// same symbols, so the model keeps cross-page wording consistent.
	const symbols = symbolsInDiff(diff);
	const sibs = await reflectedPages(symbols, page);
	const evidence = [];
	for (const s of sibs) {
		const body = await readFile(s.page, 'utf8').catch(() => '');
		const idx = symbols.map((sym) => body.indexOf(sym)).filter((i) => i >= 0);
		const at = idx.length > 0 ? Math.min(...idx) : 0;
		evidence.push({
			page: s.page.replace(`${DOCS}/`, ''),
			symbols: s.symbols,
			excerpt: body.slice(Math.max(0, at - 400), at + MAX_EVIDENCE_CHARS).slice(0, MAX_EVIDENCE_CHARS),
		});
	}

	try {
		const raw = await askModel({pagePath: rel, pageBody: before, diff, evidence});
		// Evidence prefix (EVIDENCE: ... ---PAGE---) and any wrapper text the
		// model adds around it, plus the echoed `CURRENT PAGE (path)` line the
		// mock endpoints return: the page is everything from the first
		// frontmatter `---` after the LAST ---PAGE--- marker.
		const m = raw.match(/---+\s*PAGE\s*---+/g);
		if (!m) {
			failed++;
			report.push(`- \`${rel}\`: rejected (missing ---PAGE--- separator) — page left untouched`);
			return;
		}
		const last = m.at(-1);
		let after = raw.slice(raw.lastIndexOf(last) + last.length);
		// Drop the echoed CURRENT PAGE header when present: the real page
		// always starts at its frontmatter.
		const fmIdx = after.indexOf('\n---\n');
		if (fmIdx >= 0) after = after.slice(fmIdx + 1);
		const problem = validate(before, after.trimStart(), diff);
		if (problem) {
			failed++;
			report.push(`- \`${rel}\`: rejected (${problem}) — page left untouched`);
			return;
		}
		await writeFile(page, `${after.trimStart()}\n`);
		rewritten++;
		if (reflectedFrom) reflected++;
		report.push(`- \`${rel}\`: rewritten by AI${reflectedFrom ? ` (reflected from ${reflectedFrom})` : ''}`);
	} catch (err) {
		failed++;
		report.push(`- \`${rel}\`: failed (${String(err).slice(0, 200)}) — page left untouched`);
	}
}

const seen = new Set();
const queue = directPages.slice(0, MAX_PAGES);
for (const page of queue) {
	if (seen.has(page)) continue;
	seen.add(page);
	await rewritePage(page, await pageDiff(page.replace(`${DOCS}/`, '')), null);
}

// Second pass: pages that mention symbols from any direct diff, even when
// their own source file did not change (renames, cross-page references).
const allDiffs = [];
for (const page of [...seen]) {
	const rel = page.replace(`${DOCS}/`, '');
	allDiffs.push(await pageDiff(rel));
}
const allSymbols = [...new Set(allDiffs.flatMap(symbolsInDiff))];
const extra = (await reflectedPages(allSymbols, '')).filter((s) => !seen.has(s.page)).slice(0, Math.max(0, MAX_PAGES - seen.size));
for (const s of extra) {
	seen.add(s.page);
	await rewritePage(s.page, allDiffs.join('\n').slice(0, MAX_DIFF_PER_FILE), s.symbols.join(', '));
}

report.push('', `Rewritten: ${rewritten} (reflected: ${reflected}) · skipped: ${skipped} · failed: ${failed}`);
await writeFile(reportFile, `${report.join('\n')}\n`);
console.log(report.at(-1));

const targeted = seen.size;
process.exit(failed === targeted && targeted > 0 ? 1 : 0);
