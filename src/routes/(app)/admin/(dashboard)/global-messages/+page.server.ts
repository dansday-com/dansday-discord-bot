import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
import { MAX_SAVED_MESSAGES, messageButtons, messageSelects, messageSummary } from '$lib/messages.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') redirect(302, DASHBOARD_PATH);

	const panelId = Number(locals.user.panel_id);
	const [messages, posts] = await Promise.all([db.getGlobalMessages(panelId).catch(() => []), db.getGlobalMessagePosts(panelId).catch(() => [])]);

	return {
		limit: MAX_SAVED_MESSAGES,
		messages: messages.map((message) => {
			const servers = new Set(posts.filter((post) => post.message_id === message.id).map((post) => post.server_id)).size;
			return {
				id: message.id,
				name: message.name,
				layout: message.content.layout,
				languages: message.content.languages,
				summary: messageSummary(message.content),
				interactive: messageButtons(message.content).some((button) => button.style !== 'link') || messageSelects(message.content).length > 0,
				attachments: message.content.attachments.length,
				updated_at: message.updated_at,
				posted: servers > 0 ? `${servers} ${servers === 1 ? 'server' : 'servers'}` : ''
			};
		})
	};
};
