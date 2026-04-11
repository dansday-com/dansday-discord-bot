import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { randomBytes } from 'crypto';
import { logger } from '$lib/utils/index.js';
import { request as httpRequest } from 'http';
import { messageFromBotWebhookPayload } from '$lib/utils/configPrerequisiteErrors.js';

async function canManageAccounts(locals: App.Locals, serverId: number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') {
		const { accountOwnsServer } = await import('$lib/frontend/panelServer.js');
		return accountOwnsServer(locals, serverId);
	}
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	const serverId = Number(params.id);

	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'staff') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}
	if (!(await canManageAccounts(locals, serverId))) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const account_type = (body.account_type === 'owner' || body.account_type === 'staff' ? body.account_type : null) as 'owner' | 'staff' | null;

	const rawMulti = body.discord_member_ids;
	const singleId = body.discord_member_id;
	let discord_member_ids: string[] = [];
	if (Array.isArray(rawMulti)) {
		discord_member_ids = rawMulti.map((x: unknown) => String(x ?? '').trim()).filter((id) => id.length >= 5);
	} else if (singleId != null && String(singleId).trim().length >= 5) {
		discord_member_ids = [String(singleId).trim()];
	}

	discord_member_ids = [...new Set(discord_member_ids)];

	const validTypes = locals.user.account_source === 'accounts' ? ['owner', 'staff'] : ['staff'];
	if (!account_type || !validTypes.includes(account_type)) {
		return json({ success: false, error: `Valid account type required: ${validTypes.join(', ')}` }, { status: 400 });
	}

	if (discord_member_ids.length === 0) {
		return json({ success: false, error: 'Provide discord_member_id or discord_member_ids[]' }, { status: 400 });
	}

	if (discord_member_ids.length > 50) {
		return json({ success: false, error: 'At most 50 members per request' }, { status: 400 });
	}

	const server = await db.getServer(serverId);
	if (!server) return json({ success: false, error: 'Server not found' }, { status: 404 });

	const officialBotId = await db.resolveOfficialBotIdForServer(server);
	const bot = officialBotId ? await db.getBot(officialBotId) : null;
	if (!bot) return json({ success: false, error: 'Bot not found' }, { status: 404 });
	if (bot.status !== 'running') return json({ success: false, error: 'Bot is not running' }, { status: 400 });
	if (!bot.port || !bot.secret_key) return json({ success: false, error: 'Bot webhook not configured' }, { status: 400 });

	type Fail = { discord_member_id: string; error: string };
	const failed: Fail[] = [];
	let lastInviteUrl: string | null = null;
	let lastToken: string | null = null;

	for (const discord_member_id of discord_member_ids) {
		const member = await db.getMemberByDiscordId(serverId, discord_member_id);
		if (!member) {
			failed.push({ discord_member_id, error: 'Member not found (sync may be required)' });
			continue;
		}

		const token = randomBytes(32).toString('hex');

		await db.createServerAccountInvite({
			token,
			server_id: serverId,
			account_type
		});

		const inviteUrl = `${url.origin}/register?token=${token}`;
		const displayName = member.server_display_name || member.display_name || member.username || 'there';
		const serverName = server.name || 'this server';
		const embed_title = "You're invited";
		const embed_description = `Hi ${displayName}! You've been invited to join **${serverName}** as **${account_type}**.\n\n**Register:** ${inviteUrl}`;

		const payload = JSON.stringify({
			type: 'send_dm',
			guild_id: server.discord_server_id,
			user_id: discord_member_id,
			embed_title,
			embed_description
		});

		const result = await new Promise<{ status: number; body: any }>((resolve) => {
			const options = {
				hostname: 'localhost',
				port: bot.port as number,
				path: '/',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(payload),
					'X-Secret-Key': bot.secret_key as string
				}
			};

			const req = httpRequest(options, (res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					try {
						resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
					} catch {
						resolve({ status: 500, body: { error: 'Failed to parse bot response' } });
					}
				});
			});
			req.on('error', (err) => {
				logger.log(`❌ Error calling bot webhook (send_dm): ${err.message}`);
				resolve({ status: 500, body: { error: 'Failed to communicate with bot' } });
			});
			req.write(payload);
			req.end();
		});

		if (result.status === 200 && result.body.success) {
			logger.log(`${locals.user.username} sent server invite DM to ${discord_member_id} (${account_type}) for server ${serverId}`);
			lastInviteUrl = inviteUrl;
			lastToken = token;
		} else {
			const errMsg = messageFromBotWebhookPayload(result.body);
			failed.push({ discord_member_id, error: errMsg });
		}
	}

	const sentCount = discord_member_ids.length - failed.length;

	if (sentCount === 0) {
		const first = failed[0];
		return json({ success: false, error: first?.error ?? 'All invites failed', failed }, { status: 400 });
	}

	return json({
		success: true,
		sent_count: sentCount,
		failed,
		invite_link: discord_member_ids.length === 1 && sentCount === 1 ? lastInviteUrl : null,
		token: discord_member_ids.length === 1 && sentCount === 1 ? lastToken : null
	});
};
