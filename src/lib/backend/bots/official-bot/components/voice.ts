import { getBotConfig } from '../../../config.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { subscribeVoiceCommands, clearVoiceState } from './voiceControl.js';
import { createVoiceSession } from './voiceSession.js';

let active = null;
let clientInstance = null;

async function handleJoin(command) {
	if (active) return;

	const botConfig = getBotConfig();
	if (!botConfig?.id) return;

	const config = db.botAiFromDbRow(await db.getBotAiByBotId(botConfig.id));
	if (!config.enabled || !config.voice_enabled || !config.api_key || !config.voice_model) return;

	const session = createVoiceSession({
		client: clientInstance,
		config,
		botId: botConfig.id,
		guildId: command.guildId,
		channelId: command.channelId,
		channelName: command.channelName,
		inviterId: command.inviterId,
		textChannelId: command.textChannelId,
		onEnded: () => {
			active = null;
		}
	});

	active = session;

	try {
		await session.start();
	} catch (error) {
		active = null;
		await clearVoiceState(botConfig.id);
		await logger.log(`❌ Voice AI join failed: ${error.message}`);
	}
}

async function handleVoiceStateUpdate(oldState, newState) {
	if (!active) return;

	const userId = oldState.id ?? newState.id;
	const left = oldState.channelId === active.channelId && newState.channelId !== active.channelId;
	const joined = newState.channelId === active.channelId && oldState.channelId !== active.channelId;

	if (joined && userId !== clientInstance.user?.id && !newState.member?.user?.bot) {
		active.subscribeUser(userId);
		return;
	}

	if (!left) return;

	active.unsubscribeUser(userId);

	if (userId === active.inviterId) {
		await active.stop('inviter_left');
		return;
	}

	const channel = newState.guild?.channels?.cache?.get(active.channelId) ?? oldState.guild?.channels?.cache?.get(active.channelId);
	const humans = [...(channel?.members ?? [])].filter(([, m]) => !m.user.bot).length;
	if (humans === 0) await active.stop('channel_empty');
}

async function init(client) {
	clientInstance = client;

	const botConfig = getBotConfig();
	if (!botConfig?.id) return;

	await clearVoiceState(botConfig.id);

	const subscriber = await subscribeVoiceCommands(botConfig.id, (command) => {
		if (command.cmd === 'join') handleJoin(command).catch(() => {});
		if (command.cmd === 'leave' && active) active.stop(command.reason || 'user_request').catch(() => {});
	});

	if (!subscriber) {
		await logger.log('⚠️ Voice AI disabled: Redis is required for voice control');
		return;
	}

	client.on('voiceStateUpdate', (oldState, newState) => {
		handleVoiceStateUpdate(oldState, newState).catch(() => {});
	});
}

export default { init };
