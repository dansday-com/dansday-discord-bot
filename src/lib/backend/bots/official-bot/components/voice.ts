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
	const endpoint = db.botAiVoiceEndpoint(config);
	if (!config.enabled || !config.voice_enabled || !endpoint.api_key || !endpoint.model) return;

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

	if (userId === clientInstance.user?.id) {
		if (!newState.channelId) {
			await active.stop('disconnected');
			return;
		}

		if (newState.channelId !== active.channelId) {
			const inviter = newState.guild?.members?.cache?.get(active.inviterId);
			const target = inviter?.voice?.channelId;

			if (!target) {
				await active.stop('moved_inviter_gone');
				return;
			}

			if (target !== newState.channelId) {
				await logger.log(`🔀 Voice AI was moved, returning to inviter`);
				await active.moveTo(target, inviter.voice.channel?.name);
				return;
			}

			await active.moveTo(newState.channelId, newState.channel?.name);
			return;
		}

		if (newState.serverMute && !oldState.serverMute) await active.ensureUnmuted();
		if (newState.serverDeaf && !oldState.serverDeaf) await active.ensureUndeafened();
		return;
	}

	const left = oldState.channelId === active.channelId && newState.channelId !== active.channelId;
	const joined = newState.channelId === active.channelId && oldState.channelId !== active.channelId;

	if (joined && !newState.member?.user?.bot) {
		active.subscribeUser(userId);
		active.noteJoined(userId);
		return;
	}

	if (!left) return;

	active.unsubscribeUser(userId);
	if (!oldState.member?.user?.bot) active.noteLeft(userId);

	if (userId === active.inviterId) {
		if (newState.channelId) {
			await logger.log('🔀 Voice AI following inviter to new channel');
			await active.moveTo(newState.channelId, newState.channel?.name);
			return;
		}
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
