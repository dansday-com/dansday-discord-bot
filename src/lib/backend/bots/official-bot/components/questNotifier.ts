import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import {
	extractDiscordQuestSummaries,
	fetchQuestsMe,
	getEmbedConfig,
	isComponentFeatureEnabled,
	serverSettingsComponent,
	NOTIFICATIONS,
	type DiscordQuestSummary
} from '../../../config.js';
import { logger } from '../../../../utils/index.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let tickRunning = false;

async function runTickGuarded(client: Client, officialBotId: number) {
	if (tickRunning) {
		await logger.log('⏭️ Quest notifier: previous tick still running — skipping this run');
		return;
	}
	tickRunning = true;
	try {
		await runTick(client, officialBotId);
	} finally {
		tickRunning = false;
	}
}

const POLL_MS = 300_000;
const POLL_JITTER_MS = 60_000;
const QUEST_FETCH_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let cursor = 0;
	const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(null).map(async () => {
		for (;;) {
			const i = cursor++;
			if (i >= items.length) return;
			results[i] = await fn(items[i], i);
		}
	});
	await Promise.all(workers);
	return results;
}

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
	const taskBlock = `• ${(quest.questDescription || quest.taskTypeLabel).slice(0, 1006)} ▶️`.slice(0, 1024);
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

	const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(channel.guild.id, channel.id).catch(() => null);
	await channel.send({
		content: notificationMentions && notificationMentions.length > 0 ? notificationMentions[0] : undefined,
		embeds: [embed],
		components: [row]
	});

	if (notificationMentions && notificationMentions.length > 1) {
		for (let i = 1; i < notificationMentions.length; i++) {
			await channel.send({ content: notificationMentions[i] }).catch(() => null);
		}
	}
}

async function prefetchBotWideQuests(officialBotId: number, httpProxyUrlByServerId: Map<number, string>): Promise<Map<string, string>> {
	const sourceByQuestId = new Map<string, string>();
	const selfbots = await db.getRunningSelfbotsForOfficialBot(officialBotId);
	if (selfbots.length === 0) {
		await logger.log(`⚠️ Quest notifier: bot ${officialBotId} has no running selfbot on any server — relying on stored quests only`);
		return sourceByQuestId;
	}

	const fetched = await mapWithConcurrency(selfbots, QUEST_FETCH_CONCURRENCY, async (selfbot) => {
		const httpProxyUrl = httpProxyUrlByServerId.get(selfbot.server_id) ?? '';
		try {
			return { selfbot, payload: await fetchQuestsMe(selfbot.token, { httpProxyUrl }), error: null as string | null };
		} catch (accErr: any) {
			return { selfbot, payload: null as unknown, error: String(accErr?.message || accErr) };
		}
	});

	const mergedById = new Map<string, DiscordQuestSummary>();
	let okAccounts = 0;

	for (const { selfbot, payload, error } of fetched) {
		if (error !== null) {
			await logger.log(`⚠️ Quest notifier: selfbot "${selfbot.name}" (#${selfbot.id}) quest fetch failed: ${error}`);
			continue;
		}
		okAccounts++;

		for (const raw of (payload as any)?.quests ?? []) {
			const assets = raw?.config?.assets;
			await logger.log(
				`🖼️ Quest ${raw?.id} via #${selfbot.id} assets=${assets ? JSON.stringify(assets) : 'MISSING'} configKeys=${Object.keys(raw?.config ?? {}).join(',')}`
			);
		}

		for (const q of extractDiscordQuestSummaries(payload)) {
			if (mergedById.has(q.id)) continue;
			mergedById.set(q.id, q);
			sourceByQuestId.set(q.id, `#${selfbot.id} ${selfbot.name}`);
			await logger.log(`🖼️ Quest ${q.id} resolved banner=${q.bannerUrl ?? 'null'} thumb=${q.thumbnailUrl ?? 'null'} via #${selfbot.id} ${selfbot.name}`);
		}
	}

	if (okAccounts === 0) {
		await logger.log(`⚠️ Quest notifier: all ${selfbots.length} bot-wide selfbot(s) failed quest fetch — relying on stored quests only`);
		return sourceByQuestId;
	}

	if (mergedById.size > 0) {
		await db.syncBotDiscordQuestsFromApi(officialBotId, [...mergedById.values()]);
	}

	await logger.log(
		`🔮 Quest notifier: prefetched ${mergedById.size} unique quest(s) from ${okAccounts}/${selfbots.length} bot-wide selfbot(s) for bot ${officialBotId}`
	);

	return sourceByQuestId;
}

async function runTick(client: Client, officialBotId: number) {
	const servers = await db.getServersForBot(officialBotId);

	const settingsByServerId = new Map<number, Record<string, unknown>>();
	const httpProxyUrlByServerId = new Map<number, string>();
	for (const server of servers) {
		const settingsRow = await db.getServerSettings(server.id, serverSettingsComponent.discord_quest_notifier).catch(() => null);
		const rawSettings = settingsRow && !Array.isArray(settingsRow) ? settingsRow.settings : null;
		const parsed = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};
		settingsByServerId.set(server.id, parsed);
		if (typeof parsed.http_proxy_url === 'string' && parsed.http_proxy_url.trim()) {
			httpProxyUrlByServerId.set(server.id, parsed.http_proxy_url.trim());
		}
	}

	const sourceByQuestId = await prefetchBotWideQuests(officialBotId, httpProxyUrlByServerId);
	const questSummaries = await db.listActiveBotDiscordQuests(officialBotId);

	const postedTargets = new Set<string>();

	for (const server of servers) {
		const discordGuildId = server.discord_server_id;
		if (!discordGuildId) continue;
		if (!(await isComponentFeatureEnabled(discordGuildId, serverSettingsComponent.discord_quest_notifier))) continue;

		const s = settingsByServerId.get(server.id) ?? {};
		const channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
		if (!channelId) continue;

		const autoQuestEnabled = s.auto_quest !== false;

		if (questSummaries.length === 0) {
			await logger.log(`⚠️ Quest notifier: bot ${officialBotId} has no stored active quests yet — nothing to post for server ${server.id} (${server.name})`);
			continue;
		}

		try {
			await db.linkServerToBotDiscordQuests(
				server.id,
				questSummaries.map((q) => q.id)
			);
			const unpostedIds = new Set(
				await db.listServerDiscordQuestUnpostedIds(
					server.id,
					questSummaries.map((q) => q.id)
				)
			);

			for (const q of questSummaries) {
				if (!unpostedIds.has(q.id)) continue;
				const targetKey = `${discordGuildId}:${channelId}:${q.id}`;
				if (postedTargets.has(targetKey)) {
					await db.claimServerDiscordQuestForPost(server.id, q.id).catch(() => null);
					await logger.log(
						`⏭️ Quest notifier: quest ${q.id} already posted to channel ${channelId} in guild ${discordGuildId} this tick — skipping duplicate server row ${server.id}`
					);
					continue;
				}
				if (!(await db.claimServerDiscordQuestForPost(server.id, q.id))) {
					await logger.log(`⏭️ Quest notifier: quest ${q.id} already claimed for server ${server.id} — skipping duplicate announce`);
					continue;
				}
				postedTargets.add(targetKey);
				try {
					await sendQuestNotificationMessage(client, server.discord_server_id, channelId, q, { autoQuestEnabled });
					await logger.log(
						`🔮 Quest notifier: posted quest "${q.questName}" → channel ${channelId} (${server.name}) discovered via ${sourceByQuestId.get(q.id) ?? 'bot-wide stored quest'}`
					);
				} catch (sendErr: any) {
					postedTargets.delete(targetKey);
					await db.releaseServerDiscordQuestClaim(server.id, q.id).catch(() => null);
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
		runTickGuarded(client, officialBotId)
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
	runTickGuarded(client, officialBotId).catch((err) => logger.log(`❌ Quest notifier tick error: ${err?.message || err}`));
	scheduleNextQuestNotifierTick(client, officialBotId);
}

export function stopQuestNotifier() {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
}

export default { initQuestNotifier, stopQuestNotifier, sendQuestNotificationMessage };
