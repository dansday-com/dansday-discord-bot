import { BOOSTER, getEmbedConfig, getBotConfig, isComponentFeatureEnabled, serverSettingsComponent, NOTIFICATIONS } from '../../../config.js';
import { EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../utils/index.js';

function replaceBoosterPlaceholders(message, memberId, serverName, boostLevel, totalBoosts) {
	return message
		.replace(/\{user\}/g, `<@${memberId}>`)
		.replace(/\{server\}/g, serverName || 'Unknown Server')
		.replace(/\{boostLevel\}/g, String(boostLevel))
		.replace(/\{totalBoosts\}/g, String(totalBoosts));
}

async function thankBooster(member, client) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			await logger.log(`⚠️ Bot config not available, skipping booster message`);
			return;
		}

		if (!(await isComponentFeatureEnabled(member.guild.id, serverSettingsComponent.booster))) {
			return;
		}

		const boosterChannelIds = await BOOSTER.getChannels(member.guild.id);

		if (!boosterChannelIds || boosterChannelIds.length === 0) {
			await logger.log(`⚠️ No booster channels configured for ${member.guild.id}, skipping booster message`);
			return;
		}

		try {
			await member.guild.fetch();
		} catch (fetchError) {
			await logger.log(`⚠️ Failed to fetch guild ${member.guild.id} before booster: ${fetchError.message}`);
		}

		const serverData = await db.upsertOfficialServer(botConfig.id, member.guild);
		if (!serverData) {
			await logger.log(`⚠️ Server not found in database for ${member.guild.id}, skipping booster message`);
			return;
		}

		const memberData = await db.upsertMember(serverData.id, member);
		if (!memberData) {
			await logger.log(`⚠️ Member not found in database for ${member.user.id}, skipping booster message`);
			return;
		}

		if (!memberData.display_name && !memberData.username) {
			await logger.log(`⚠️ Member profile incomplete for ${member.user.id}, skipping booster message`);
			return;
		}

		const messages = await BOOSTER.getMessages(member.guild.id);

		if (!messages || messages.length === 0) {
			await logger.log(`⚠️ No booster messages configured for ${member.guild.id}, skipping booster message`);
			return;
		}

		const guildBoostCount = member.guild?.premiumSubscriptionCount ?? (serverData?.total_boosters || 0);
		let guildBoostLevel = 0;
		if (member.guild?.premiumTier) {
			const tierString = String(member.guild.premiumTier);
			if (tierString.includes('TIER_')) {
				const tierMatch = tierString.match(/TIER_(\d+)/);
				if (tierMatch) {
					guildBoostLevel = parseInt(tierMatch[1], 10);
				} else {
					guildBoostLevel = parseInt(tierString, 10) || 0;
				}
			} else {
				guildBoostLevel = parseInt(tierString, 10) || 0;
			}
		} else {
			guildBoostLevel = serverData?.boost_level || 0;
		}

		const randomMessage = messages[Math.floor(Math.random() * messages.length)];
		const serverName = member.guild?.name || serverData?.name || 'Unknown Server';
		const thankMessage = replaceBoosterPlaceholders(randomMessage, member.user.id, serverName, guildBoostLevel, guildBoostCount);
		const embedConfig = await getEmbedConfig(member.guild.id);

		for (const boosterChannelId of boosterChannelIds) {
			const boosterChannel = client.channels.cache.get(boosterChannelId);
			if (!boosterChannel) {
				await logger.log(`❌ Booster channel not found: ${boosterChannelId}`);
				continue;
			}

			try {
				const boosterEmbed = new EmbedBuilder()
					.setColor(embedConfig.COLOR)
					.setTitle('💎 Thank You for Boosting!')
					.setDescription(thankMessage)
					.setThumbnail(memberData.avatar || null)
					.addFields([
						{
							name: '🚀 Boost Level',
							value: `Level ${guildBoostLevel}`,
							inline: true
						},
						{
							name: '✨ Total Boosts',
							value: `${guildBoostCount}`,
							inline: true
						},
						{
							name: '📅 Boosted Since',
							value: (() => {
								if (!memberData.booster_since) return 'Just now';
								let boosterSinceDate;
								if (memberData.booster_since instanceof Date) {
									boosterSinceDate = memberData.booster_since;
								} else {
									boosterSinceDate = parseMySQLDateTimeUtc(memberData.booster_since);
								}
								return boosterSinceDate ? `<t:${Math.floor(boosterSinceDate.getTime() / 1000)}:R>` : 'Just now';
							})(),
							inline: false
						}
					])
					.setFooter({ text: embedConfig.FOOTER })
					.setTimestamp();

				const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(member.guild.id, boosterChannelId).catch(() => null);
				await boosterChannel.send({
					content: notificationMentions && notificationMentions.length > 0 ? notificationMentions[0] : undefined,
					embeds: [boosterEmbed]
				});

				if (notificationMentions && notificationMentions.length > 1) {
					for (let i = 1; i < notificationMentions.length; i++) {
						await boosterChannel.send({ content: notificationMentions[i] }).catch(() => null);
					}
				}
				const memberName = memberData.display_name || memberData.username;
				await logger.log(`✅ Thanked booster ${memberName} (${member.user.id}) in ${serverData.name} (channel: ${boosterChannel.name})`);
			} catch (err) {
				await logger.log(`❌ Failed to thank booster ${member.user.id} in channel ${boosterChannelId}: ${err.message}`);
			}
		}
	} catch (err) {
		await logger.log(`❌ Failed to thank booster ${member.user.id}: ${err.message}`);
	}
}

function init(client) {
	client.on('guildMemberUpdate', async (oldMember, newMember) => {
		try {
			const botConfig = getBotConfig();
			if (!botConfig || !botConfig.id) {
				return;
			}

			const wasBoosting = oldMember.premiumSince !== null;
			const isBoosting = newMember.premiumSince !== null;

			if (!wasBoosting && isBoosting) {
				const serverData = await db.upsertOfficialServer(botConfig.id, newMember.guild);
				if (serverData) {
					await db.upsertMember(serverData.id, newMember);
				}
				await thankBooster(newMember, client);
			} else if (wasBoosting && !isBoosting) {
				const serverData = await db.upsertOfficialServer(botConfig.id, newMember.guild);
				if (serverData) {
					await db.upsertMember(serverData.id, newMember);
				}
			}
		} catch (err) {
			await logger.log(`❌ Error handling booster update: ${err.message}`);
		}
	});
}

export default { init };
