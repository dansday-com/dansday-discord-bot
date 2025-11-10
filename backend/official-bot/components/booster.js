import { BOOSTER, getEmbedConfig } from "../../config.js";
import { EmbedBuilder } from "discord.js";
import logger from "../../logger.js";

async function thankBooster(member, client) {

    const boosterChannelIds = await BOOSTER.getChannels(member.guild.id);

    if (!boosterChannelIds || boosterChannelIds.length === 0) {
        await logger.log(`⚠️ No booster channels configured for ${member.guild.name}, skipping booster message`);
        return;
    }

    const messages = await BOOSTER.getMessages(member.guild.id);

    if (!messages || messages.length === 0) {
        await logger.log(`⚠️ No booster messages configured for ${member.guild.name}, skipping booster message`);
        return;
    }

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const thankMessage = randomMessage.replace("{user}", `<@${member.user.id}>`);
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
            .setTitle("💎 Thank You for Boosting!")
            .setDescription(thankMessage)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields([
                {
                    name: "🚀 Boost Level",
                    value: `Level ${member.guild.premiumTier}`,
                    inline: true
                },
                {
                    name: "✨ Total Boosts",
                    value: `${member.guild.premiumSubscriptionCount || 0}`,
                    inline: true
                },
                {
                    name: "📅 Boosted Since",
                    value: member.premiumSince ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>` : "Just now",
                    inline: false
                }
            ])
            .setFooter({ text: embedConfig.FOOTER })
            .setTimestamp();

            await boosterChannel.send({ embeds: [boosterEmbed] });
            await logger.log(`✅ Thanked booster ${member.user.tag} (${member.user.id}) in ${member.guild.name} (channel: ${boosterChannel.name})`);
        } catch (err) {
            await logger.log(`❌ Failed to thank booster ${member.user.tag} (${member.user.id}) in channel ${boosterChannelId}: ${err.message}`);
        }
    }
}

function init(client) {
    client.on("guildMemberUpdate", async (oldMember, newMember) => {

        const wasBoosting = oldMember.premiumSince !== null;
        const isBoosting = newMember.premiumSince !== null;

        if (!wasBoosting && isBoosting) {
            await thankBooster(newMember, client);
        }
    });

    logger.log("💎 Booster component initialized");
}

export default { init };
