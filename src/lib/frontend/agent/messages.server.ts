import db from '$lib/database.js';
import { messagePack, type MessageAgentContext, type MessageAgentResult } from '$lib/backend/agent/messagePack.js';
import { messageFileBelongsTo } from '$lib/backend/storage/messageFiles.js';
import { APP_DOMAIN, SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { callMessageBot } from '$lib/frontend/serverMessages.server.js';
import { MESSAGE_LIMITS, isSelfAssignableRole, normalizeMessageDoc, type MessageOwner, type MessageScope } from '$lib/messages.js';
import { normalizeMainConfigForPanel } from '$lib/utils/mainConfig.js';
import type { AgentAnswer, AgentPack, AgentReach } from './runtime.server.js';

export type MessageRequest = { scope: MessageScope; id: unknown; name: unknown; content: unknown };

type Library = Pick<MessageAgentContext, 'serverName' | 'messages' | 'roles' | 'emojis' | 'defaults'> & { posted: (messageId: number) => Promise<boolean> };

async function serverLibrary(server: any): Promise<Library> {
	const serverId = Number(server.id);
	const [messages, roles, mainRow, emojis] = await Promise.all([
		db.getServerMessages(serverId).catch(() => []),
		db.getRoles(serverId).catch(() => []),
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null),
		callMessageBot(server, 'server_message_emojis', {}).catch(() => null)
	]);
	const main = normalizeMainConfigForPanel((mainRow as any)?.settings ?? {});

	return {
		serverName: String(server.name ?? 'Server'),
		messages,
		roles: (roles as any[])
			.filter((role) => String(role.discord_role_id) !== String(server.discord_server_id) && isSelfAssignableRole(role.permissions))
			.map((role) => ({ id: String(role.discord_role_id), name: String(role.name ?? 'Unnamed role') })),
		emojis: Array.isArray(emojis?.body?.emojis) ? emojis.body.emojis : [],
		defaults: { color: main.color, footer: main.footer },
		posted: async (messageId) => (await db.getServerMessagePosts(serverId, messageId).catch(() => [])).length > 0
	};
}

async function globalLibrary(panelId: number): Promise<Library> {
	return {
		serverName: '',
		messages: await db.getGlobalMessages(panelId).catch(() => []),
		roles: [],
		emojis: [],
		defaults: { color: '', footer: `Powered by ${APP_DOMAIN} {year}` },
		posted: async (messageId) => (await db.getGlobalMessagePosts(panelId, messageId).catch(() => [])).length > 0
	};
}

function shape(result: MessageAgentResult): AgentAnswer {
	return { reply: result.reply, message: { name: result.name, content: result.content } };
}

export function messageRequest(raw: any): MessageRequest | null {
	if (!raw || typeof raw !== 'object') return null;
	return raw.scope === 'server' || raw.scope === 'global' ? { scope: raw.scope, id: raw.id, name: raw.name, content: raw.content } : null;
}

export function canBuildMessage(reach: AgentReach, request: MessageRequest | null): boolean {
	if (!request) return false;
	return request.scope === 'global' ? reach.all : reach.server != null;
}

export async function messageBuilderPack(reach: AgentReach, request: MessageRequest): Promise<AgentPack> {
	const global = request.scope === 'global';
	const owner: MessageOwner = global ? { scope: 'global', id: reach.panelId } : { scope: 'server', id: Number(reach.server.id) };
	const library = await (global ? globalLibrary(reach.panelId) : serverLibrary(reach.server));
	const ownsUpload = (key: string) => messageFileBelongsTo(key, owner);

	const requestedId = Math.trunc(Number(request.id));
	const messageId = library.messages.some((message) => message.id === requestedId) ? requestedId : null;

	const pack = messagePack({
		scope: request.scope,
		serverName: library.serverName,
		messageId,
		name: String(request.name ?? '').slice(0, MESSAGE_LIMITS.name),
		doc: normalizeMessageDoc(request.content, ownsUpload, request.scope),
		posted: messageId !== null && (await library.posted(messageId)),
		defaults: library.defaults,
		messages: library.messages,
		roles: library.roles,
		emojis: library.emojis,
		ownsUpload
	});

	return {
		instructions: pack.instructions,
		tools: pack.tools,
		finish: (answer) => {
			const verdict = pack.finish(answer);
			if (verdict.ok) return { ok: true, result: shape(verdict.result) };
			return { ok: false, feedback: verdict.feedback, ...(verdict.fallback ? { fallback: shape(verdict.fallback) } : {}) };
		}
	};
}
