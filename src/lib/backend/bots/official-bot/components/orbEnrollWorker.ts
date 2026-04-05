import { EmbedBuilder, type Client } from 'discord.js';
import { runOrbQuestUserAutomation } from '../../../../discord-quest-api.js';
import { getEmbedConfig } from '../../../config.js';
import { logger } from '../../../../utils/index.js';

export type OrbEnrollJob = {
	client: Client;
	channelId: string;
	guildId: string;
	questId: string;
	requesterTag: string;
	requesterId: string;
	userToken: string;
	httpProxyUrl?: string | null;
};

/** Fire-and-forget background run; token is not written to the database. */
export function queueOrbEnrollJob(job: OrbEnrollJob): void {
	void runOrbEnrollJob(job);
}

async function runOrbEnrollJob(job: OrbEnrollJob): Promise<void> {
	const { client, channelId, guildId, questId, requesterTag, requesterId } = job;
	try {
		const result = await runOrbQuestUserAutomation(job.userToken, questId, { httpProxyUrl: job.httpProxyUrl });
		const channel = await client.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {
			await logger.log(`⚠️ Orb enroll: channel ${channelId} missing for result embed`);
			return;
		}
		const embedConfig = await getEmbedConfig(guildId);
		const embed = new EmbedBuilder()
			.setColor(result.ok ? embedConfig.COLOR : 0xed4245)
			.setTitle(result.title)
			.setDescription(`${result.description}\n\n[Quest link](${result.questUrl})`)
			.addFields(
				{ name: 'Member', value: `<@${requesterId}> (${requesterTag})`, inline: false },
				{ name: 'Reward', value: (result.orbLine || '—').slice(0, 1024), inline: false }
			)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();
		await channel.send({ embeds: [embed] });
		await logger.log(`🔮 Orb enroll job finished (${result.ok ? 'ok' : 'fail'}) quest ${questId} user ${requesterId}`);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		await logger.log(`❌ Orb enroll job error: ${msg}`);
		try {
			const channel = await client.channels.fetch(channelId).catch(() => null);
			if (channel?.isTextBased()) {
				const embedConfig = await getEmbedConfig(guildId);
				await channel.send({
					embeds: [
						new EmbedBuilder()
							.setColor(0xed4245)
							.setTitle('Orb enroll error')
							.setDescription(`<@${requesterId}> (${requesterTag})\n${msg.slice(0, 3500)}`)
							.setFooter({ text: embedConfig.FOOTER })
							.setTimestamp()
					]
				});
			}
		} catch {
			/* ignore */
		}
	}
}
