import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { DEFAULT_SERVER_LANGUAGE } from '$lib/languages.js';
import { APP_DOMAIN, APP_NAME } from '$lib/frontend/panelServer.js';
import { ADMIN_TAB_PATHS, DASHBOARD_PATH } from '$lib/frontend/redirect.js';
import { MESSAGE_LIMITS, messageUploadLimit } from '$lib/messages.js';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') redirect(302, DASHBOARD_PATH);

	const panelId = Number(locals.user.panel_id);
	const listPath = ADMIN_TAB_PATHS.globalMessages;
	const isNew = params.messageId === 'new';
	const messages = await db.getGlobalMessages(panelId).catch(() => []);
	const current = isNew ? null : (messages.find((message) => message.id === Number(params.messageId)) ?? null);
	if (!isNew && !current) redirect(302, listPath);
	const copy = isNew ? (messages.find((message) => message.id === Number(url.searchParams.get('copy'))) ?? null) : null;

	const [posts, bots] = await Promise.all([
		current ? db.getGlobalMessagePosts(panelId, current.id).catch(() => []) : [],
		db.getAllBots(panelId).catch(() => [])
	]);
	const bot = (bots as any[])[0] ?? null;

	return {
		key: current ? `message-${current.id}` : `new-${copy?.id ?? ''}`,
		scope: 'global' as const,
		apiBase: '/api/admin/messages',
		listPath,
		serverName: 'Your Server',
		uploadLimit: messageUploadLimit(0),
		message: current ? { id: current.id, name: current.name, content: current.content } : null,
		draft: copy ? { name: `${copy.name} copy`.slice(0, MESSAGE_LIMITS.name), content: copy.content } : null,
		messages: messages.map((message) => ({ id: message.id, name: message.name, content: message.content })),
		posts: posts.map((post) => ({
			id: post.id,
			guild_id: post.discord_server_id,
			server_name: post.server_name,
			channel_id: post.discord_channel_id,
			channel_name: post.channel_name,
			discord_message_id: post.discord_message_id,
			language: post.language,
			created_at: post.created_at
		})),
		channels: [],
		categories: [],
		roles: [],
		defaults: { language: DEFAULT_SERVER_LANGUAGE, color: '', footer: `Powered by ${APP_DOMAIN} {year}` },
		bot: { name: String(bot?.name ?? APP_NAME), avatar: bot?.bot_icon ? String(bot.bot_icon) : null },
		emojis: []
	};
};
