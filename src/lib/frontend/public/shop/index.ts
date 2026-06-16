import { createHash } from 'crypto';
import { request as httpRequest } from 'http';
import db from '$lib/database.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/index.js';

export function computeCardToken(discordMemberId: string, memberSince: any): string {
	const dt = parseMySQLDateTimeUtc(memberSince);
	const joinedDate = dt ? dt.toISOString().split('T')[0] : '';
	return createHash('sha256').update(`${discordMemberId}_${joinedDate}`).digest('hex').substring(0, 16);
}

export async function resolveMemberByCardToken(serverId: number, token: string): Promise<any | null> {
	if (!token) return null;
	const members = await db.getServerMembersList(serverId).catch(() => []);
	for (const m of members as any[]) {
		if (!m.discord_member_id) continue;
		if (computeCardToken(m.discord_member_id, m.member_since) === token) return m;
	}
	return null;
}

export async function resolveActiveBotForServer(server: any): Promise<any | null> {
	const officialBotId = await db.resolveOfficialBotIdForServer(server).catch(() => null);
	if (officialBotId == null) return null;
	const bot = await db.getBot(officialBotId).catch(() => null);
	return bot ?? null;
}

export function postBotWebhook(bot: any, payload: any): Promise<{ status: number; body: any }> {
	const body = JSON.stringify(payload);
	return new Promise((resolve) => {
		const req = httpRequest(
			{
				hostname: 'localhost',
				port: bot.port,
				path: '/',
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Secret-Key': bot.secret_key }
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					try {
						resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
					} catch {
						resolve({ status: res.statusCode ?? 500, body: null });
					}
				});
			}
		);
		req.on('error', () => resolve({ status: 502, body: null }));
		req.write(body);
		req.end();
	});
}
