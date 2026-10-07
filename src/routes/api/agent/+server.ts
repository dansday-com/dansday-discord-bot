import type { RequestHandler } from '@sveltejs/kit';
import { answerAssistant, describeAssistant } from '$lib/frontend/agent/assistant.server.js';

export const GET: RequestHandler = ({ locals, url }) => describeAssistant(locals, url);

export const POST: RequestHandler = async ({ locals, request }) => answerAssistant(locals, await request.json().catch(() => null));
