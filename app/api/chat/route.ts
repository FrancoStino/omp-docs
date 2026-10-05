import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {
    convertToModelMessages,
    createUIMessageStreamResponse,
    stepCountIs,
    streamText,
    tool,
    toUIMessageStream,
    type UIMessage,
} from 'ai';
import {create, insertMultiple, search, type AnyOrama} from '@orama/orama';
import {source} from '@/lib/source';
import type {ChatUIMessage} from '@/components/ai/search';
import {z} from 'zod';

const nonEmpty = (v: string | undefined): string | undefined =>
    v != null && v.trim() !== '' ? v : undefined;

const customBaseURL = nonEmpty(process.env.AI_BASE_URL);
const modelId = nonEmpty(process.env.AI_MODEL) ?? 'moonshotai/kimi-k2';

const provider = createOpenAICompatible({
    name: 'custom',
    apiKey: nonEmpty(process.env.AI_API_KEY) ?? '',
    baseURL: customBaseURL ?? 'https://openrouter.ai/api/v1',
});

/** Self-hosted Orama index over the 56 docs pages: title + url + full
    markdown. Built once per server start, no account, no token, no sync
    script — the pages are already in the bundle via the Fumadocs loader. */
type DocRow = { title: string; url: string; content: string };

let indexPromise: Promise<AnyOrama> | null = null;

function getIndex(): Promise<AnyOrama> {
    if (indexPromise) return indexPromise;
    indexPromise = (async () => {
        const db = await create({schema: {title: 'string', url: 'string', content: 'string'} as const});
        const rows: DocRow[] = [];
        for (const page of source.getPages()) {
            rows.push({
                title: page.data.title,
                url: page.url,
                content: await page.data.getText('processed'),
            });
        }
        await insertMultiple(db, rows);
        return db as unknown as AnyOrama;
    })();
    return indexPromise;
}

const rateLimits: Record<string, { count: number; reset: number }> = {};

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimits[ip];
    if (!entry || now > entry.reset) {
        rateLimits[ip] = {count: 1, reset: now + 60_000};
        return true;
    }
    entry.count += 1;
    return entry.count <= 10;
}

const instructions = [
    'You are the assistant for OMP Docs, the documentation of omp — a terminal-first AI coding agent (repo can1357/oh-my-pi).',
    'When the user writes "omp" they ALWAYS mean this coding agent, never a generic editor.',
    'On EVERY user message, call the `search` tool once before answering, then write the answer from those results.',
    'Each hit has a `url` like /get-started/quickstart — cite sources as markdown links using that url.',
    'If the search results contain nothing relevant, say what you searched and that the docs do not cover it. Never invent behaviour.',
].join('\n');

export async function POST(req: Request): Promise<Response> {
    if (nonEmpty(process.env.AI_API_KEY) == null) {
        return Response.json(
            {error: 'Chat disabled: set AI_API_KEY in .env.local'},
            {status: 503},
        );
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    if (!checkRateLimit(ip)) {
        return Response.json({error: 'Rate limit, retry in a minute'}, {status: 429});
    }
    const {messages} = (await req.json()) as {messages?: UIMessage[]};

    const result = streamText({
        model: provider.chatModel(modelId),
        instructions,
        messages: await convertToModelMessages(messages ?? [], {
            convertDataPart: (part) => ({
                type: 'text',
                text: `[Client Context: ${JSON.stringify(part.data)}]`,
            }),
        }),
        tools: {search: searchTool},
        stopWhen: stepCountIs(5),
    });

    return createUIMessageStreamResponse({
        stream: toUIMessageStream({
            stream: result.stream,
            onError: (error) => `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
    });
}

const searchTool = tool({
    description: 'Search the docs content and return title, url and matching excerpts.',
    inputSchema: z.object({
        query: z.string(),
        limit: z.number().int().min(1).max(20).default(10),
    }),
    async execute({query, limit}) {
        const db = await getIndex();
        const res = await search(db, {term: query, limit, properties: ['title', 'content']});
        return res.hits.map((h) => {
            const doc = h.document as unknown as DocRow;
            return {title: doc.title, url: doc.url, excerpt: doc.content.slice(0, 800)};
        });
    },
});
