# OMP Docs

Always up-to-date documentation for [omp](https://github.com/can1357/oh-my-pi) (oh-my-pi), a terminal-first AI coding agent. Built with [Fumadocs](https://fumadocs.dev), [Next.js 16](https://nextjs.org) and [Bun](https://bun.sh). Deployed on Vercel.

Docs live at the site root (`/quickstart`, not `/docs/quickstart`). Content is in English, seeded from [omp.sh/docs](https://omp.sh/docs) (MIT, Stencil Labs) and kept in sync with upstream via AI.

## Quickstart

```bash
bun install --frozen-lockfile
cp .env.example .env.local   # fill in AI_* only if you want the chat
bun run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `bun run dev` | Dev server with HMR |
| `bun run build` | Production build (also the sync PR gate) |
| `bun run lint` | ESLint |
| `bun run start` | Serve the production build |

Requirements: Bun 1.4.x, Node 20+. No other runtime needed.

## Features

- **56 pages in 7 groups** (`content/docs/`): get-started, workflows, code-and-files, models, configuration, extend, reference. Every page carries `title` + `description` frontmatter and a `Source: omp.sh → URL` footer.
- **Search** (`/api/search`): self-hosted Orama index, no external service, no keys, no limits. Results show page path + highlighted snippet with single shared keyboard/mouse highlight.
- **Ask AI chat** (`/api/chat`): BYOK chat over any OpenAI-compatible endpoint, search-first (the model must call the `search` tool before answering), with persistent per-browser sessions in `localStorage`, image attachments (data URLs, max 4 files / 3 MB each, vision model required), and a floating button + right-rail panel.
- **LLM surfaces**: `/llms.txt`, `/llms-full.txt`, per-page `/*.md` and `/api/mcp` — same content in plain text for Cursor/Claude/external assistants.
- **Sync badge**: `synced <sha>` in the sidebar footer, read from `public/sync-state.json`.

## AI chat setup

The chat is enhancement-only: without keys the button stays hidden and the docs are complete. Copy `.env.example` to `.env.local` (never committed):

```bash
AI_BASE_URL=https://openrouter.ai/api/v1   # or Ollama http://localhost:11434/v1, vLLM, ...
AI_API_KEY=                                 # OpenRouter key, or anything (e.g. "ollama") locally
AI_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

- `GET /api/chat/config` reports `{ enabled, provider, model }`.
- `POST /api/chat` returns `503` without keys, `429` past 10 req/min per IP.
- Vision models for image attachments: `google/gemma-3-4b-it:free`, `qwen/qwen2.5-vl-72b-instruct:free`.
- No free hosted model is unlimited: OpenRouter `:free` is ~20 RPM and 50 req/day without credits.

## Auto-sync with upstream (`oh-my-pi`)

`.github/workflows/docs-sync.yml` is the only scheduler (nightly `0 6 * * *` UTC + manual `workflow_dispatch` with `from_sha`/`to_sha`). Vercel Cron is not in the loop; Jules is an optional redactor only.

Each run:

1. Reads `.docs-sync-state` (last synced upstream SHA, currently `d3a32f6` = v18.4.9).
2. Shallow-fetches `can1357/oh-my-pi@main`, diffs `LAST...FETCH_HEAD` with a path filter (`docs/**`, `packages/**`, `crates/**`, `README.md`, `AGENTS.md`, minus tests/snapshots). Empty → exit 0, no PR, no AI calls.
3. Builds `code.diff` (≤200 KB), `commits.txt`, `cliff.md` (mechanical changelog via `git-cliff`, zero tokens).
4. Runs `node scripts/ai-sync.mjs` (max 12 pages/run): current page + per-file diff → model → rewritten page. Frontmatter must be unchanged, `Source:` footer intact, root links only (`/slug`, never `/docs/slug`), no invented flags, MDX structure preserved, no imports, no `<...>` inside JSX. Anything failing validation is left untouched and reported.
5. Gates on `bun run lint && bun run build` — a broken build never becomes a PR.
6. Writes the new SHA to `.docs-sync-state` + `public/sync-state.json`.
7. Opens/updates one rolling PR `docs/sync-<sha>` with diff + AI report in the body. Human merge required; no auto-commit, no auto-merge, no full regeneration, no per-commit PRs.

To run a dry-run: Actions → docs-sync → Run workflow → `from_sha` = seed tag, `to_sha` = newer tag.

### GitHub setup (one time)

Settings → Secrets: `AI_API_KEY`. Settings → Variables: `AI_BASE_URL`, `AI_MODEL`. Without them the job logs `AI sync skipped: missing env` and still opens the PR with the raw diff for manual editing.

### Known limit

Only the 16 pages whose filename matches `oh-my-pi/docs/*.md` can be auto-rewritten; the other 40 (quickstart, using, sessions, providers, settings, cli, …) were imported from the omp.sh website, whose source repo is not public — verified by grepping a main checkout for unique local sentences (zero hits) and finding no site generator there. Those stay manual; the workflow reports them as untouched. Optional second diff input if the site source ever becomes available.

### Jules (optional)

No Jules scheduling in the loop. On an open `docs/sync-*` branch, prompt: *"Update only pages in `content/docs/<touched-areas>` using attached `code.diff`; do not touch other areas; keep frontmatter title/description; cite source `upstream@<to_sha>` at the bottom of each modified page."* Output lands on the same branch through the same PR + Preview + human review.

## Deploy (Vercel)

Connect the repo; `vercel.json` already pins Bun (`bunVersion 1.4.x`, `bun install --frozen-lockfile`, `bun run build`, `framework: nextjs`). Production env: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (chat stays hidden until `AI_API_KEY` is set). Every sync PR gets a Preview deployment; `main` deploys to production.

## Project layout

```
app/                   Next.js routes (docs at /, /api/search|chat|mcp, /llms.txt, /*.md)
app/(docs)/           DocsLayout + providers + AskAi rail mount
components/           search-dialog, ai/search (chat), markdown, docs-footer, pi-logo, sync-chip, ui/button
content/docs/         56 MDX pages in 7 groups + meta.json files
lib/                  source (Fumadocs loader), cn
scripts/ai-sync.mjs   Zero-dep AI rewrite used by the sync workflow
public/sync-state.json  { sha, date, source } for the sidebar badge
.docs-sync-state      Last synced upstream SHA (single line)
```
