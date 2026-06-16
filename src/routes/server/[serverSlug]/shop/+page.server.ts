import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

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

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ parent }) => {
	const { server } = await parent();

	const shopRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.shop).catch(() => null);
	const shopEnabled = (shopRow as any)?.settings?.enabled === true;
	if (!shopEnabled) error(404, 'Shop not available');

	const botId = await db.getOfficialBotIdForServer(server.id).catch(() => null);

	let items: any[] = [];
	if (botId != null) {
		const all = await db.listBotItems(botId, { enabledOnly: true }).catch(() => []);
		items = (all as any[]).filter(itemAvailableNow).map((i) => ({
			id: i.id,
			name: i.name,
			effect_type: i.effect_type,
			category: i.category,
			description: i.description,
			cost: i.cost,
			icon: i.icon,
			config: typeof i.config === 'string' ? safeParse(i.config) : i.config
		}));
	}

	return { items };
};
