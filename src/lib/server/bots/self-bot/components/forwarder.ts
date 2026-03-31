import { FORWARDER, COMMUNICATION } from '../../../config.js';
import logger from '../../../logger.js';

async function sendToOfficialBot(messageData: any) {
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
			})
		});

		if (!response.ok) {
			throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
		}

		await logger.log(`📤 Sent message ${messageData.id} to official bot via webhook (${response.status})`);
	} catch (err: any) {
		await logger.log(`❌ Failed to send message ${messageData.id} to official bot: ${err.message}`);
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

	try {
		await sendToOfficialBot(messageData);
		await logger.log(`✅ Forwarded message ${message.id} from channel ${message.channel.id} to official bot`);
	} catch (err: any) {
		await logger.log(`❌ Failed to forward message ${message.id}: ${err.message}`);
		throw err;
	}
}

function init(client: any) {
	client.on('messageCreate', async (message: any) => {
		if (!message.guild) return;

		try {
			const result = await FORWARDER.shouldForwardChannel(message.channel.id, message.guild.id);

			if (!result || !result.shouldForward) return;

			if (result.onlyForwardWhenMentionsSelfBot) {
				const selfBotId = message.client.user?.id;
				const mentionedUsers = message.mentions?.users;
				if (!mentionedUsers || mentionedUsers.size === 0 || !mentionedUsers.has(selfBotId)) return;
			}

			await processMessage(message);
		} catch (err: any) {
			await logger.log(`❌ Error forwarding message ${message.id}: ${err.message}`);
		}
	});
}

export default { init };
