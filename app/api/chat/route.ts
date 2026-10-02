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
import {source} from '@/lib/source';
import {Document, type DocumentData} from 'flexsearch';
import {ChatUIMessage, SearchTool} from '../../../components/ai/search';

interface CustomDocument extends DocumentData {
    url: string;
    title: string;
    description: string;
    content: string;
}

const searchServer = createSearchServer();

async function createSearchServer() {
    const search = new Document<CustomDocument>({
        document: {
            id: 'url',
            index: ['title', 'description', 'content'],
            store: true,
        },
    });

    const docs = await chunkedAll(
        source.getPages().map(async (page) => {
            if (!('getText' in page.data)) return null;

            return {
                title: page.data.title,
                description: page.data.description,
                url: page.url,
                content: await page.data.getText('processed'),
            } as CustomDocument;
        }),
    );

    for (const doc of docs) {
        if (doc) search.add(doc);
    }

    return search;
}

async function chunkedAll<O>(promises: Promise<O>[]): Promise<O[]> {
    const SIZE = 50;
    const out: O[] = [];
    for (let i = 0; i < promises.length; i += SIZE) {
        out.push(...(await Promise.all(promises.slice(i, i + SIZE))));
    }
    return out;
}

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

/** System prompt, you can update it to provide more specific information */
const systemPrompt = [
    'You are an AI assistant for a documentation site.',
    'Use the `search` tool to retrieve relevant docs context before answering when needed.',
    'The `search` tool returns raw JSON results from documentation. Use those results to ground your answer and cite sources as markdown links using the document `url` field when available.',
    'If you cannot find the answer in search results, say you do not know and suggest a better search query.',
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
        limit: z.number().int().min(1).max(100).default(10),
    }),
    async execute({query, limit}) {
        const search = await searchServer;
        return await search.searchAsync(query, {limit, merge: true, enrich: true});
    },
}) satisfies SearchTool;
