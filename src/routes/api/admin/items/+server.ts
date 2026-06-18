import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';

const EFFECT_TYPES = ['xp_steal', 'xp_bomb', 'xp_boost', 'shield', 'leech', 'reflect', 'insurance', 'gamble', 'gift', 'bounty', 'cosmetic'];
const CATEGORIES = ['pvp', 'boost', 'cosmetic', 'fun'];

function isSuperadmin(locals: App.Locals) {
	return locals.user.authenticated && locals.user.account_type === 'superadmin' && locals.user.account_source === 'accounts';
}

async function resolveBotId(locals: App.Locals, requestedBotId: any): Promise<number | null> {
	const bots = await db.getAllBots((locals.user as any).panel_id);
	if (!Array.isArray(bots) || bots.length === 0) return null;
	if (requestedBotId != null) {
		const match = bots.find((b: any) => Number(b.id) === Number(requestedBotId));
		return match ? Number(match.id) : null;
	}
	return Number(bots[0].id);
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!isSuperadmin(locals)) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	const botId = await resolveBotId(locals, url.searchParams.get('bot_id'));
	if (botId == null) return json({ success: false, error: 'No bot available' }, { status: 404 });
	const items = await db.listBotItems(botId, {});
	return json({ success: true, items, botId });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });

	const botId = await resolveBotId(locals, body.bot_id);
	if (botId == null) return json({ success: false, error: 'No bot available' }, { status: 404 });

	if (!body.name || !EFFECT_TYPES.includes(body.effect_type) || !CATEGORIES.includes(body.category)) {
		return json({ success: false, error: 'name, valid effect_type and category are required' }, { status: 400 });
	}

	const item = await db.createBotItem(botId, {
		name: body.name,
		effect_type: body.effect_type,
		category: body.category,
		description: body.description ?? null,
		cost: Number(body.cost) || 0,
		config: body.config ?? {},
		icon: body.icon ?? null,
		enabled: body.enabled !== false,
		available_from: body.available_from || null,
		available_to: body.available_to || null,
		recurring_schedule: body.recurring_schedule ?? null,
		sort_order: Number(body.sort_order) || 0
	});
	await logger.log(`${(locals.user as any).username} created item "${body.name}" (${body.effect_type})`);
	return json({ success: true, item });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (!body?.id) return json({ success: false, error: 'id required' }, { status: 400 });

	const existing = await db.getBotItem(body.id);
	if (!existing) return json({ success: false, error: 'Not found' }, { status: 404 });
	const ownedBotId = await resolveBotId(locals, (existing as any).bot_id);
	if (ownedBotId == null || Number(ownedBotId) !== Number((existing as any).bot_id)) {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	if (body.effect_type != null && !EFFECT_TYPES.includes(body.effect_type)) {
		return json({ success: false, error: 'invalid effect_type' }, { status: 400 });
	}
	if (body.category != null && !CATEGORIES.includes(body.category)) {
		return json({ success: false, error: 'invalid category' }, { status: 400 });
	}

	const item = await db.updateBotItem(body.id, {
		name: body.name,
		effect_type: body.effect_type,
		category: body.category,
		description: body.description,
		cost: body.cost != null ? Number(body.cost) : undefined,
		config: body.config,
		icon: body.icon,
		enabled: body.enabled,
		available_from: body.available_from,
		available_to: body.available_to,
		recurring_schedule: body.recurring_schedule,
		sort_order: body.sort_order != null ? Number(body.sort_order) : undefined
	});
	await logger.log(`${(locals.user as any).username} updated item ${body.id}`);
	return json({ success: true, item });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (!body?.id) return json({ success: false, error: 'id required' }, { status: 400 });

	const existing = await db.getBotItem(body.id);
	if (!existing) return json({ success: false, error: 'Not found' }, { status: 404 });
	const ownedBotId = await resolveBotId(locals, (existing as any).bot_id);
	if (ownedBotId == null || Number(ownedBotId) !== Number((existing as any).bot_id)) {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	await db.deleteBotItem(body.id);
	await logger.log(`${(locals.user as any).username} deleted item ${body.id}`);
	return json({ success: true });
};
