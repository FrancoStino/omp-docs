#!/usr/bin/env node
// Coverage audit: extract user-facing symbols from a full upstream checkout
// and report which ones no local page mentions. Mechanical only — no AI,
// no model calls, no invented content. A missing mention is a certain gap;
// writing the missing section is a separate (human or omp) step.
import {readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {basename, join} from 'node:path';

const [upstreamDir, docsDir, outFile] = process.argv.slice(2);
if (!upstreamDir || !docsDir || !outFile) {
	console.error('usage: coverage-audit.mjs <upstream-dir> <content-docs-dir> <report.md>');
	process.exit(2);
}

const walk = (dir, out = []) => {
	for (const e of readdirSync(dir)) {
		const p = join(dir, e);
		try {
			if (statSync(p).isDirectory()) {
				if (e === 'node_modules' || e === '.git' || e === 'target') continue;
				walk(p, out);
			} else if (/\.(ts|tsx|rs|md|mdx|kdl|json)$/.test(e)) {
				out.push(p);
			}
		} catch { /* unreadable entry — skip, not fatal */
		}
	}
	return out;
};

const localBody = (() => {
	let text = '';
	for (const f of walk(docsDir)) {
		if (!f.endsWith('.mdx')) continue;
		try {
			text += `\n${readFileSync(f, 'utf8')}`;
		} catch { /* skip unreadable page */
		}
	}
	return text;
})();

// Symbol extractors: each returns [{name, source}].
const symbols = [];
const addSymbols = (names, source) => {
	for (const n of new Set(names)) {
		if (n.length >= 3) symbols.push({name: n, source});
	}
};

for (const f of walk(upstreamDir)) {
	const rel = f.slice(upstreamDir.length + 1);
	let text;
	try {
		text = readFileSync(f, 'utf8');
		if (text.length > 500_000) continue; // generated blobs — skip
	} catch {
		continue;
	}
	if (rel.startsWith('docs/') && /\.mdx?$/.test(rel)) {
		addSymbols([basename(rel).replace(/\.mdx?$/, '')], rel);
	}
	if (/cli(-commands)?\.ts$/.test(rel) || /main\.ts$/.test(rel)) {
		addSymbols([...text.matchAll(/--([a-z][a-z0-9-]{2,})/g)].map((m) => `--${m[1]}`), rel);
	}
	if (/all-settings\.ts$/.test(rel) || /environment-variables\.md$/.test(rel)) {
		addSymbols([...text.matchAll(/\b([A-Z][A-Z0-9_]{4,})\b/g)].map((m) => m[1]), rel);
	}
	if (/\/(mcp|lsp|dap)\//.test(rel) && /\.ts$/.test(rel)) {
		addSymbols(
			[...text.matchAll(/(?:tools\/|method[:=]\s*['"])([a-z][a-zA-Z0-9_./-]{3,})/g)].map((m) => m[1]),
			rel,
		);
	}
	if (/catalog/.test(rel) && /\.(ts|json|kdl)$/.test(rel)) {
		addSymbols([...text.matchAll(/"([a-z0-9][a-z0-9-]{2,}(?:\/[a-z0-9-]{2,})?)"/g)].map((m) => m[1]), rel);
	}
}

const gaps = [];
const seen = new Set();
for (const s of symbols) {
	if (seen.has(s.name)) continue;
	seen.add(s.name);
	if (!localBody.includes(s.name)) {
		gaps.push(s);
	}
}

const bySource = new Map();
for (const g of gaps) {
	if (!bySource.has(g.source)) bySource.set(g.source, []);
	bySource.get(g.source).push(g.name);
}

const lines = [
	'# Coverage audit (upstream main vs local pages)',
	'',
	`Symbols extracted: ${symbols.length} · gaps (never mentioned locally): ${gaps.length}`,
	'',
];
if (gaps.length === 0) {
	lines.push('No gaps. Every extracted upstream symbol is mentioned by at least one local page.');
} else {
	for (const [src, names] of [...bySource.entries()].sort()) {
		lines.push(`## ${src} (${names.length})`);
		for (const n of names.sort()) lines.push(`- \`${n}\``);
		lines.push('');
	}
}
writeFileSync(outFile, `${lines.join('\n')}\n`);
console.log(`coverage-audit: ${symbols.length} symbols, ${gaps.length} gaps -> ${outFile}`);
