import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import {
	extractDiscordQuestSummaries,
	fetchQuestsMe,
	getEmbedConfig,
	isComponentFeatureEnabled,
	serverSettingsComponent,
	type DiscordQuestSummary
} from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import { serverTranslator } from '../i18n.js';
import { questRewardText, questTaskText } from './questText.js';
import { sendWithNotifiedMentions } from './notifiedMentions.js';
import { SECOND_MS } from '../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../discordLimits.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let isTickRunning = false;

async function runTickGuarded(client: Client, officialBotId: number) {
	if (isTickRunning) {
		await logger.log('⏭️ Quest notifier: previous tick still running — skipping this run');
		return;
	}
	isTickRunning = true;
	try {
		await runTick(client, officialBotId);
	} finally {
		isTickRunning = false;
	}
}

const POLL_MS = 300_000;
const POLL_JITTER_MS = 60_000;
const QUEST_FETCH_CONCURRENCY = 4;
const REWARDS_TEXT_MAX_LENGTH = 1008;
const TASK_TEXT_MAX_LENGTH = 1006;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let cursor = 0;
	const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(null).map(async () => {
		for (;;) {
			const i = cursor++;
			if (i >= items.length) {
				return;
			}
			results[i] = await fn(items[i], i);
		}
	});
	await Promise.all(workers);
	return results;
}

function discordTs(iso: string | undefined | null, style: 'R'): string {
	if (!iso) {
		return '—';
	}
	const t = Date.parse(iso);
	if (!Number.isFinite(t)) {
		return '—';
	}
	return `<t:${Math.floor(t / SECOND_MS)}:${style}>`;
}

type QuestDelivery = { guildId: string; channelId: string; quest: DiscordQuestSummary; opts?: { test?: boolean } };

export async function sendQuestNotificationMessage(client: Client, { guildId, channelId, quest, opts }: QuestDelivery) {
	const guild = await client.guilds.fetch(guildId).catch(() => null);
	if (!guild) {
		throw new Error('Guild not found');
	}
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) {
		throw new Error('Channel not found or not text-based');
	}

	const embedConfig = await getEmbedConfig(guildId);
	const tr = await serverTranslator(guildId);
	const rewardsCore = questRewardText(tr, quest.reward);
	const rewardsBlock = `${rewardsCore.slice(0, REWARDS_TEXT_MAX_LENGTH)} 🔮`.slice(0, DISCORD_LIMITS.EMBED_FIELD_VALUE);
	const taskBlock = `• ${questTaskText(tr, quest.questDescription || quest.taskTypeLabel, quest.taskTypeKey).slice(0, TASK_TEXT_MAX_LENGTH)} ▶️`.slice(
		0,
		DISCORD_LIMITS.EMBED_FIELD_VALUE
	);
	const expiresBlock = quest.expiresAt && Number.isFinite(Date.parse(quest.expiresAt)) ? discordTs(quest.expiresAt, 'R') : '—';

	const fields: { name: string; value: string; inline?: boolean }[] = [
		{ name: tr('questNotifier.fields.rewards'), value: rewardsBlock, inline: false },
		{ name: tr('questNotifier.fields.tasks'), value: taskBlock, inline: false },
		{
			name: tr('questNotifier.fields.game'),
			value: (quest.gameSubtitle || quest.gameTitle || '—').slice(0, DISCORD_LIMITS.EMBED_FIELD_VALUE),
			inline: true
		}
	];
	const pub = typeof quest.publisher === 'string' ? quest.publisher.trim() : '';
	if (pub) {
		fields.push({ name: tr('questNotifier.fields.publisher'), value: pub.slice(0, DISCORD_LIMITS.EMBED_FIELD_VALUE), inline: true });
	}

	fields.push({ name: tr('questNotifier.fields.expires'), value: expiresBlock.slice(0, DISCORD_LIMITS.EMBED_FIELD_VALUE), inline: true });

	const embed = new EmbedBuilder().setColor(embedConfig.COLOR).setTitle(`🔮 ${quest.questName}`.slice(0, DISCORD_LIMITS.EMBED_TITLE)).addFields(fields);

	const thumb = quest.thumbnailUrl?.trim();
	const banner = quest.bannerUrl?.trim();
	if (thumb?.startsWith('http')) {
		embed.setThumbnail(thumb);
	}
	if (banner?.startsWith('http')) {
		embed.setImage(banner);
	}

	const footerParts = [quest.publisher, embedConfig.FOOTER].filter((x) => typeof x === 'string' && x.trim().length > 0) as string[];
	embed.setFooter({ text: footerParts.join(' · ').slice(0, DISCORD_LIMITS.EMBED_FOOTER) });

	const startMs = quest.startsAt && Number.isFinite(Date.parse(quest.startsAt)) ? Date.parse(quest.startsAt) : Date.now();
	embed.setTimestamp(startMs);

	if (opts?.test) {
		embed.setDescription(tr('questNotifier.test'));
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setURL(quest.questUrl)
			.setLabel(tr('questNotifier.openInDiscord').slice(0, DISCORD_LIMITS.BUTTON_LABEL))
			.setEmoji('🖥️')
	);

	await sendWithNotifiedMentions(channel, { embeds: [embed], components: [row] });
}

async function prefetchBotWideQuests(officialBotId: number): Promise<Map<string, string>> {
	const sourceByQuestId = new Map<string, string>();
	const selfbots = await db.getRunningSelfbotsForOfficialBot(officialBotId);
	if (selfbots.length === 0) {
		await logger.log(`⚠️ Quest notifier: bot ${officialBotId} has no running selfbot in its panel — relying on stored quests only`);
		return sourceByQuestId;
	}

	const fetched = await mapWithConcurrency(selfbots, QUEST_FETCH_CONCURRENCY, async (selfbot) => {
		try {
			return { selfbot, payload: await fetchQuestsMe(selfbot.token as string), error: null as string | null };
		} catch (accErr) {
			return { selfbot, payload: null as unknown, error: String((accErr as Error)?.message || accErr) };
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

		for (const q of extractDiscordQuestSummaries(payload)) {
			if (mergedById.has(q.id)) {
				continue;
			}
			mergedById.set(q.id, q);
			sourceByQuestId.set(q.id, `#${selfbot.id} ${selfbot.name}`);
		}
	}

	if (okAccounts === 0) {
		await logger.log(`⚠️ Quest notifier: all ${selfbots.length} panel selfbot(s) failed quest fetch — relying on stored quests only`);
		return sourceByQuestId;
	}

	if (mergedById.size > 0) {
		await db.syncBotDiscordQuestsFromApi(officialBotId, [...mergedById.values()]);
	}

	await logger.log(
		`🔮 Quest notifier: prefetched ${mergedById.size} unique quest(s) from ${okAccounts}/${selfbots.length} panel selfbot(s) for bot ${officialBotId}`
	);

	return sourceByQuestId;
}

async function runTick(client: Client, officialBotId: number) {
	const servers = await db.getServersForBot(officialBotId);

	const settingsByServerId = new Map<number, Record<string, unknown>>();
	for (const server of servers) {
		const settingsRow = await db.getServerSettings(server.id, serverSettingsComponent.discord_quest_notifier).catch(() => null);
		const rawSettings = settingsRow && !Array.isArray(settingsRow) ? settingsRow.settings : null;
		settingsByServerId.set(server.id, rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {});
	}

	const sourceByQuestId = await prefetchBotWideQuests(officialBotId);
	const questSummaries = await db.listActiveBotDiscordQuests(officialBotId);

	const postedTargets = new Set<string>();

	for (const server of servers) {
		const discordGuildId = server.discord_server_id;
		if (!discordGuildId) {
			continue;
		}
		if (!(await isComponentFeatureEnabled(discordGuildId, serverSettingsComponent.discord_quest_notifier))) {
			continue;
		}

		const s = settingsByServerId.get(server.id) ?? {};
		const channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
		if (!channelId) {
			continue;
		}

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
				if (!unpostedIds.has(q.id)) {
					continue;
				}
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
					await sendQuestNotificationMessage(client, { guildId: server.discord_server_id, channelId, quest: q });
					await logger.log(
						`🔮 Quest notifier: posted quest "${q.questName}" → channel ${channelId} (${server.name}) discovered via ${sourceByQuestId.get(q.id) ?? 'bot-wide stored quest'}`
					);
				} catch (sendErr) {
					postedTargets.delete(targetKey);
					await db.releaseServerDiscordQuestClaim(server.id, q.id).catch(() => null);
					await logger.log(`❌ Quest notifier: failed to post quest ${q.id} for server ${server.id}: ${(sendErr as Error)?.message || sendErr}`);
				}
			}
		} catch (e) {
			await logger.log(`⚠️ Quest notifier tick failed for server ${server.id} (${server.name}): ${(e as Error)?.message || e}`);
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
