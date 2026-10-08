import { json } from '@sveltejs/kit';
import db, { type GlobalMessagePost, type ServerMessage } from '$lib/database.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { postBotWebhook } from '$lib/backend/public/items/index.js';
import { messageUploadKeys } from '$lib/messages.js';
import { pruneMessageFiles } from '$lib/backend/storage/messageFiles.js';

export const GLOBAL_MENTION_GROUPS = ['everyone', 'here', 'admin', 'staff'] as const;

type Change = { key: string; before: string | null; after: string | null };

export function globalPanelAccess(locals: App.Locals): { panelId: number } | Response {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin' || locals.user.account_source !== 'accounts') {
		return json({ ok: false, error: 'Only the panel admin can use global messages.' }, { status: 401 });
	}
	const panelId = Number(locals.user.panel_id);
	if (!Number.isFinite(panelId) || panelId <= 0) return json({ ok: false, error: 'No panel available' }, { status: 404 });
	return { panelId };
}

async function callBots(panelId: number, type: string, payload: Record<string, unknown>) {
	const bots = ((await db.getAllBots(panelId)) ?? []) as any[];
	const running = bots.filter((bot) => bot.status === 'running' && bot.port && bot.secret_key);
	const bodies: any[] = [];
	for (const bot of running) {
		const result = await postBotWebhook(bot, { type, ...payload });
		if (result.body?.ok) bodies.push(result.body);
	}
	return { total: bots.length, offline: bots.length - bodies.length, results: bodies.flatMap((body) => (Array.isArray(body.results) ? body.results : [])) };
}

export async function logGlobalMessageAction(locals: App.Locals, action: string, entries: { serverId: number; changes: Change[] }[]) {
	for (const entry of entries) await db.createServerPanelLog(entry.serverId, panelActorIds(locals), action, entry.changes).catch(() => null);
}

export async function sendGlobalMessage(locals: App.Locals, panelId: number, message: ServerMessage, groups: string[]) {
	const call = await callBots(panelId, 'global_message_send', { message_id: message.id, mention_groups: groups });
	const sent = call.results.filter((r) => r.ok);
	for (const r of sent) {
		await db.addGlobalMessagePost(
			panelId,
			message.id,
			r.server_id,
			String(r.channel_id),
			String(r.message_id),
			String(r.language),
			r.mentions ?? null,
			message.content
		);
	}
	await logGlobalMessageAction(
		locals,
		'message_sent',
		sent.map((r) => ({
			serverId: Number(r.server_id),
			changes: [
				{ key: 'global message sent', before: null, after: String(r.channel_id) },
				...(groups.length > 0 ? [{ key: 'groups pinged', before: null, after: groups.join(', ') }] : [])
			]
		}))
	);
	return {
		bots: call.total,
		offline: call.offline,
		sent: sent.length,
		skipped: call.results.filter((r) => r.skipped).length,
		failed: call.results.filter((r) => !r.ok && !r.skipped).map((r) => `${r.server_name}: ${r.error}`)
	};
}

export async function syncGlobalMessagePosts(
	locals: App.Locals,
	panelId: number,
	message: ServerMessage,
	interactive = true,
	refresh: number[] | 'all' | null = null
) {
	const wanted = Array.isArray(refresh) ? new Set(refresh) : null;
	const posts = (await db.getGlobalMessagePosts(panelId, message.id)).filter((post) => !wanted || wanted.has(post.id));
	const byId = new Map(posts.map((post) => [post.id, post]));
	const call =
		posts.length > 0
			? await callBots(panelId, 'global_message_sync', {
					message_id: message.id,
					interactive,
					refresh: refresh !== null,
					...(wanted ? { post_ids: [...wanted] } : {})
				})
			: { offline: 0, results: [] };
	const updated: GlobalMessagePost[] = [];
	const failed: string[] = [];
	let removed = 0;
	for (const result of call.results) {
		const post = byId.get(Number(result.post_id));
		if (!post) continue;
		if (result.gone) {
			await db.deleteGlobalMessagePost(panelId, post.id).catch(() => null);
			removed++;
		} else if (result.ok) updated.push(post);
		else failed.push(`${post.server_name}: ${result.error ?? 'could not update the copy.'}`);
	}
	if (refresh !== null) {
		await logGlobalMessageAction(
			locals,
			'message_post_updated',
			updated.map((post) => ({
				serverId: post.server_id,
				changes: [{ key: 'global message updated', before: null, after: post.discord_channel_id }]
			}))
		);
	}
	return { total: posts.length, updated: updated.length, removed, failed, unreached: posts.length - call.results.length };
}

export async function removeGlobalMessagePosts(locals: App.Locals, panelId: number, message: ServerMessage, posts: GlobalMessagePost[]) {
	if (posts.length === 0) return { removed: 0, failed: [] as string[], unreached: 0 };
	const byId = new Map(posts.map((post) => [post.id, post]));
	const call = await callBots(panelId, 'global_message_remove_posts', { message_id: message.id, post_ids: posts.map((post) => post.id) });
	const removed: GlobalMessagePost[] = [];
	const failed: string[] = [];
	for (const result of call.results) {
		const post = byId.get(Number(result.post_id));
		if (!post) continue;
		if (!result.ok) {
			failed.push(String(result.error ?? `${post.server_name}: could not remove the copy.`));
			continue;
		}
		await db.deleteGlobalMessagePost(panelId, post.id).catch(() => null);
		removed.push(post);
	}
	await logGlobalMessageAction(
		locals,
		'message_post_removed',
		removed.map((post) => ({
			serverId: post.server_id,
			changes: [{ key: 'global message removed', before: post.discord_channel_id, after: null }]
		}))
	);
	return { removed: removed.length, failed, unreached: posts.length - call.results.length };
}

export async function pruneGlobalMessageFiles(panelId: number, messages?: ServerMessage[]) {
	const all = messages ?? (await db.getGlobalMessages(panelId).catch(() => null));
	const posts = await db.getGlobalMessagePosts(panelId).catch(() => null);
	if (!all || !posts) return;
	const kept = new Set(all.map((message) => message.id));
	const used = [...all.map((message) => message.content), ...posts.flatMap((post) => (post.content && kept.has(post.message_id) ? [post.content] : []))];
	await pruneMessageFiles({ scope: 'global', id: panelId }, new Set(used.flatMap((content) => messageUploadKeys(content)))).catch(() => null);
}
