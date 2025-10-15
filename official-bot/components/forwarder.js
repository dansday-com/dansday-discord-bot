import { FORWARDER, EMBED } from "../../config.js";
import logger from "../../logger.js";

export async function processMessageFromSelfBot(messageData, client) {
    const { group, type } = messageData.forwarderConfig;

    const targetChannelId = FORWARDER.TARGET_CHANNELS[group][type];
    const roleMention = FORWARDER.ROLE_MENTIONS[group];
    const targetChannel = client.channels.cache.get(targetChannelId);

    if (!targetChannel) {
        await logger.log(`❌ Target channel not found for ${group} (${type}): ${targetChannelId}`);
        return;
    }

    try {
        let embeds = [];

        // Check if the original message has embeds
        if (messageData.embeds && messageData.embeds.length > 0) {
            // Forward the original embeds
            embeds = messageData.embeds;

            // Add a small footer to indicate it's forwarded
            embeds.forEach(embed => {
                if (!embed.footer) {
                    embed.footer = {};
                }
                embed.footer.text = `From ${messageData.guild.name} • ${messageData.channel.name}`;
            });
        } else {
            // Create our own embed for regular messages
            const embed = {
                color: EMBED.COLOR,
                title: `Message from ${messageData.channel.name}`,
                description: messageData.content || (messageData.attachments && messageData.attachments.length > 0 ? "" : "*No content*"),
                author: {
                    name: messageData.author.displayName || `${messageData.author.username}#${messageData.author.discriminator}`,
                    icon_url: messageData.author.avatar ?
                        `https://cdn.discordapp.com/avatars/${messageData.author.id}/${messageData.author.avatar}.png` :
                        `https://cdn.discordapp.com/embed/avatars/${parseInt(messageData.author.discriminator) % 5}.png`
                },
                timestamp: new Date(messageData.createdTimestamp).toISOString(),
                footer: {
                    text: `Server: ${messageData.guild.name}`
                }
            };

            // Handle attachments - display all attachments directly
            if (messageData.attachments && messageData.attachments.length > 0) {
                const firstAttachment = messageData.attachments[0];

                // Display the first attachment directly in the embed
                embed.image = {
                    url: firstAttachment.url
                };

                // Add additional attachments as fields if there are more than one
                if (messageData.attachments.length > 1) {
                    embed.fields = [{
                        name: "Additional Attachments",
                        value: messageData.attachments.slice(1).map(att => `[${att.name}](${att.url})`).join('\n'),
                        inline: false
                    }];
                }
            }

            embeds = [embed];
        }

        // Send the message with role mention in content (embeds don't support role mentions)
        await targetChannel.send({
            content: roleMention,
            embeds: embeds
        });

        await logger.log(`✅ Forwarded ${messageData.id} from ${group} (${type})`);
    } catch (err) {
        await logger.log(`❌ Failed to forward ${messageData.id}: ${err.message}`);
        throw err; // Re-throw to indicate failure
    }
}


function init(client) {
    logger.log("📡 Using webhook communication - file polling disabled");
}

export default { init };
