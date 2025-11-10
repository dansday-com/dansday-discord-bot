import { formatTimestamp } from "./utils.js";
import { getLoggerChannel } from "./config.js";

let logChannel = null;
let logChannelId = null;
let clientInstance = null;
let hasPermission = true;
let permissionWarningShown = false;

async function log(text, guildId = null) {

    if (guildId && clientInstance) {
        try {
            const serverLoggerChannelId = await getLoggerChannel(guildId);
            if (serverLoggerChannelId) {
                const serverLogChannel = clientInstance.channels.cache.get(serverLoggerChannelId);
                if (serverLogChannel) {
                    try {
                        const timestamp = formatTimestamp(Date.now(), true);
                        await serverLogChannel.send(`[${timestamp}] ${text}`);
                        return;
                    } catch (err) {

                    }
                }
            }
        } catch (error) {

        }
    }

    if (!logChannel || !hasPermission) {

        const timestamp = formatTimestamp(Date.now(), true);
        console.log(`[${timestamp}] ${text}`);
        return;
    }

    try {
        const timestamp = formatTimestamp(Date.now(), true);
        await logChannel.send(`[${timestamp}] ${text}`);
    } catch (err) {

        if (err.code === 50001 || err.code === 50013) {

            hasPermission = false;
        }

        const timestamp = formatTimestamp(Date.now(), true);
        console.log(`[${timestamp}] ${text}`);
    }
}

function init(client, channelId = null) {

    clientInstance = client;

    if (!channelId) {
        return;
    }

    logChannel = client.channels.cache.get(channelId);
    logChannelId = channelId;
    if (!logChannel) {
        hasPermission = false;
        return;
    }

    try {

        if (logChannel.guild && logChannel.permissionsFor && client.user) {
            const permissions = logChannel.permissionsFor(client.user);
            if (permissions && !permissions.has('SendMessages')) {
                hasPermission = false;
            }
        }
    } catch (permErr) {

        hasPermission = true;
    }
}

export default {
    init,
    log
};
