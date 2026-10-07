import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { MAX_SERVER_MESSAGES, messageButtons, messageSelects, messageSummary } from '$lib/messages.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);
	const [messages, posts] = await Promise.all([db.getServerMessages(serverId).catch(() => []), db.getServerMessagePosts(serverId).catch(() => [])]);

	return {
		serverId,
		limit: MAX_SERVER_MESSAGES,
		messages: messages.map((message) => ({
			id: message.id,
			name: message.name,
			layout: message.content.layout,
			languages: message.content.languages,
			summary: messageSummary(message.content),
			interactive: messageButtons(message.content).some((button) => button.style !== 'link') || messageSelects(message.content).length > 0,
			attachments: message.content.attachments.length,
			updated_at: message.updated_at,
			channels: [...new Set(posts.filter((post) => post.message_id === message.id).map((post) => post.channel_name))]
		}))
	};
};
