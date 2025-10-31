import { EmbedBuilder } from "discord.js";
import { MAIN_CHANNEL, EMBED } from "../../config.js";
import logger from "../../logger.js";

async function sendModerationLog(client, embedData) {
    const channel = client.channels.cache.get(MAIN_CHANNEL);
    if (!channel) {
        await logger.log(`❌ Main channel not found: ${MAIN_CHANNEL}`);
        return;
    }

    try {
        const embed = new EmbedBuilder()
            .setColor(EMBED.COLOR)
            .setTitle(embedData.title)
            .setDescription(embedData.description)
            .setTimestamp()
            .setFooter({ text: embedData.guildName || "Moderation Log" });

        if (embedData.thumbnail) {
            embed.setThumbnail(embedData.thumbnail);
        }

        if (embedData.fields && embedData.fields.length > 0) {
            embed.addFields(embedData.fields);
        }

        await channel.send({ embeds: [embed] });
        await logger.log(`✅ Sent moderation log: ${embedData.title} for ${embedData.userTag || "unknown"}`);
    } catch (err) {
        await logger.log(`❌ Failed to send moderation log: ${err.message}`);
    }
}

// Get audit log entry for moderation actions
async function getAuditLogEntry(guild, action, targetId) {
    try {
        const auditLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: action
        });

        const entry = auditLogs.entries.first();
        if (entry && entry.target.id === targetId) {
            return entry;
        }
        return null;
    } catch (err) {
        await logger.log(`⚠️ Could not fetch audit log for ${action}: ${err.message}`);
        return null;
    }
}

// Get timeout audit log entry (searches recent entries with retry)
async function getTimeoutAuditLogEntry(guild, targetId, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // Small delay before checking audit logs (Discord needs time to create the entry)
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            }

            const auditLogs = await guild.fetchAuditLogs({
                limit: 20, // Increased from 10 to catch more entries
                type: 24 // MEMBER_UPDATE
            });

            const now = Date.now();
            
            // Find the most recent entry for this user within the last 15 seconds
            // Check if the changes include communication_disabled_until (timeout)
            for (const entry of auditLogs.entries.values()) {
                if (entry.target.id === targetId) {
                    const entryAge = now - entry.createdTimestamp;
                    // Only return entries from the last 15 seconds
                    if (entryAge < 15000) {
                        // Verify this is a timeout action by checking changes
                        const changes = entry.changes;
                        if (changes && changes.length > 0) {
                            const timeoutChange = changes.find(
                                change => change.key === 'communication_disabled_until'
                            );
                            if (timeoutChange && timeoutChange.new) {
                                await logger.log(`✅ Found timeout audit log for ${targetId} on attempt ${attempt + 1}`);
                                return entry;
                            }
                        } else {
                            // If no changes recorded but it's recent, assume it's the timeout action
                            await logger.log(`✅ Found timeout audit log (no changes) for ${targetId} on attempt ${attempt + 1}`);
                            return entry;
                        }
                    }
                }
            }
            
            if (attempt === retries - 1) {
                await logger.log(`⚠️ Could not find timeout audit log for ${targetId} after ${retries} attempts`);
            }
        } catch (err) {
            await logger.log(`⚠️ Error fetching timeout audit log (attempt ${attempt + 1}): ${err.message}`);
            if (attempt === retries - 1) {
                return null;
            }
        }
    }
    return null;
}

// Format duration in a human-readable way
function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} day${days !== 1 ? "s" : ""}`;
    } else if (hours > 0) {
        return `${hours} hour${hours !== 1 ? "s" : ""}`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else {
        return `${seconds} second${seconds !== 1 ? "s" : ""}`;
    }
}

function init(client) {
    // Track bans
    client.on("guildBanAdd", async (ban) => {
        try {
            const { guild, user } = ban;
            const auditEntry = await getAuditLogEntry(guild, 22, user.id); // 22 = MEMBER_BAN_ADD

            const moderator = auditEntry?.executor || null;
            const reason = ban.reason || auditEntry?.reason || "No reason provided";

            await sendModerationLog(client, {
                title: "🔨 Member Banned",
                description: `<@${user.id}> has been banned from the server.`,
                thumbnail: user.displayAvatarURL({ dynamic: true, size: 256 }),
                guildName: guild.name,
                userTag: user.tag,
                fields: [
                    {
                        name: "👤 User",
                        value: user.tag,
                        inline: true
                    },
                    {
                        name: "🛡️ Moderator",
                        value: moderator ? moderator.tag : "Unknown",
                        inline: true
                    },
                    {
                        name: "📝 Reason",
                        value: reason.length > 1024 ? reason.substring(0, 1021) + "..." : reason,
                        inline: false
                    }
                ]
            });
        } catch (err) {
            await logger.log(`❌ Error handling ban: ${err.message}`);
        }
    });

    // Track unbans
    client.on("guildBanRemove", async (ban) => {
        try {
            const { guild, user } = ban;
            const auditEntry = await getAuditLogEntry(guild, 23, user.id); // 23 = MEMBER_BAN_REMOVE

            const moderator = auditEntry?.executor || null;

            await sendModerationLog(client, {
                title: "✅ Member Unbanned",
                description: `<@${user.id}> has been unbanned from the server.`,
                thumbnail: user.displayAvatarURL({ dynamic: true, size: 256 }),
                guildName: guild.name,
                userTag: user.tag,
                fields: [
                    {
                        name: "👤 User",
                        value: user.tag,
                        inline: true
                    },
                    {
                        name: "🛡️ Moderator",
                        value: moderator ? moderator.tag : "Unknown",
                        inline: true
                    }
                ]
            });
        } catch (err) {
            await logger.log(`❌ Error handling unban: ${err.message}`);
        }
    });

    // Track timeouts and kicks (via member update/remove)
    client.on("guildMemberUpdate", async (oldMember, newMember) => {
        try {
            // Ensure we have fresh member data
            try {
                if (!oldMember.partial) await oldMember.fetch();
                if (!newMember.partial) await newMember.fetch();
            } catch (err) {
                await logger.log(`⚠️ Could not fetch member data: ${err.message}`);
            }

            const wasTimedOut = oldMember.communicationDisabledUntil !== null;
            const isTimedOut = newMember.communicationDisabledUntil !== null;

            // Member was just timed out
            if (!wasTimedOut && isTimedOut) {
                await logger.log(`⏰ Timeout detected for ${newMember.user.tag} (${newMember.user.id})`);
                
                const timeoutUntil = newMember.communicationDisabledUntil;
                if (!timeoutUntil) {
                    await logger.log(`⚠️ Timeout detected but communicationDisabledUntil is null for ${newMember.user.id}`);
                    return;
                }

                const timeoutDuration = timeoutUntil.getTime() - Date.now();
                if (timeoutDuration <= 0) {
                    await logger.log(`⚠️ Timeout duration is invalid (${timeoutDuration}ms) for ${newMember.user.id}`);
                    return;
                }

                const durationText = formatDuration(timeoutDuration);

                // Get timeout audit log entry (searches recent entries with retry)
                const auditEntry = await getTimeoutAuditLogEntry(newMember.guild, newMember.id, 3);
                const moderator = auditEntry?.executor || null;
                const reason = auditEntry?.reason || "No reason provided";

                await sendModerationLog(client, {
                    title: "⏰ Member Timed Out",
                    description: `<@${newMember.user.id}> has been timed out.`,
                    thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
                    guildName: newMember.guild.name,
                    userTag: newMember.user.tag,
                    fields: [
                        {
                            name: "👤 User",
                            value: newMember.user.tag,
                            inline: true
                        },
                        {
                            name: "🛡️ Moderator",
                            value: moderator ? moderator.tag : "Unknown",
                            inline: true
                        },
                        {
                            name: "⏱️ Duration",
                            value: durationText,
                            inline: true
                        },
                        {
                            name: "📅 Until",
                            value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`,
                            inline: true
                        },
                        {
                            name: "📝 Reason",
                            value: reason.length > 1024 ? reason.substring(0, 1021) + "..." : reason,
                            inline: false
                        }
                    ]
                });

                await logger.log(`✅ Timeout log sent for ${newMember.user.tag} (${newMember.user.id})`);
            }
            // Member timeout was removed
            else if (wasTimedOut && !isTimedOut) {
                await sendModerationLog(client, {
                    title: "✅ Timeout Removed",
                    description: `<@${newMember.user.id}>'s timeout has been removed.`,
                    thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
                    guildName: newMember.guild.name,
                    userTag: newMember.user.tag,
                    fields: [
                        {
                            name: "👤 User",
                            value: newMember.user.tag,
                            inline: true
                        }
                    ]
                });
            }
        } catch (err) {
            await logger.log(`❌ Error handling member update: ${err.message}`);
        }
    });

    // Track kicks (member removed but not banned)
    client.on("guildMemberRemove", async (member) => {
        try {
            // Check if it was a ban (ban event fires before remove, so we check audit logs)
            const banEntry = await getAuditLogEntry(member.guild, 22, member.user.id); // 22 = MEMBER_BAN_ADD

            // If there's a recent ban entry (within last 5 seconds), it's a ban, not a kick
            if (banEntry && Date.now() - banEntry.createdTimestamp < 5000) {
                return; // Ban event will handle this
            }

            // Check for kick in audit logs
            const kickEntry = await getAuditLogEntry(member.guild, 20, member.user.id); // 20 = MEMBER_KICK

            // Only log if it's a kick (has kick audit entry) or if we can't determine (assume kick)
            const moderator = kickEntry?.executor || null;
            const reason = kickEntry?.reason || "No reason provided";

            await sendModerationLog(client, {
                title: "👢 Member Kicked",
                description: `<@${member.user.id}> has been kicked from the server.`,
                thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
                guildName: member.guild.name,
                userTag: member.user.tag,
                fields: [
                    {
                        name: "👤 User",
                        value: member.user.tag,
                        inline: true
                    },
                    {
                        name: "🛡️ Moderator",
                        value: moderator ? moderator.tag : "Unknown",
                        inline: true
                    },
                    {
                        name: "📝 Reason",
                        value: reason.length > 1024 ? reason.substring(0, 1021) + "..." : reason,
                        inline: false
                    },
                    {
                        name: "📅 Member Since",
                        value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown",
                        inline: false
                    }
                ]
            });
        } catch (err) {
            await logger.log(`❌ Error handling member remove: ${err.message}`);
        }
    });

    logger.log("🛡️ Moderation component initialized");
}

export default { init };
