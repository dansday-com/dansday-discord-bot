import db from '$lib/database.js';
import { completeText } from '$lib/backend/agent/core.js';
import { messagePack, type MessageAgentContext, type MessageAgentResult } from '$lib/backend/agent/messagePack.js';
import { messageFileBelongsTo } from '$lib/backend/storage/messageFiles.js';
import { APP_DOMAIN, SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { ADMIN_TAB_PATHS, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { callMessageBot } from '$lib/frontend/serverMessages.server.js';
import { MESSAGE_LIMITS, isSelfAssignableRole, normalizeMessageDoc, type MessageOwner, type MessageScope } from '$lib/messages.js';
import { normalizeMainConfigForPanel } from '$lib/utils/mainConfig.js';
import { agentModel, type AgentAnswer, type AgentPack, type AgentReach, type AgentSession } from './runtime.server.js';

const TRANSLATION_TIMEOUT_MS = 90_000;

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

export function canOpenBuilder(reach: AgentReach, request: MessageRequest | null): boolean {
	return !request && (reach.all || reach.server != null);
}

function listed(messages: { id: number; name: string }[]): string {
	return messages.length > 0 ? messages.map((message) => `- ${message.id}: ${JSON.stringify(message.name)}`).join('\n') : 'None yet.';
}

export async function builderDoorPack(reach: AgentReach, session: AgentSession): Promise<AgentPack> {
	const [serverMessages, globalMessages] = await Promise.all([
		reach.server ? db.getServerMessages(Number(reach.server.id)).catch(() => []) : [],
		reach.all ? db.getGlobalMessages(reach.panelId).catch(() => []) : []
	]);
	const opening = {
		ok: true,
		opening: true,
		note: 'The builder is opening. The request reaches you again there, so only say that you are opening the builder.'
	};

	const instructions = [
		'# Messages',
		'You build and change messages inside the message builder, and it is not open right now. When the admin asks you to write, build, change or translate a message, call open_message_builder. It opens the builder for them and their request reaches you again there, so reply only that you are opening the builder. Never write the message itself in the chat. When they only ask whether you can make messages, say yes and ask what it should say.',
		...(reach.all ? ['A server message belongs to one server. A global message is sent to every server on this panel.'] : []),
		...(reach.server ? [`Saved messages of "${reach.server.name ?? 'this server'}" (id: name):`, listed(serverMessages)] : []),
		...(reach.all ? ['Saved global messages (id: name):', listed(globalMessages)] : [])
	].join('\n');

	return {
		instructions,
		tools: [
			{
				name: 'open_message_builder',
				description:
					'Open the message builder for the admin so a message can be built or changed there. Opens a new message unless message_id names a saved one.',
				parameters: {
					type: 'object',
					properties: {
						message_id: { type: 'integer', description: 'A saved message to open, from the lists you were given. Leave out for a new message.' },
						...(reach.all
							? {
									kind: {
										type: 'string',
										enum: ['server', 'global'],
										description: reach.server ? 'Leave out for a message of the server the admin has open.' : 'Leave out for a global message.'
									},
									server_id: {
										type: 'integer',
										description: 'For kind "server": which server, as a server_id from list_servers. Leave out for the server the admin has open.'
									}
								}
							: {})
					}
				},
				run: async (args) => {
					const messageId = Number(args.message_id);
					if (reach.all && (args.kind === 'global' || (args.kind !== 'server' && args.server_id == null && !reach.server))) {
						session.navigate = `${ADMIN_TAB_PATHS.globalMessages}/${globalMessages.some((message) => message.id === messageId) ? messageId : 'new'}`;
						return opening;
					}

					let server = reach.server;
					let messages = serverMessages;
					if (reach.all && args.server_id != null && Number(args.server_id) !== Number(reach.server?.id)) {
						const other = await db.getServer(Number(args.server_id)).catch(() => null);
						server = other && (await db.getServerPanelId(Number(other.id)).catch(() => null)) === reach.panelId ? other : null;
						messages = server ? await db.getServerMessages(Number(server.id)).catch(() => []) : [];
					}
					if (!server) return { ok: false, reason: 'unknown_server', hint: 'Use a server_id from list_servers, or kind "global".' };

					session.navigate = adminServerSectionPath(
						server.bot_id,
						server.id,
						`messages/${messages.some((message) => message.id === messageId) ? messageId : 'new'}`
					);
					return opening;
				}
			}
		]
	};
}

export async function messageBuilderPack(reach: AgentReach, request: MessageRequest): Promise<AgentPack> {
	const global = request.scope === 'global';
	const owner: MessageOwner = global ? { scope: 'global', id: reach.panelId } : { scope: 'server', id: Number(reach.server.id) };
	const [library, model] = await Promise.all([global ? globalLibrary(reach.panelId) : serverLibrary(reach.server), agentModel(reach.panelId)]);
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
		ownsUpload,
		ask: model ? (system, user) => completeText(model, system, user, TRANSLATION_TIMEOUT_MS) : undefined
	});

	return {
		instructions: pack.instructions,
		tools: pack.tools,
		finish: async (answer) => {
			const verdict = await pack.finish(answer);
			if (verdict.ok) return { ok: true, result: shape(verdict.result) };
			return { ok: false, feedback: verdict.feedback, ...(verdict.fallback ? { fallback: shape(verdict.fallback) } : {}) };
		}
	};
}
