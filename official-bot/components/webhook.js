import { COMMUNICATION } from "../../shared-config.js";
import logger from "../../logger.js";

let webhookServer = null;
let client = null;

async function handleWebhookRequest(req, res) {
    try {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);

                if (payload.type === 'message_forward' && payload.data) {
                    // Import forwarder dynamically to avoid circular dependency
                    const { processMessageFromSelfBot } = await import('./forwarder.js');
                    await processMessageFromSelfBot(payload.data, client);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Message processed' }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid payload format' }));
                }
            } catch (parseErr) {
                await logger.log(`❌ Webhook parse error: ${parseErr.message}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } catch (err) {
        await logger.log(`❌ Webhook error: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
}

function startWebhookServer(discordClient) {
    client = discordClient;

    if (COMMUNICATION.WEBHOOK_URL) {
        const url = new URL(COMMUNICATION.WEBHOOK_URL);
        const port = url.port || 3000;

        // Import http module dynamically
        import('http').then(http => {
            webhookServer = http.createServer(handleWebhookRequest);

            webhookServer.listen(port, () => {
                logger.log(`🌐 Webhook server started on port ${port}`);
                logger.log(`📡 Listening for messages at ${COMMUNICATION.WEBHOOK_URL}`);
            });

            webhookServer.on('error', (err) => {
                logger.log(`❌ Webhook server error: ${err.message}`);
            });
        });
    }
}

function stopWebhookServer() {
    if (webhookServer) {
        webhookServer.close();
        webhookServer = null;
        logger.log(`🛑 Webhook server stopped`);
    }
}

export default {
    startWebhookServer,
    stopWebhookServer
};
