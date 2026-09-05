import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client } from 'discord.js';
import { getEmbedConfig, runQuestUserAutomation, type QuestAutomationResult } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import db from '../../../../database.js';

const activeEnrollUsers = new Set<string>();

const CLAIM_ALL_QUEST_GAP_MS = 5_000;

export function isUserEnrollRunning(requesterId: string): boolean {
	return activeEnrollUsers.has(requesterId);
}

export type QuestEnrollJob = {
	client: Client;
	channelId: string | null;
	guildId: string;
	questId: string;
	requesterTag: string;
	requesterId: string;
	userToken: string;
	httpProxyUrl?: string | null;
	serverId: number;
	memberId: number;
};

export type QuestClaimAllJob = Omit<QuestEnrollJob, 'questId'> & { questIds: string[] };

export function queueQuestEnrollJob(job: QuestEnrollJob): void {
	activeEnrollUsers.add(job.requesterId);
	void runQuestEnrollJob(job).finally(() => activeEnrollUsers.delete(job.requesterId));
}

export function queueQuestClaimAllJob(job: QuestClaimAllJob): void {
	activeEnrollUsers.add(job.requesterId);
	void runQuestClaimAllJob(job).finally(() => activeEnrollUsers.delete(job.requesterId));
}

async function textChannelForJob(client: Client, channelId: string | null) {
	if (!channelId) return null;
	const channel = await client.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) {
		await logger.log(`⚠️ Quest enroll: channel ${channelId} missing for result embed`);
		return null;
	}
	return channel;
}

async function postQuestResult(job: QuestEnrollJob | QuestClaimAllJob, result: QuestAutomationResult): Promise<void> {
	const channel = await textChannelForJob(job.client, job.channelId);
	if (!channel) return;
	const embedConfig = await getEmbedConfig(job.guildId);
	const embed = new EmbedBuilder()
		.setColor(result.ok ? embedConfig.COLOR : 0xed4245)
		.setTitle(result.title)
		.setDescription(result.description)
		.addFields({ name: 'Reward', value: (result.rewardLine || '—').slice(0, 1024), inline: false })
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(result.questUrl).setLabel('Open in Discord').setEmoji('🖥️')
	);
	await channel.send({ content: `<@${job.requesterId}>`, embeds: [embed], components: [row] });
}

async function postQuestError(job: QuestEnrollJob | QuestClaimAllJob, questId: string, message: string): Promise<void> {
	const channel = await textChannelForJob(job.client, job.channelId);
	if (!channel) return;
	const embedConfig = await getEmbedConfig(job.guildId);
	await channel.send({
		content: `<@${job.requesterId}>`,
		embeds: [
			new EmbedBuilder()
				.setColor(0xed4245)
				.setTitle('Quest enroll error')
				.setDescription(`<@${job.requesterId}> (${job.requesterTag})\nQuest \`${questId}\`\n${message.slice(0, 3400)}`)
				.setFooter({ text: embedConfig.FOOTER })
				.setTimestamp()
		]
	});
}

async function enrollOneQuest(job: QuestEnrollJob | QuestClaimAllJob, questId: string): Promise<boolean> {
	try {
		const result = await runQuestUserAutomation(job.userToken, questId, { httpProxyUrl: job.httpProxyUrl });
		if (result.ok) {
			await db.markServerMemberDiscordQuestClaimed(job.serverId, job.memberId, questId).catch(() => null);
		}
		await postQuestResult(job, result);
		await logger.log(`🔮 Quest enroll job finished (${result.ok ? 'ok' : 'fail'}) quest ${questId} user ${job.requesterId}`);
		return result.ok;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		await logger.log(`❌ Quest enroll job error on quest ${questId}: ${msg}`);
		await postQuestError(job, questId, msg).catch(() => null);
		return false;
	}
}

async function runQuestEnrollJob(job: QuestEnrollJob): Promise<void> {
	await enrollOneQuest(job, job.questId);
}

async function runQuestClaimAllJob(job: QuestClaimAllJob): Promise<void> {
	let okCount = 0;
	for (let i = 0; i < job.questIds.length; i++) {
		const questId = job.questIds[i];
		if (await enrollOneQuest(job, questId)) okCount++;
		if (i < job.questIds.length - 1) await new Promise((resolve) => setTimeout(resolve, CLAIM_ALL_QUEST_GAP_MS));
	}
	await logger.log(`🔮 Quest claim all finished for user ${job.requesterId}: ${okCount}/${job.questIds.length} quest(s) claimed`);
}
