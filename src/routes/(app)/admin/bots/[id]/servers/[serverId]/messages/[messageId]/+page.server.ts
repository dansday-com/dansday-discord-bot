import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { adminServerSectionPath } from '$lib/frontend/redirect.js';
import { callMessageBot } from '$lib/frontend/serverMessages.server.js';
import { MESSAGE_LIMITS, messageUploadLimit } from '$lib/messages.js';
import { normalizeMainConfigForPanel } from '$lib/utils/mainConfig.js';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);
	const listPath = adminServerSectionPath(params.id, params.serverId, 'messages');
	const isNew = params.messageId === 'new';
	const messages = await db.getServerMessages(serverId).catch(() => []);
	const current = isNew ? null : (messages.find((message) => message.id === Number(params.messageId)) ?? null);
	if (!isNew && !current) redirect(302, listPath);
	const copy = isNew ? (messages.find((message) => message.id === Number(url.searchParams.get('copy'))) ?? null) : null;

	const { overview } = await parent();
	const guildId = String((overview as any).discord_server_id);
	const [channels, categories, roles, mainRow, posts, server] = await Promise.all([
		db.getChannelsForServer(serverId).catch(() => []),
		db.getCategoriesForServer(serverId).catch(() => []),
		db.getRoles(serverId).catch(() => []),
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null),
		current ? db.getServerMessagePosts(serverId, current.id).catch(() => []) : [],
		db.getServer(serverId).catch(() => null)
	]);
	const bot = (overview as any).bot_id != null ? await db.getBot((overview as any).bot_id).catch(() => null) : null;
	const emojis = server ? await callMessageBot(server, 'server_message_emojis', {}).catch(() => null) : null;
	const main = normalizeMainConfigForPanel(mainRow?.settings ?? {});

	return {
		key: current ? `message-${current.id}` : `new-${copy?.id ?? ''}`,
		scope: 'server' as const,
		apiBase: `/api/servers/${serverId}/messages`,
		listPath,
		serverName: String((overview as any).name ?? 'Server'),
		uploadLimit: messageUploadLimit((overview as any).boost_level),
		message: current ? { id: current.id, name: current.name, content: current.content } : null,
		draft: copy ? { name: `${copy.name} copy`.slice(0, MESSAGE_LIMITS.name), content: copy.content } : null,
		messages: messages.map((message) => ({ id: message.id, name: message.name, content: message.content })),
		posts: posts.map((post) => ({
			id: post.id,
			guild_id: guildId,
			server_name: null,
			channel_id: post.discord_channel_id,
			channel_name: post.channel_name,
			discord_message_id: post.discord_message_id,
			language: post.language,
			created_at: post.created_at
		})),
		channels: channels ?? [],
		categories: categories ?? [],
		roles: (roles as any[])
			.filter((role) => String(role.discord_role_id) !== guildId)
			.map((role) => ({
				id: String(role.discord_role_id),
				name: String(role.name ?? 'Unnamed role'),
				color: role.color != null ? String(role.color) : null,
				position: role.position != null ? Number(role.position) : null
			})),
		defaults: { language: main.language, color: main.color, footer: main.footer },
		bot: {
			name: main.bot_nickname || String(bot?.name ?? 'Bot'),
			avatar: main.bot_avatar_url || (bot?.bot_icon ? String(bot.bot_icon) : null)
		},
		emojis: (Array.isArray(emojis?.body?.emojis) ? emojis.body.emojis : []) as { id: string; name: string; animated: boolean }[]
	};
};
