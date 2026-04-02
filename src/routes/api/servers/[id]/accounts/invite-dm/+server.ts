import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import logger from '$lib/server/logger.js';
import { randomBytes } from 'crypto';
import { addMinutesToNow, toMySQLDateTime } from '$lib/server/utils.js';
import { request as httpRequest } from 'http';

function canManageAccounts(locals: App.Locals, serverId: number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	const serverId = Number(params.id);

	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	// Moderators must never be able to invite via DM
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'moderator') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}
	if (!canManageAccounts(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const account_type = (body.account_type === 'owner' || body.account_type === 'moderator' ? body.account_type : null) as 'owner' | 'moderator' | null;
	const discord_member_id = String(body.discord_member_id || '');

	const validTypes = locals.user.account_source === 'accounts' ? ['owner', 'moderator'] : ['moderator'];
	if (!account_type || !validTypes.includes(account_type)) {
		return json({ success: false, error: `Valid account type required: ${validTypes.join(', ')}` }, { status: 400 });
	}

	if (!discord_member_id || discord_member_id.length < 5) {
		return json({ success: false, error: 'Valid discord_member_id required' }, { status: 400 });
	}

	const server = await db.getServer(serverId);
	if (!server) return json({ success: false, error: 'Server not found' }, { status: 404 });

	const member = await db.getMemberByDiscordId(serverId, discord_member_id);
	if (!member) return json({ success: false, error: 'Member not found (sync may be required)' }, { status: 404 });

	const bot = await db.getBot(server.bot_id);
	if (!bot) return json({ success: false, error: 'Bot not found' }, { status: 404 });
	if (bot.status !== 'running') return json({ success: false, error: 'Bot is not running' }, { status: 400 });
	if (!bot.port || !bot.secret_key) return json({ success: false, error: 'Bot webhook not configured' }, { status: 400 });

	const token = randomBytes(32).toString('hex');
	const expiresAt = toMySQLDateTime(addMinutesToNow(10));

	await db.createServerAccountInvite({
		token,
		server_id: serverId,
		account_type,
		created_by: locals.user.account_id,
		expires_at: expiresAt ?? ''
	});

	const inviteUrl = `${url.origin}/register?token=${token}`;
	const displayName = member.server_display_name || member.display_name || member.username || 'there';
	const serverName = server.name || 'this server';
	const content = `Hi ${displayName}! You’ve been invited to join **${serverName}** as **${account_type}**.\n\nRegister here: ${inviteUrl}`;

	const payload = JSON.stringify({
		type: 'send_dm',
		guild_id: server.discord_server_id,
		user_id: discord_member_id,
		content
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
		return json({ success: true, invite_link: inviteUrl, token });
	}

	return json({ success: false, error: result.body.error || 'Failed to send DM', details: result.body.details }, { status: result.status });
};
