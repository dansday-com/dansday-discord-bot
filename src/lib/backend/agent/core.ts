import OpenAI from 'openai';

const MAX_STEPS = 8;
const REQUEST_TIMEOUT_MS = 60_000;
const RUN_BUDGET_MS = 85_000;
const MIN_STEP_MS = 8_000;
const MAX_TOOL_RESULT_CHARS = 12_000;

export type AgentModel = { api_url: string | null; api_key: string | null; model: string | null };

export type AgentTurn = { role: 'user' | 'assistant'; text: string };

export type AgentTool = {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	run: (args: Record<string, unknown>) => unknown | Promise<unknown>;
};

export type AgentVerdict<T> = { ok: true; result: T } | { ok: false; feedback: string; fallback?: T };

export type AgentTask<T> = {
	system: string;
	tools?: AgentTool[];
	finish: (answer: string) => AgentVerdict<T> | Promise<AgentVerdict<T>>;
};

export type AgentOutcome<T> = { ok: true; result: T; steps: number } | { ok: false; steps: number };

export type AgentCompletion = (request: { messages: any[]; tools: any[] | null; timeoutMs: number }) => Promise<any>;

function normalizeBaseUrl(rawUrl: string | null): string {
	const trimmed = String(rawUrl ?? '')
		.trim()
		.replace(/\/+$/, '');
	return trimmed.endsWith('/chat/completions') ? trimmed.slice(0, -'/chat/completions'.length) : trimmed;
}

function stripReasoning(text: string): string {
	return text
		.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.trim();
}

function completionFor(model: AgentModel): AgentCompletion {
	const client = new OpenAI({ baseURL: normalizeBaseUrl(model.api_url), apiKey: model.api_key ?? '', maxRetries: 0 });
	return async ({ messages, tools, timeoutMs }) => {
		const completion = await client.chat.completions.create(
			{ model: model.model ?? '', messages, ...(tools ? { tools, tool_choice: 'auto' as const } : {}) },
			{ timeout: timeoutMs }
		);
		return completion.choices?.[0]?.message ?? null;
	};
}

async function runTool(tools: AgentTool[], call: any): Promise<string> {
	const tool = tools.find((candidate) => candidate.name === call?.function?.name);
	let result: unknown;
	if (!tool) {
		result = { ok: false, reason: 'unknown_tool' };
	} else {
		try {
			const parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {};
			result = await tool.run(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
		} catch {
			result = { ok: false, reason: 'tool_failed' };
		}
	}
	return (JSON.stringify(result ?? null) ?? 'null').slice(0, MAX_TOOL_RESULT_CHARS);
}

export async function runAgentLoop<T>(complete: AgentCompletion, task: AgentTask<T>, turns: AgentTurn[]): Promise<AgentOutcome<T>> {
	const tools = task.tools ?? [];
	const specs = tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
	const messages: any[] = [{ role: 'system', content: task.system }, ...turns.map((turn) => ({ role: turn.role, content: turn.text }))];
	const deadline = Date.now() + RUN_BUDGET_MS;
	let fallback: { result: T } | null = null;
	let steps = 0;

	while (steps < MAX_STEPS) {
		const remaining = deadline - Date.now();
		if (remaining < MIN_STEP_MS) break;
		steps++;
		const offerTools = specs.length > 0 && steps < MAX_STEPS;
		const message = await complete({ messages, tools: offerTools ? specs : null, timeoutMs: Math.min(REQUEST_TIMEOUT_MS, remaining) });
		if (!message) break;

		if (offerTools && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
			messages.push(message);
			const results = await Promise.all(message.tool_calls.map((call: any) => runTool(tools, call)));
			message.tool_calls.forEach((call: any, index: number) => messages.push({ role: 'tool', tool_call_id: call.id, content: results[index] }));
			continue;
		}

		const answer = stripReasoning(typeof message.content === 'string' ? message.content : '');
		const verdict = await task.finish(answer);
		if (verdict.ok) return { ok: true, result: verdict.result, steps };
		if (verdict.fallback !== undefined) fallback = { result: verdict.fallback };
		messages.push({ role: 'assistant', content: answer || '{}' }, { role: 'user', content: verdict.feedback });
	}

	return fallback ? { ok: true, result: fallback.result, steps } : { ok: false, steps };
}

export function runAgent<T>(model: AgentModel, task: AgentTask<T>, turns: AgentTurn[]): Promise<AgentOutcome<T>> {
	return runAgentLoop(completionFor(model), task, turns);
}
