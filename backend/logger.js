import { formatTimestamp } from "./utils.js";
import db from "../database/database.js";
import { getBotConfig } from "./config.js";

let clientInstance = null;

async function log(text) {
    const timestamp = formatTimestamp(Date.now(), true);
    const formattedText = `[${timestamp}] ${text}`;

    // Try to store in database first
    try {
        const botConfig = getBotConfig();
        if (!botConfig || !botConfig.id) {
            // Fallback to console if bot config not available
            console.log(formattedText);
            return;
        }

        // Use the bot's own ID (selfbots and official bots have separate logs)
        const botId = botConfig.id;

        // Store log in database
        try {
            await db.insertBotLog(botId, text);
            // Success - no console output needed
        } catch (error) {
            // Database failed - fallback to console
            console.log(formattedText);
            console.error('Failed to store log in database:', error.message);
        }
    } catch (error) {
        // Error getting bot config - fallback to console
        console.log(formattedText);
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
