import { Client } from 'discord.js-selfbot-v13';
import { getBotToken, initializeConfig } from '../../config.js';
import { logger } from '../../../utils/index.js';
import { applySelfbotDiscordPresenceFromDb } from './applySelfbotDiscordPresence.js';
import forwarder from './components/forwarder.js';
import sync from './components/sync.js';

const PRESENCE_POLL_MS = 30_000;
let presencePollTimer: ReturnType<typeof setInterval> | null = null;

let BOT_TOKEN: string | undefined;
(async () => {
	await initializeConfig();
	BOT_TOKEN = getBotToken('selfbot');
})().catch((err: Error) => {
	logger.error('Failed to initialize config', { error: String(err?.message || err) });
	process.exit(1);
});

const BOT_ID = process.env.BOT_ID;
const client = new Client();

client.on('ready', async () => {
	logger.info('Self-bot logged in', { userTag: (client.user as any)?.tag });

	if (!BOT_TOKEN) {
		await initializeConfig();
		BOT_TOKEN = getBotToken('selfbot');
	}

	if (!BOT_TOKEN) throw new Error('Bot token not available. Cannot proceed.');

	await sync.init(client, BOT_ID);
	logger.init(client);
	forwarder.init(client);

	const presenceId = BOT_ID ? Number(BOT_ID) : NaN;
	if (Number.isFinite(presenceId)) {
		await applySelfbotDiscordPresenceFromDb(client, presenceId);
		if (presencePollTimer) clearInterval(presencePollTimer);
		presencePollTimer = setInterval(() => {
			applySelfbotDiscordPresenceFromDb(client, presenceId).catch(() => {});
		}, PRESENCE_POLL_MS);
	}
});

function shutdown() {
	logger.warn('Shutting down self-bot');
	if (presencePollTimer) {
		clearInterval(presencePollTimer);
		presencePollTimer = null;
	}
	client.destroy();
	process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async () => {
	if (!BOT_TOKEN) {
		await initializeConfig();
		BOT_TOKEN = getBotToken('selfbot');
	}

	if (!BOT_TOKEN) throw new Error('Bot token not available. Cannot login.');

	await client.login(BOT_TOKEN);
})().catch((err: Error) => {
	logger.error('Failed to login self-bot', { error: String(err?.message || err) });
	process.exit(1);
});
