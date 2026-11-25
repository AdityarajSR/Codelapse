/**
 * Vercel serverless function: POST /api/assistant
 * Set GEMINI_API_KEY (free at https://aistudio.google.com/apikey) in the
 * Vercel project's environment variables. See server/providers.ts for the
 * other supported providers.
 */
import { handleAssistant } from '../server/assistant';

export const config = { maxDuration: 60 };

export async function POST(request: Request): Promise<Response> {
  const clientId =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'anonymous';
  return handleAssistant(request, process.env, clientId);
}
