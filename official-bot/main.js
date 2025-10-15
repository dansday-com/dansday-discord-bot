import { Client, GatewayIntentBits } from "discord.js";
import { OFFICIAL_BOT_TOKEN } from "../shared-config.js";
import logger from "../logger.js";
import forwarder from "./components/forwarder.js";
import welcomer from "./components/welcomer.js";
import webhook from "./components/webhook.js";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.on("clientReady", async () => {
    console.log(`Official bot logged in as ${client.user.tag}`);
    logger.init(client);
    forwarder.init(client);
    welcomer.init(client);

    // Start webhook server
    webhook.startWebhookServer(client);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down official bot...");
    webhook.stopWebhookServer();
    client.destroy();
    process.exit(0);
});

client.login(OFFICIAL_BOT_TOKEN);
