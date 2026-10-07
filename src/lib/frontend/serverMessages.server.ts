import { json } from '@sveltejs/kit';
import db, { type ServerMessage } from '$lib/database.js';
import { canUseEmbedBuilder } from '$lib/frontend/panelServer.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { postBotWebhook, resolveActiveBotForServer } from '$lib/frontend/public/items/index.js';
import { messageUploadKeys } from '$lib/messages.js';
import { pruneServerMessageFiles } from '$lib/backend/storage/serverMessages.js';

export const BOT_OFFLINE = 'The bot is offline. Start it, then try again.';

type Change = { key: string; before: string | null; after: string | null };

export async function messagePanelAccess(locals: App.Locals, rawServerId: string | undefined): Promise<{ serverId: number; server: any } | Response> {
	if (!locals.user.authenticated) return json({ ok: false, error: 'Authentication required' }, { status: 401 });
	const serverId = parseInt(rawServerId ?? '');
	if (isNaN(serverId)) return json({ ok: false, error: 'Invalid server ID' }, { status: 400 });
	if (!(await canUseEmbedBuilder(locals, serverId))) return json({ ok: false, error: 'Access denied' }, { status: 403 });
	const server = await db.getServer(serverId);
	if (!server) return json({ ok: false, error: 'Server not found' }, { status: 404 });
	return { serverId, server };
}

export async function logMessageAction(locals: App.Locals, serverId: number, action: string, changes: Change[]) {
	await db.createServerPanelLog(serverId, panelActorIds(locals), action, changes).catch(() => null);
}

export async function callMessageBot(server: any, type: string, payload: Record<string, unknown>): Promise<{ running: boolean; body: any }> {
	const bot = await resolveActiveBotForServer(server);
	if (!bot || bot.status !== 'running' || !bot.port || !bot.secret_key) return { running: false, body: null };
	const result = await postBotWebhook(bot, { type, guild_id: server.discord_server_id, server_id: server.id, ...payload });
	return { running: result.status !== 502, body: result.body };
}

export async function syncMessagePosts(server: any, messageId: number, interactive = true) {
	const out = { running: false, updated: [] as string[], removed: 0, failed: [] as string[] };
	const call = await callMessageBot(server, 'server_message_sync', { message_id: messageId, interactive });
	out.running = call.running;
	if (!call.body?.ok) return out;
	for (const result of call.body.results ?? []) {
		if (result.gone) {
			await db.deleteServerMessagePost(server.id, result.post_id).catch(() => null);
			out.removed++;
		} else if (result.ok) out.updated.push(String(result.channel_id));
		else out.failed.push(String(result.error ?? `Could not update the copy in #${result.channel_name}.`));
	}
	return out;
}

export async function pruneMessageFiles(serverId: number, messages?: ServerMessage[]) {
	const all = messages ?? (await db.getServerMessages(serverId).catch(() => null));
	if (!all) return;
	await pruneServerMessageFiles(serverId, new Set(all.flatMap((message) => messageUploadKeys(message.content)))).catch(() => null);
}
