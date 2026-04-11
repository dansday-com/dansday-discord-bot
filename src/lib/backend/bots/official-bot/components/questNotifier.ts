import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { getEmbedConfig, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import { extractDiscordQuestSummaries, fetchQuestsMe, type DiscordQuestSummary } from '../../../api/discord-quest-api.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;

const POLL_MS = 60_000;
const POLL_JITTER_MS = 15_000;

function discordTs(iso: string | undefined | null, style: 'R'): string {
	if (!iso) return '—';
	const t = Date.parse(iso);
	if (!Number.isFinite(t)) return '—';
	return `<t:${Math.floor(t / 1000)}:${style}>`;
}

export async function sendQuestNotificationMessage(
	client: Client,
	guildId: string,
	channelId: string,
	quest: DiscordQuestSummary,
	opts?: { test?: boolean; autoQuestEnabled?: boolean }
) {
	const guild = await client.guilds.fetch(guildId).catch(() => null);
	if (!guild) throw new Error('Guild not found');
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text-based');

	const embedConfig = await getEmbedConfig(guildId);
	const rewardsCore = quest.reward || '• Quest reward';
	const rewardsBlock = `${rewardsCore.slice(0, 1008)} 🔮`.slice(0, 1024);
	const taskBlock = `• ${(quest.taskDetailLine || quest.taskTypeLabel).slice(0, 1006)} ▶️`.slice(0, 1024);
	const expiresBlock = quest.expiresAt && Number.isFinite(Date.parse(quest.expiresAt)) ? discordTs(quest.expiresAt, 'R') : '—';

	const fields: { name: string; value: string; inline?: boolean }[] = [
		{ name: 'Rewards', value: rewardsBlock, inline: false },
		{ name: 'Tasks', value: taskBlock, inline: false },
		{
			name: '🎮 Game',
			value: (quest.gameSubtitle || quest.gameTitle || '—').slice(0, 1024),
			inline: true
		}
	];
	const pub = typeof quest.publisher === 'string' ? quest.publisher.trim() : '';
	if (pub) fields.push({ name: '🏢 Publisher', value: pub.slice(0, 1024), inline: true });

	fields.push({ name: '⏳ Expires', value: expiresBlock.slice(0, 1024), inline: true });

	const embed = new EmbedBuilder().setColor(embedConfig.COLOR).setTitle(`🔮 ${quest.questName}`.slice(0, 256)).addFields(fields);

	const thumb = quest.thumbnailUrl?.trim();
	const banner = quest.bannerUrl?.trim();
	if (thumb?.startsWith('http')) embed.setThumbnail(thumb);
	if (banner?.startsWith('http')) embed.setImage(banner);

	const footerParts = [quest.publisher, embedConfig.FOOTER].filter((x) => typeof x === 'string' && x.trim().length > 0) as string[];
	embed.setFooter({ text: footerParts.join(' · ').slice(0, 2048) });

	const startMs = quest.startsAt && Number.isFinite(Date.parse(quest.startsAt)) ? Date.parse(quest.startsAt) : Date.now();
	embed.setTimestamp(startMs);

	if (opts?.test) {
		embed.setDescription('_Test notification — notifier is working._');
	}

	const buttons = [new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(quest.questUrl).setLabel('Open in Discord').setEmoji('🖥️')];

	if (opts?.autoQuestEnabled !== false) {
		const enrollCustomId = `quest_enroll:${quest.id}`.slice(0, 100);
		buttons.push(new ButtonBuilder().setCustomId(enrollCustomId).setStyle(ButtonStyle.Primary).setLabel('Enroll').setEmoji('⚠️'));
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);

	await channel.send({ embeds: [embed], components: [row] });
}

async function runTick(client: Client, officialBotId: number) {
	const servers = await db.getServersForBot(officialBotId);

	for (const server of servers) {
		const discordGuildId = server.discord_server_id;
		if (!discordGuildId) continue;
		if (!(await isComponentFeatureEnabled(discordGuildId, serverSettingsComponent.discord_quest_notifier))) continue;

		const row = await db.getServerSettings(server.id, serverSettingsComponent.discord_quest_notifier).catch(() => null);
		const rawSettings = row && !Array.isArray(row) ? row.settings : null;
		const s = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};
		const channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
		if (!channelId) continue;

		const selfbot = await db.getFirstRunningSelfbotForServer(server.id);
		if (!selfbot?.token) continue;

		const httpProxyUrl = typeof s.http_proxy_url === 'string' ? s.http_proxy_url : '';
		const autoQuestEnabled = s.auto_quest !== false;

		try {
			const payload = await fetchQuestsMe(selfbot.token, { httpProxyUrl });
			const questSummaries = extractDiscordQuestSummaries(payload);
			if (questSummaries.length === 0) continue;

			await db.syncServerDiscordQuestsFromApi(officialBotId, server.id, questSummaries);
			const unpostedIds = new Set(
				await db.listServerDiscordQuestUnpostedIds(
					server.id,
					questSummaries.map((q) => q.id)
				)
			);

			for (const q of questSummaries) {
				if (!unpostedIds.has(q.id)) continue;
				try {
					await sendQuestNotificationMessage(client, server.discord_server_id, channelId, q, { autoQuestEnabled });
					await db.markServerDiscordQuestMessagePosted(server.id, q.id);
					await logger.log(`🔮 Quest notifier: posted quest "${q.questName}" → channel ${channelId} (${server.name})`);
				} catch (sendErr: any) {
					await logger.log(`❌ Quest notifier: failed to post quest ${q.id} for server ${server.id}: ${sendErr?.message || sendErr}`);
				}
			}
		} catch (e: any) {
			await logger.log(`⚠️ Quest notifier tick failed for server ${server.id} (${server.name}): ${e?.message || e}`);
		}
	}
}

function scheduleNextQuestNotifierTick(client: Client, officialBotId: number) {
	const delay = POLL_MS + Math.floor(Math.random() * POLL_JITTER_MS);
	tickTimeoutRef = setTimeout(() => {
		runTick(client, officialBotId)
			.catch((err) => logger.log(`❌ Quest notifier tick error: ${err?.message || err}`))
			.finally(() => scheduleNextQuestNotifierTick(client, officialBotId));
	}, delay);
}

export function initQuestNotifier(client: Client, officialBotId: number | null) {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
	if (!officialBotId) {
		logger.log('Quest notifier: no official bot id, skipping');
		return;
	}
	runTick(client, officialBotId).catch((err) => logger.log(`❌ Quest notifier tick error: ${err?.message || err}`));
	scheduleNextQuestNotifierTick(client, officialBotId);
}

export function stopQuestNotifier() {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
}

export default { initQuestNotifier, stopQuestNotifier, sendQuestNotificationMessage };
