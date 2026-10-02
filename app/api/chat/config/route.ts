export function GET() {
  const baseURL = process.env.AI_BASE_URL?.trim() ? process.env.AI_BASE_URL : null;
  const model = process.env.AI_MODEL?.trim() ? process.env.AI_MODEL : null;
  const apiKey = process.env.AI_API_KEY;
  const enabled = apiKey != null && apiKey.trim() !== '' && baseURL != null && model != null;
  return Response.json({ enabled, provider: baseURL, model });
}
