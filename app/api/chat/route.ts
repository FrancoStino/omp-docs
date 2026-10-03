import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {
    convertToModelMessages,
    createUIMessageStreamResponse,
    stepCountIs,
    streamText,
    tool,
    toUIMessageStream,
} from 'ai';
import {z} from 'zod';
import {createFromSource} from 'fumadocs-core/search/server';
import {source} from '@/lib/source';
import {ChatUIMessage, SearchTool} from '@/components/ai/search';

const searchServer = createFromSource(source);

const nonEmpty = (v: string | undefined): string | undefined =>
    v != null && v.trim() !== '' ? v : undefined;

const customBaseURL = nonEmpty(process.env.AI_BASE_URL);

const provider = customBaseURL
    ? createOpenAICompatible({
        name: 'custom',
        apiKey: nonEmpty(process.env.AI_API_KEY) ?? '',
        baseURL: customBaseURL,
    })
    : null;

function resolveModel() {
    const modelId = nonEmpty(process.env.AI_MODEL);
    if (provider == null || modelId == null) {
        throw new Error('Missing AI_BASE_URL/AI_MODEL: set them in .env.local');
    }
    return provider.chatModel(modelId);
}

/** System prompt: identity first, then the search-first rule.
 The default template only said "a documentation site" with no product
 identity, so the model treated "omp" as a generic editor and guessed
 instead of reading the docs (visible as `0 search results` in answers). */
const systemPrompt = [
    'You are the assistant for OMP Docs, the documentation of omp — a terminal-first AI coding agent (repo can1357/oh-my-pi) that works inside the user\'s project: it inspects code, edits files, runs commands and keeps resumable sessions.',
    'When the user writes "omp" they ALWAYS mean this coding agent, never a generic editor or an unknown tool. Never ask what OMP is, and never suggest generic fixes (file pickers, permissions, resizing) without checking the docs first.',
    'On EVERY user message you MUST call the `search` tool exactly once before answering, then write the answer from those results. Never call it twice for the same message, and never answer from memory without calling it.',
    'Each message may carry a [Client Context: {"location": "..."}] tag: that is the docs page the user is currently reading. Prefer results from that page and its neighbours when relevant.',
    'The `search` tool returns raw JSON results from documentation (each hit has a `url` like /get-started/quickstart, /workflows/sessions, /models/providers). Use those results to ground your answer and cite sources as markdown links using the document `url` field when available.',
    'If the search results contain nothing relevant, say exactly what you searched, state that the docs do not cover it, and suggest a better search query. Do not invent behaviour the docs do not describe. If you already searched and still have no answer, say so — never call `search` again for the same message.',
].join('\n');

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

export async function POST(req: Request) {
    const apiKey = nonEmpty(process.env.AI_API_KEY);
    if (apiKey == null || customBaseURL == null || nonEmpty(process.env.AI_MODEL) == null) {
        return Response.json(
            {error: 'Chat disabled: set AI_BASE_URL, AI_API_KEY and AI_MODEL in .env.local'},
            {status: 503},
        );
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    if (!checkRateLimit(ip)) {
        return Response.json({error: 'Rate limit, retry in a minute'}, {status: 429});
    }
    const reqJson = await req.json();

    const result = streamText({
        model: resolveModel(),
        instructions: systemPrompt,
        stopWhen: stepCountIs(5),
        tools: {
            search: searchTool,
        },
        messages: [
            ...(await convertToModelMessages<ChatUIMessage>(reqJson.messages ?? [], {
                convertDataPart(part) {
                    if (part.type === 'data-client')
                        return {
                            type: 'text',
                            text: `[Client Context: ${JSON.stringify(part.data)}]`,
                        };
                },
            })),
        ],
        toolChoice: 'auto',
    });

    return createUIMessageStreamResponse({
        stream: toUIMessageStream({
            stream: result.stream,
            onError: (error) => `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
    });
}

const searchTool = tool({
    description: 'Search the docs content and return raw JSON results.',
    inputSchema: z.object({
        query: z.string(),
        limit: z.number().int().min(1).max(100).default(30),
    }),
    async execute({query, limit}) {
        return await searchServer.search(query, {locale: 'en', limit});
    },
}) satisfies SearchTool;
