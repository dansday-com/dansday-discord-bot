import db from '$lib/database.js';
import type { AgentTool } from '$lib/backend/agent/core.js';
import { callMessageBot } from '$lib/frontend/serverMessages.server.js';
import type { AgentPack, AgentReach } from './runtime.server.js';

async function reachServers(reach: AgentReach): Promise<any[]> {
	if (!reach.all) return reach.server ? [reach.server] : [];
	const bots = await db.getAllBots(reach.panelId).catch(() => []);
	const lists = await Promise.all((bots as any[]).map((bot) => db.getServersForBot(Number(bot.id)).catch(() => [])));
	return lists.flat();
}

async function toolSpecs(servers: any[], all: boolean): Promise<any[]> {
	const asked = new Set<number>();
	for (const server of servers) {
		const botId = Number(server.bot_id);
		if (asked.has(botId)) continue;
		asked.add(botId);
		const call = await callMessageBot(server, 'agent_tools', { all }).catch(() => null);
		if (Array.isArray(call?.body?.tools)) return call.body.tools;
	}
	return [];
}

export async function serverDataPack(reach: AgentReach): Promise<AgentPack> {
	const servers = await reachServers(reach);
	const byId = new Map<number, any>(servers.map((server) => [Number(server.id), server]));
	const specs = await toolSpecs(reach.server ? [reach.server, ...servers] : servers, reach.all);

	const serverIdParam = {
		type: 'integer',
		description: reach.server
			? 'Which server to read, as a server_id from list_servers. Leave out for the server the admin has open.'
			: 'Which server to read, as a server_id from list_servers.'
	};

	const tools: AgentTool[] = specs.map((spec) => ({
		name: String(spec.name),
		description: String(spec.description ?? ''),
		parameters: reach.all ? { ...spec.parameters, properties: { ...(spec.parameters?.properties ?? {}), server_id: serverIdParam } } : spec.parameters,
		run: async ({ server_id, ...args }) => {
			const target = reach.all && server_id != null ? (byId.get(Number(server_id)) ?? null) : reach.server;
			if (!target) return { ok: false, reason: 'unknown_server', hint: 'Use a server_id from list_servers.' };
			const call = await callMessageBot(target, 'agent_tool', { name: spec.name, args });
			return call.body ?? { ok: false, reason: 'bot_offline', hint: 'The bot for that server is not running, so its live data cannot be read right now.' };
		}
	}));

	const where = reach.all
		? reach.server
			? `any server on this panel. The admin has "${reach.server.name ?? 'a server'}" open, so that one is meant unless they name another`
			: 'any server on this panel'
		: `the server "${reach.server?.name ?? ''}", and no other server`;
	const instructions = `# Live server data\nThe get_ tools read live data of ${where}. When the admin asks for real numbers or names from a server, read them with these tools and repeat only what they returned.${tools.length === 0 ? ' No bot is running right now, so these tools are missing. Say so when the admin asks for live data.' : ''}`;

	if (!reach.all) return { instructions, tools };
	return {
		instructions,
		tools: [
			{
				name: 'list_servers',
				description: 'Every Discord server on this panel, with the server_id the other tools take, its name and its member count.',
				parameters: { type: 'object', properties: {} },
				run: () => ({
					ok: true,
					servers: servers.map((server) => ({ server_id: Number(server.id), name: server.name ?? null, members: Number(server.total_members) || 0 }))
				})
			},
			...tools
		]
	};
}
