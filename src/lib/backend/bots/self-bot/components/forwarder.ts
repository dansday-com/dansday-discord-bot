import { FORWARDER, COMMUNICATION } from '../../../config.js';
import { forwarderKeywordHaystack, forwarderKeywordsMatch } from '../../../../forwarder-settings.js';
import { logger } from '../../../../utils/index.js';

const WEBHOOK_TIMEOUT_MS = 10_000;

async function sendToOfficialBot(messageData: any) {
	const startedAt = Date.now();
	try {
		const response = await fetch(COMMUNICATION.WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'GO-BLOX-SelfBot/1.0.0',
				'X-Secret-Key': COMMUNICATION.SECRET_KEY
			},
			body: JSON.stringify({
				type: 'message_forward',
				data: messageData,
				timestamp: Date.now()
			}),
			signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
		});

		if (!response.ok) {
			throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
		}

		const lag = Date.now() - messageData.createdTimestamp;
		await logger.log(
			`📤 Sent message ${messageData.id} to official bot (${response.status}, webhook ${Date.now() - startedAt}ms, ${lag}ms after it was posted)`
		);
	} catch (err: any) {
		await logger.log(`❌ Failed to send message ${messageData.id} to official bot after ${Date.now() - startedAt}ms: ${err.message}`);
	}
}

async function processMessage(message: any) {
	const mentionedUserIds = message.mentions?.users ? [...message.mentions.users.keys()] : [];
	const messageData = {
		id: message.id,
		content: message.content,
		author: {
			id: message.author.id,
			username: message.author.username,
			displayName: message.author.displayName,
			discriminator: message.author.discriminator,
			avatar: message.author.avatar,
			bot: message.author.bot
		},
		selfbot_user_id: message.client.user?.id,
		channel: { id: message.channel.id, name: message.channel.name },
		guild: { id: message.guild?.id, name: message.guild?.name },
		createdTimestamp: message.createdTimestamp,
		editedTimestamp: message.editedTimestamp,
		attachments: message.attachments.map((att: any) => ({
			id: att.id,
			name: att.name,
			url: att.url,
			size: att.size,
			contentType: att.contentType
		})),
		embeds: message.embeds,
		mentioned_user_ids: mentionedUserIds,
		timestamp: Date.now()
	};

	sendToOfficialBot(messageData).catch((err: any) => logger.log(`❌ Failed to forward message ${message.id}: ${err?.message || err}`));
}

function init(client: any) {
	client.on('messageCreate', async (message: any) => {
		if (!message.guild) return;

		try {
			const result = await FORWARDER.shouldForwardChannel(message.channel.id, message.guild.id);

			if (!result || !result.shouldForward) return;

			const candidates = Array.isArray((result as any).matches) && (result as any).matches.length > 0 ? (result as any).matches : [result];
			const haystack = forwarderKeywordHaystack(message.content, message.embeds);
			const selfBotId = message.client.user?.id;
			const mentionedUsers = message.mentions?.users;
			const mentionsSelfBot = !!mentionedUsers && mentionedUsers.size > 0 && mentionedUsers.has(selfBotId);

			const accepted = candidates.some((candidate: any) => {
				if (candidate.onlyForwardWhenMentionsSelfBot && !mentionsSelfBot) return false;
				return forwarderKeywordsMatch(candidate.keywords, haystack);
			});
			if (!accepted) return;

			await processMessage(message);
		} catch (err: any) {
			await logger.log(`❌ Error forwarding message ${message.id}: ${err.message}`);
		}
	});
}

export default { init };
