import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { EFFECT_TYPE_IDS } from '$lib/items.js';

function isSuperadmin(locals: App.Locals) {
	return locals.user.authenticated && locals.user.account_type === 'superadmin' && locals.user.account_source === 'accounts';
}

function resolvePanelId(locals: App.Locals): number | null {
	const panelId = (locals.user as any).panel_id;
	return panelId != null ? Number(panelId) : null;
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!isSuperadmin(locals)) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	const panelId = resolvePanelId(locals);
	if (panelId == null) return json({ success: false, error: 'No panel available' }, { status: 404 });
	const items = await db.listItems(panelId, {});
	return json({ success: true, items, panelId });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });

	const panelId = resolvePanelId(locals);
	if (panelId == null) return json({ success: false, error: 'No panel available' }, { status: 404 });

	if (!body.name || !EFFECT_TYPE_IDS.includes(body.effect_type)) {
		return json({ success: false, error: 'name and valid effect_type are required' }, { status: 400 });
	}

	const item = await db.createItem(panelId, {
		name: body.name,
		effect_type: body.effect_type,
		description: body.description ?? null,
		cost: Number(body.cost) || 0,
		config: body.config ?? {},
		enabled: body.enabled !== false,
		usable: body.usable !== false,
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

	const panelId = resolvePanelId(locals);
	const existing = await db.getItem(body.id);
	if (!existing) return json({ success: false, error: 'Not found' }, { status: 404 });
	if (panelId == null || Number((existing as any).panel_id) !== panelId) {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	if (body.effect_type != null && !EFFECT_TYPE_IDS.includes(body.effect_type)) {
		return json({ success: false, error: 'invalid effect_type' }, { status: 400 });
	}

	const item = await db.updateItem(body.id, {
		name: body.name,
		effect_type: body.effect_type,
		description: body.description,
		cost: body.cost != null ? Number(body.cost) : undefined,
		config: body.config,
		enabled: body.enabled,
		usable: body.usable,
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

	const panelId = resolvePanelId(locals);
	const existing = await db.getItem(body.id);
	if (!existing) return json({ success: false, error: 'Not found' }, { status: 404 });
	if (panelId == null || Number((existing as any).panel_id) !== panelId) {
		return json({ success: false, error: 'Forbidden' }, { status: 403 });
	}

	await db.deleteItem(body.id);
	await logger.log(`${(locals.user as any).username} deleted item ${body.id}`);
	return json({ success: true });
};
