import { Client } from "discord.js-selfbot-v13";
import { TOKEN } from "./config.js";
import logger from "./logger.js";
import welcoming from "./welcomer.js";
import forwarder from "./forwarder.js";

const client = new Client();

client.on("ready", async () => {
    logger.init(client);
    welcoming.init(client);
    forwarder.init(client);
});

client.login(TOKEN);
