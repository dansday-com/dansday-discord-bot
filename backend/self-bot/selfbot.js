import { Client } from "discord.js-selfbot-v13";
import { SELF_BOT_TOKEN } from "../config.js";
import logger from "../logger.js";
import forwarder from "./components/forwarder.js";

const client = new Client();

client.on("ready", async () => {
    console.log(`Self-bot logged in as ${client.user.tag}`);
    logger.init(client);
    forwarder.init(client);
});

client.login(SELF_BOT_TOKEN);
