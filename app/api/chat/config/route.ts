export function GET() {
  const enabled = (process.env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY) != null;
  return Response.json({ enabled, provider: process.env.AI_BASE_URL ?? 'openrouter', model: process.env.AI_MODEL ?? process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.1-8b-instruct:free' });
}
