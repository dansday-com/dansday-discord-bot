import { formatTimestamp } from "./utils.js";
import db from "../database/database.js";
import { getBotConfig } from "./config.js";

let clientInstance = null;

async function log(text) {
    const timestamp = formatTimestamp(Date.now(), true);
    const formattedText = `[${timestamp}] ${text}`;

    // Always log to console
    console.log(formattedText);

    // Store in database using bot_id
    try {
        const botConfig = getBotConfig();
        if (!botConfig || !botConfig.id) {
            return;
        }

        // Use the bot's own ID (selfbots and official bots have separate logs)
        const botId = botConfig.id;

        // Store log in database
        try {
            await db.insertBotLog(botId, text);
        } catch (error) {
            // Silently fail database logging to not break the app
            console.error('Failed to store log in database:', error.message);
        }
    } catch (error) {
        // Silently fail to not break the app
        console.error('Logger error:', error.message);
    }
}

function init(client) {
    clientInstance = client;
}

export default {
    init,
    log
};
