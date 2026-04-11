import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client } from 'discord.js';
import { runQuestUserAutomation } from '../../../../discord-quest-api.js';
import { getEmbedConfig } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import db from '../../../../database.js';

const activeEnrollUsers = new Set<string>();

export function isUserEnrollRunning(requesterId: string): boolean {
	return activeEnrollUsers.has(requesterId);
}

export type QuestEnrollJob = {
	client: Client;
	channelId: string;
	guildId: string;
	questId: string;
	requesterTag: string;
	requesterId: string;
	userToken: string;
	httpProxyUrl?: string | null;
	serverId: number;
	memberId: number;
};

export function queueQuestEnrollJob(job: QuestEnrollJob): void {
	activeEnrollUsers.add(job.requesterId);
	void runQuestEnrollJob(job).finally(() => activeEnrollUsers.delete(job.requesterId));
}

async function runQuestEnrollJob(job: QuestEnrollJob): Promise<void> {
	const { client, channelId, guildId, questId, requesterTag, requesterId, serverId, memberId } = job;
	try {
		const result = await runQuestUserAutomation(job.userToken, questId, { httpProxyUrl: job.httpProxyUrl });
		const channel = await client.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {
			await logger.log(`⚠️ Quest enroll: channel ${channelId} missing for result embed`);
			return;
		}
		if (result.ok) {
			await db.markServerMemberDiscordQuestClaimed(serverId, memberId, questId).catch(() => null);
		}
		const embedConfig = await getEmbedConfig(guildId);
		const embed = new EmbedBuilder()
			.setColor(result.ok ? embedConfig.COLOR : 0xed4245)
			.setTitle(result.title)
			.setDescription(result.description)
			.addFields(
				{ name: 'Member', value: `<@${requesterId}>`, inline: false },
				{ name: 'Reward', value: (result.rewardLine || '—').slice(0, 1024), inline: false }
			)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(result.questUrl).setLabel('Open in Discord').setEmoji('🖥️')
		);
		await channel.send({ embeds: [embed], components: [row] });
		await logger.log(`🔮 Quest enroll job finished (${result.ok ? 'ok' : 'fail'}) quest ${questId} user ${requesterId}`);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		await logger.log(`❌ Quest enroll job error: ${msg}`);
		try {
			const channel = await client.channels.fetch(channelId).catch(() => null);
			if (channel?.isTextBased()) {
				const embedConfig = await getEmbedConfig(guildId);
				await channel.send({
					embeds: [
						new EmbedBuilder()
							.setColor(0xed4245)
							.setTitle('Quest enroll error')
							.setDescription(`<@${requesterId}> (${requesterTag})\n${msg.slice(0, 3500)}`)
							.setFooter({ text: embedConfig.FOOTER })
							.setTimestamp()
					]
				});
			}
		} catch {}
	}
}
