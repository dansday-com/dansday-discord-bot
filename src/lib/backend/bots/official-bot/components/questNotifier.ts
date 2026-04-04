import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { getEmbedConfig } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import { extractOrbQuests, fetchQuestsMe, type QuestOrbSummary } from '../../../../discord-quest-api.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;

const POLL_MS = 60_000;
const POLL_JITTER_MS = 15_000;

export async function sendQuestNotificationMessage(client: Client, guildId: string, channelId: string, quest: QuestOrbSummary, opts?: { test?: boolean }) {
	const guild = await client.guilds.fetch(guildId).catch(() => null);
	if (!guild) throw new Error('Guild not found');
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text-based');

	const embedConfig = await getEmbedConfig(guildId);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(quest.questName)
		.setDescription(`**Type:** ${quest.taskTypeLabel}\n**${quest.gameTitle}**\n${quest.description}${opts?.test ? '\n\n*(test — notifier is working)*' : ''}`)
		.setURL(quest.questUrl)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(quest.questUrl).setLabel('Open quest'));

	await channel.send({ embeds: [embed], components: [row] });
}

async function runTick(client: Client, officialBotId: number) {
	const servers = await db.getServersForBot(officialBotId);

	for (const server of servers) {
		const row = await db.getServerSettings(server.id, 'discord_quest_notifier').catch(() => null);
		const s = row?.settings && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};
		const enabled = s.enabled === true;
		const channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
		if (!enabled || !channelId) continue;

		const selfbot = await db.getFirstRunningSelfbotForServer(server.id);
		if (!selfbot?.token) continue;

		const httpProxyUrl = typeof s.http_proxy_url === 'string' ? s.http_proxy_url : '';

		try {
			const payload = await fetchQuestsMe(selfbot.token, { httpProxyUrl });
			const orbQuests = extractOrbQuests(payload);
			if (orbQuests.length === 0) continue;

			const known = new Set(await db.listServerDiscordOrbQuestIds(server.id));

			if (known.size === 0) {
				await db.baselineServerDiscordOrbEntries(
					server.id,
					orbQuests.map((q) => ({
						discord_quest_id: q.id,
						quest_task_type: q.taskTypeKey,
						quest_task_label: q.taskTypeLabel
					}))
				);
				continue;
			}

			const newOnes = orbQuests.filter((q) => !known.has(q.id));
			for (const q of newOnes) {
				try {
					await sendQuestNotificationMessage(client, server.discord_server_id, channelId, q);
					await db.insertServerDiscordOrbNotified(server.id, q.id, q.taskTypeKey, q.taskTypeLabel);
					await logger.log(`🔮 Quest notifier: posted orb quest "${q.questName}" → channel ${channelId} (${server.name})`);
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
	logger.log(
		`🔮 Quest notifier: sequential polls ~${POLL_MS / 1000}s + up to ${POLL_JITTER_MS / 1000}s jitter; optional per-server HTTP proxy in Discord Quest notifier settings`
	);
}

export function stopQuestNotifier() {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
}

export default { initQuestNotifier, stopQuestNotifier, sendQuestNotificationMessage };
