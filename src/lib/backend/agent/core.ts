import OpenAI from 'openai';
import type {
	ChatCompletionFunctionTool,
	ChatCompletionMessage,
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall
} from 'openai/resources/chat/completions';

const MAX_STEPS = 8;
const REQUEST_TIMEOUT_MS = 180_000;
const RUN_BUDGET_MS = 280_000;
const MIN_STEP_MS = 8_000;
const MAX_TOOL_RESULT_CHARS = 12_000;
const LONG_ANSWER_TOKENS = 16_000;

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

export type AgentOutcome<T> = { ok: true; result: T; steps: number } | { ok: false; steps: number; cutOff: boolean };

export type AgentCompletion = (request: {
	messages: ChatCompletionMessageParam[];
	tools: ChatCompletionFunctionTool[] | null;
	timeoutMs: number;
	maxTokens?: number;
}) => Promise<{ message: ChatCompletionMessage; cutOff: boolean } | null>;

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
	return async ({ messages, tools, timeoutMs, maxTokens }) => {
		const completion = await client.chat.completions.create(
			{ model: model.model ?? '', messages, ...(tools ? { tools, tool_choice: 'auto' as const } : {}), ...(maxTokens ? { max_tokens: maxTokens } : {}) },
			{ timeout: timeoutMs }
		);
		const choice = completion.choices?.[0];
		return choice?.message ? { message: choice.message, cutOff: choice.finish_reason === 'length' } : null;
	};
}

type PromptText = { system: string; user: string };

export async function completeText(model: AgentModel, { system, user }: PromptText, timeoutMs: number): Promise<string> {
	const reply = await completionFor(model)({
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: user }
		],
		tools: null,
		timeoutMs
	});
	return stripReasoning(typeof reply?.message?.content === 'string' ? reply.message.content : '');
}

async function toolResult(tools: AgentTool[], call: ChatCompletionMessageToolCall): Promise<unknown> {
	const tool = call.type === 'function' ? tools.find((candidate) => candidate.name === call.function.name) : undefined;
	if (!tool || call.type !== 'function') {
		return { ok: false, reason: 'unknown_tool' };
	}
	try {
		const parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {};
		return await tool.run(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
	} catch {
		return { ok: false, reason: 'tool_failed' };
	}
}

async function runTool(tools: AgentTool[], call: ChatCompletionMessageToolCall): Promise<string> {
	const result = await toolResult(tools, call);
	return (JSON.stringify(result ?? null) ?? 'null').slice(0, MAX_TOOL_RESULT_CHARS);
}

export async function runAgentLoop<T>(complete: AgentCompletion, task: AgentTask<T>, turns: AgentTurn[]): Promise<AgentOutcome<T>> {
	const tools = task.tools ?? [];
	const specs: ChatCompletionFunctionTool[] = tools.map((tool) => ({
		type: 'function',
		function: { name: tool.name, description: tool.description, parameters: tool.parameters }
	}));
	const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: task.system }, ...turns.map((turn) => ({ role: turn.role, content: turn.text }))];
	const deadline = Date.now() + RUN_BUDGET_MS;
	let fallback: { result: T } | null = null;
	let isCutOff = false;
	let steps = 0;

	while (steps < MAX_STEPS) {
		const remaining = deadline - Date.now();
		if (remaining < MIN_STEP_MS) {
			break;
		}
		steps++;
		const shouldOfferTools = specs.length > 0 && steps < MAX_STEPS;
		const request = { messages, tools: shouldOfferTools ? specs : null };
		let reply = await complete({ ...request, timeoutMs: Math.min(REQUEST_TIMEOUT_MS, remaining) });
		if (reply?.cutOff && deadline - Date.now() >= MIN_STEP_MS) {
			const longer = await complete({ ...request, timeoutMs: Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()), maxTokens: LONG_ANSWER_TOKENS }).catch(
				() => null
			);
			reply = longer ?? reply;
		}
		if (!reply) {
			break;
		}
		const { message } = reply;

		if (shouldOfferTools && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
			messages.push(message);
			const results = await Promise.all(message.tool_calls.map((call) => runTool(tools, call)));
			message.tool_calls.forEach((call, index) => messages.push({ role: 'tool', tool_call_id: call.id, content: results[index] }));
			continue;
		}
		if (reply.cutOff) {
			isCutOff = true;
			break;
		}

		const answer = stripReasoning(typeof message.content === 'string' ? message.content : '');
		const verdict = await task.finish(answer);
		if (verdict.ok) {
			return { ok: true, result: verdict.result, steps };
		}
		if (verdict.fallback !== undefined) {
			fallback = { result: verdict.fallback };
		}
		messages.push({ role: 'assistant', content: answer || '{}' }, { role: 'user', content: verdict.feedback });
	}

	return fallback ? { ok: true, result: fallback.result, steps } : { ok: false, steps, cutOff: isCutOff };
}

export function runAgent<T>(model: AgentModel, task: AgentTask<T>, turns: AgentTurn[]): Promise<AgentOutcome<T>> {
	return runAgentLoop(completionFor(model), task, turns);
}
