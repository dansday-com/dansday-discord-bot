import { getBotConfig } from '../../../config.js';
import { fail, resolveToolFeatures } from './aiToolShared.js';
import { buildServerTools, runServerTool } from './serverTools.js';
import type { ToolFeatures } from './aiToolShared.js';

function specs(features: ToolFeatures | null) {
	return buildServerTools(features).map((tool) => tool.function);
}

export async function listAgentTools(payload: Record<string, unknown>) {
	const botId = getBotConfig()?.id;
	const guildId = String(payload?.guild_id ?? '');
	if (!botId || !guildId) {
		return { ok: false, tools: [] };
	}
	if (payload.all === true) {
		return { ok: true, tools: specs(null) };
	}
	return { ok: true, tools: specs(await resolveToolFeatures(botId, guildId)) };
}

export async function runAgentTool(payload: Record<string, unknown>) {
	const botId = getBotConfig()?.id;
	const guildId = String(payload?.guild_id ?? '');
	const name = String(payload?.name ?? '');
	if (!botId || !guildId) {
		return fail('server_not_found');
	}

	const features = await resolveToolFeatures(botId, guildId);
	if (!specs(features).some((tool) => tool.name === name)) {
		return fail('tool_unavailable');
	}

	const args = (payload.args && typeof payload.args === 'object' && !Array.isArray(payload.args) ? payload.args : {}) as Record<string, unknown>;
	return runServerTool(name, args, { botId, guildId, callerDiscordId: null });
}

export default { listAgentTools, runAgentTool };
