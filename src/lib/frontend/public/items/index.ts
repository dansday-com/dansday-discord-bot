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

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function availableUntilMs(item: any): number | null {
	const ends: number[] = [];
	if (item.available_to) {
		const t = new Date(item.available_to).getTime();
		if (Number.isFinite(t)) ends.push(t);
	}
	const schedule = typeof item.recurring_schedule === 'string' ? safeParse(item.recurring_schedule) : item.recurring_schedule;
	if (schedule && Array.isArray(schedule.days) && schedule.days.length > 0 && schedule.from && schedule.to) {
		const now = new Date();
		const toMin = (hhmm: any) => {
			const [h, m] = String(hhmm)
				.split(':')
				.map((n) => Number(n) || 0);
			return h * 60 + m;
		};
		const endOfWindow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0) + toMin(schedule.to) * 60000;
		if (Number.isFinite(endOfWindow)) ends.push(endOfWindow);
	}
	if (ends.length === 0) return null;
	return Math.min(...ends);
}

function itemAvailableNow(item: any): boolean {
	const nowMs = Date.now();
	if (item.available_from && nowMs < new Date(item.available_from).getTime()) return false;
	if (item.available_to && nowMs > new Date(item.available_to).getTime()) return false;
	const schedule = typeof item.recurring_schedule === 'string' ? safeParse(item.recurring_schedule) : item.recurring_schedule;
	if (schedule && Array.isArray(schedule.days) && schedule.days.length > 0) {
		const now = new Date(nowMs);
		if (!schedule.days.map(Number).includes(now.getUTCDay())) return false;
		if (schedule.from && schedule.to) {
			const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
			const toMin = (hhmm: any) => {
				const [h, m] = String(hhmm)
					.split(':')
					.map((n) => Number(n) || 0);
				return h * 60 + m;
			};
			if (minutes < toMin(schedule.from) || minutes > toMin(schedule.to)) return false;
		}
	}
	return true;
}

export async function loadItemsCatalog(serverId: number): Promise<any[]> {
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (panelId == null) return [];
	const all = await db.listItems(panelId, { enabledOnly: true }).catch(() => []);
	return (all as any[]).filter(itemAvailableNow).map((i) => ({
		id: i.id,
		name: i.name,
		effect_type: i.effect_type,
		category: i.category,
		description: i.description,
		cost: i.cost,
		availableUntil: availableUntilMs(i),
		config: typeof i.config === 'string' ? safeParse(i.config) : i.config
	}));
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
