import db, { aiFromDbRow, type AiInput } from '$lib/database.js';
import { AGENT_OFF, AGENT_PROMPT_LIMIT } from '$lib/agent.js';
import { runAgent, type AgentTask, type AgentTool, type AgentTurn, type AgentVerdict } from '$lib/backend/agent/core.js';
import type { MessageDoc } from '$lib/messages.js';
import { accountOwnsServer } from '$lib/backend/panelServer.js';
import { logger } from '$lib/utils/index.js';
import type { ServerRow } from '$lib/schema.js';
import { HTTP } from '$lib/http.js';

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_TURN_LENGTH = 4000;

export type AgentReach = { panelId: number; all: boolean; server: ServerRow | null };

export type AgentSession = { actor: string; changed: Set<string>; navigate: string | null };

export type AgentAnswer = { reply: string; message?: { name: string | null; content: MessageDoc | null } };

export type AgentPack = {
	instructions: string;
	tools: AgentTool[];
	finish?: (answer: string) => AgentVerdict<AgentAnswer> | Promise<AgentVerdict<AgentAnswer>>;
};

export type AgentReply<T> = { ok: true; result: T } | { ok: false; status: number; error: string };

export function agentSession(locals: App.Locals): AgentSession {
	return { actor: locals.user.authenticated ? locals.user.username : 'Someone', changed: new Set(), navigate: null };
}

export async function agentReach(locals: App.Locals, server: ServerRow | null = null): Promise<AgentReach | null> {
	if (!locals.user.authenticated) {
		return null;
	}
	const isSuperadmin = locals.user.account_source === 'accounts' && locals.user.account_type === 'superadmin';
	if (!isSuperadmin && !server) {
		return null;
	}
	if (server && !(await accountOwnsServer(locals, Number(server.id)))) {
		return null;
	}

	const panelId = locals.user.account_source === 'accounts' ? locals.user.panel_id : server ? await db.getServerPanelId(Number(server.id)) : null;
	if (panelId == null || !(Number(panelId) > 0)) {
		return null;
	}
	return { panelId: Number(panelId), all: isSuperadmin, server };
}

export async function agentModel(panelId: number): Promise<AiInput | null> {
	const config = aiFromDbRow(await db.getAi(panelId).catch(() => null));
	return config.enabled && config.api_url && config.api_key && config.model ? config : null;
}

export async function agentReady(panelId: number): Promise<boolean> {
	return (await agentModel(panelId)) !== null;
}

export function agentTurns(rawHistory: unknown, rawPrompt: unknown): AgentTurn[] | null {
	const prompt = String(rawPrompt ?? '')
		.trim()
		.slice(0, AGENT_PROMPT_LIMIT);
	if (!prompt) {
		return null;
	}

	const history: AgentTurn[] = (Array.isArray(rawHistory) ? rawHistory : [])
		.filter((turn) => (turn?.role === 'user' || turn?.role === 'assistant') && typeof turn.text === 'string' && turn.text.trim())
		.slice(-MAX_HISTORY_TURNS)
		.map((turn) => ({ role: turn.role, text: turn.text.trim().slice(0, MAX_HISTORY_TURN_LENGTH) }));
	while (history[0]?.role === 'assistant') {
		history.shift();
	}

	return [...history, { role: 'user', text: prompt }];
}

function agentError(cause: unknown): string {
	const error = cause as { status?: unknown; name?: unknown; message?: unknown } | null | undefined;
	const status = Number(error?.status);
	if (status === HTTP.UNAUTHORIZED || status === HTTP.FORBIDDEN) {
		return 'The AI provider rejected the API key. The panel admin can check it under AI in the admin panel.';
	}
	if (status === HTTP.NOT_FOUND) {
		return 'The AI provider does not know that model or URL. The panel admin can check them under AI in the admin panel.';
	}
	if (status === HTTP.TOO_MANY_REQUESTS) {
		return 'The AI provider is rate limiting requests. Wait a moment and try again.';
	}
	if (/timeout|timed out|abort/i.test(`${error?.name ?? ''} ${error?.message ?? ''}`)) {
		return 'The AI took too long to answer. Try again with a shorter request.';
	}
	if (/connection/i.test(String(error?.name ?? ''))) {
		return 'Could not reach the AI provider. The panel admin can check the API URL under AI in the admin panel.';
	}
	return 'The AI request failed. Try again in a moment.';
}

type AgentRun = { turns: AgentTurn[]; label: string };

export async function runPanelAgent<T>(reach: AgentReach, task: AgentTask<T>, { turns, label }: AgentRun): Promise<AgentReply<T>> {
	const config = await agentModel(reach.panelId);
	if (!config) {
		return { ok: false, status: HTTP.BAD_REQUEST, error: AGENT_OFF };
	}

	try {
		const outcome = await runAgent(config, task, turns);
		logger.log(`✨ ${label}: ${outcome.ok ? 'answered' : 'no usable answer'} in ${outcome.steps} step(s)`);
		if (outcome.ok) {
			return { ok: true, result: outcome.result };
		}
		if (outcome.cutOff) {
			return {
				ok: false,
				status: HTTP.BAD_GATEWAY,
				error: 'The AI model ran out of room before it finished writing. Ask for it in two parts, or pick a model that can write longer answers.'
			};
		}
		return { ok: false, status: HTTP.BAD_GATEWAY, error: 'The AI did not come back with something usable. Try again, or say it another way.' };
	} catch (error) {
		logger.log(`❌ ${label} failed: ${(error as Error)?.message ?? error}`);
		return { ok: false, status: HTTP.BAD_GATEWAY, error: agentError(error) };
	}
}
