import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { EFFECT_TYPE_IDS } from '$lib/items.js';
import { HTTP, readJsonObject } from '$lib/http.js';

type FieldCheck = { field: string; isValid: (value: unknown) => boolean };

const isOptionalText = (value: unknown) => value === undefined || value === null || typeof value === 'string';
const isOptionalObject = (value: unknown) => value === undefined || value === null || (typeof value === 'object' && !Array.isArray(value));
const isOptionalFlag = (value: unknown) => value === undefined || typeof value === 'boolean';
const isOptionalNumber = (value: unknown) =>
	value === undefined ||
	value === null ||
	(typeof value === 'number' && Number.isFinite(value)) ||
	(typeof value === 'string' && Number.isFinite(Number(value)));

const ITEM_FIELD_CHECKS: FieldCheck[] = [
	{ field: 'name', isValid: isOptionalText },
	{ field: 'effect_type', isValid: isOptionalText },
	{ field: 'description', isValid: isOptionalText },
	{ field: 'cost', isValid: isOptionalNumber },
	{ field: 'config', isValid: isOptionalObject },
	{ field: 'enabled', isValid: isOptionalFlag },
	{ field: 'usable', isValid: isOptionalFlag },
	{ field: 'available_from', isValid: isOptionalText },
	{ field: 'available_to', isValid: isOptionalText },
	{ field: 'recurring_schedule', isValid: isOptionalObject },
	{ field: 'sort_order', isValid: isOptionalNumber }
];

function itemFieldError(body: Record<string, unknown>): string | null {
	const invalid = ITEM_FIELD_CHECKS.find(({ field, isValid }) => !isValid(body[field]));
	return invalid ? `${invalid.field} has the wrong type` : null;
}

function itemId(value: unknown): number | null {
	const id = Number(value);
	return Number.isInteger(id) && id > 0 ? id : null;
}

function optionalText(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

function isSuperadmin(locals: App.Locals) {
	return locals.user.authenticated && locals.user.account_type === 'superadmin' && locals.user.account_source === 'accounts';
}

function resolvePanelId(locals: App.Locals): number | null {
	const panelId = (locals.user as Record<string, unknown>).panel_id;
	return panelId != null ? Number(panelId) : null;
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!isSuperadmin(locals)) {
		return json({ success: false, error: 'Unauthorized' }, { status: HTTP.UNAUTHORIZED });
	}
	const panelId = resolvePanelId(locals);
	if (panelId == null) {
		return json({ success: false, error: 'No panel available' }, { status: HTTP.NOT_FOUND });
	}
	const items = await db.listItems(panelId, {});
	return json({ success: true, items, panelId });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) {
		return json({ success: false, error: 'Unauthorized' }, { status: HTTP.UNAUTHORIZED });
	}
	const body = await readJsonObject(request);
	if (Object.keys(body).length === 0) {
		return json({ success: false, error: 'Invalid body' }, { status: HTTP.BAD_REQUEST });
	}

	const panelId = resolvePanelId(locals);
	if (panelId == null) {
		return json({ success: false, error: 'No panel available' }, { status: HTTP.NOT_FOUND });
	}

	const { name, effect_type: effectType } = body;
	if (typeof name !== 'string' || !name || typeof effectType !== 'string' || !EFFECT_TYPE_IDS.includes(effectType)) {
		return json({ success: false, error: 'name and valid effect_type are required' }, { status: HTTP.BAD_REQUEST });
	}
	const fieldError = itemFieldError(body);
	if (fieldError) {
		return json({ success: false, error: fieldError }, { status: HTTP.BAD_REQUEST });
	}

	const item = await db.createItem(panelId, {
		name,
		effect_type: effectType,
		description: typeof body.description === 'string' ? body.description : null,
		cost: Number(body.cost) || 0,
		config: body.config ?? {},
		enabled: body.enabled !== false,
		usable: body.usable !== false,
		available_from: optionalText(body.available_from),
		available_to: optionalText(body.available_to),
		recurring_schedule: body.recurring_schedule ?? null,
		sort_order: Number(body.sort_order) || 0
	});
	await logger.log(`${(locals.user as Record<string, unknown>).username} created item "${name}" (${effectType})`);
	return json({ success: true, item });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) {
		return json({ success: false, error: 'Unauthorized' }, { status: HTTP.UNAUTHORIZED });
	}
	const body = await readJsonObject(request);
	const id = itemId(body.id);
	if (id === null) {
		return json({ success: false, error: 'id required' }, { status: HTTP.BAD_REQUEST });
	}

	const panelId = resolvePanelId(locals);
	const existing = await db.getItem(id);
	if (!existing) {
		return json({ success: false, error: 'Not found' }, { status: HTTP.NOT_FOUND });
	}
	if (panelId == null || Number(existing.panel_id) !== panelId) {
		return json({ success: false, error: 'Forbidden' }, { status: HTTP.FORBIDDEN });
	}

	if (body.effect_type != null && (typeof body.effect_type !== 'string' || !EFFECT_TYPE_IDS.includes(body.effect_type))) {
		return json({ success: false, error: 'invalid effect_type' }, { status: HTTP.BAD_REQUEST });
	}
	const fieldError = itemFieldError(body);
	if (fieldError) {
		return json({ success: false, error: fieldError }, { status: HTTP.BAD_REQUEST });
	}

	const item = await db.updateItem(id, {
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
	await logger.log(`${(locals.user as Record<string, unknown>).username} updated item ${id}`);
	return json({ success: true, item });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) {
		return json({ success: false, error: 'Unauthorized' }, { status: HTTP.UNAUTHORIZED });
	}
	const id = itemId((await readJsonObject(request)).id);
	if (id === null) {
		return json({ success: false, error: 'id required' }, { status: HTTP.BAD_REQUEST });
	}

	const panelId = resolvePanelId(locals);
	const existing = await db.getItem(id);
	if (!existing) {
		return json({ success: false, error: 'Not found' }, { status: HTTP.NOT_FOUND });
	}
	if (panelId == null || Number(existing.panel_id) !== panelId) {
		return json({ success: false, error: 'Forbidden' }, { status: HTTP.FORBIDDEN });
	}

	await db.deleteItem(id);
	await logger.log(`${(locals.user as Record<string, unknown>).username} deleted item ${id}`);
	return json({ success: true });
};
