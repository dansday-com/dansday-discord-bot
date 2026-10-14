import { getRedisClient } from '../../../../redis.js';

const CMD_CHANNEL = (botId: number) => `voiceai:${botId}:cmd`;
const STATE_KEY = (botId: number) => `voiceai:${botId}:state`;

export const VOICE_STATE_TTL_SEC = 60;

export type VoiceStateRecord = {
	guildId: string;
	channelId: string;
	channelName: string;
	inviterId: string;
	textChannelId: string | null;
	startedAt: number;
};
export type VoiceCommand =
	{ cmd: 'join'; guildId: string; channelId: string; channelName: string; inviterId: string; textChannelId: string } | { cmd: 'leave'; reason?: string };

export async function readVoiceState(botId: number): Promise<VoiceStateRecord | null> {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) {
		return null;
	}
	try {
		const raw = await redis.get(STATE_KEY(botId));
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export async function writeVoiceState(botId: number, state: VoiceStateRecord) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) {
		return false;
	}
	try {
		await redis.set(STATE_KEY(botId), JSON.stringify(state), { EX: VOICE_STATE_TTL_SEC });
		return true;
	} catch {
		return false;
	}
}

export async function clearVoiceState(botId: number) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) {
		return false;
	}
	try {
		await redis.del(STATE_KEY(botId));
		return true;
	} catch {
		return false;
	}
}

export async function publishVoiceCommand(botId: number, command: VoiceCommand) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) {
		return false;
	}
	try {
		await redis.publish(CMD_CHANNEL(botId), JSON.stringify(command));
		return true;
	} catch {
		return false;
	}
}

export async function subscribeVoiceCommands(botId: number, handler: (command: VoiceCommand) => void) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) {
		return null;
	}

	const subscriber = redis.duplicate();
	await subscriber.connect();
	await subscriber.subscribe(CMD_CHANNEL(botId), (raw) => {
		try {
			handler(JSON.parse(raw));
		} catch {}
	});
	return subscriber;
}
