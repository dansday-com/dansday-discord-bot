import db from '$lib/database.js';
import { EFFECT_TYPE_IDS, ITEM_EFFECTS, effectDefaultCost, effectSummary, getItemEffect } from '$lib/items.js';
import { logger } from '$lib/utils/index.js';
import type { AgentPack, AgentReach, AgentSession } from './runtime.server.js';

const MAX_NAME_LENGTH = 150;
const BOOST_SCOPES = ['all', 'message', 'voice'];
const SETTING_RANGES: Record<string, { min: number; max: number }> = { refund_percent: { min: 0, max: 100 }, spy_chance: { min: 1, max: 100 } };
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const BASE_KEYS = [
	'name',
	'effect_type',
	'cost',
	'description',
	'enabled',
	'usable',
	'available_from',
	'available_to',
	'recurring_days',
	'recurring_from',
	'recurring_to'
];

const SETTING_KEYS = [...new Set(ITEM_EFFECTS.flatMap((effect) => Object.keys(effect.defaultConfig)))];

const SETTING_FIELDS = Object.fromEntries(
	SETTING_KEYS.map((key) => {
		const users = ITEM_EFFECTS.filter((effect) => key in effect.defaultConfig).map((effect) => effect.id);
		const note = `Setting of: ${users.join(', ')}.`;
		return [
			key,
			key === 'scope' ? { type: 'string', enum: BOOST_SCOPES, description: `Which XP the boost applies to. ${note}` } : { type: 'number', description: note }
		];
	})
);

const ITEM_FIELDS = {
	name: { type: 'string', description: `The name members see in the shop, ${MAX_NAME_LENGTH} characters at most.` },
	effect_type: { type: 'string', enum: EFFECT_TYPE_IDS, description: 'What kind of item it is.' },
	cost: { type: 'integer', description: 'Price in XP. Leave out for the usual price of that kind.' },
	description: { type: 'string', description: 'A short line shown on the item card. Optional.' },
	enabled: { type: 'boolean', description: 'Whether members can buy it.' },
	usable: { type: 'boolean', description: 'Whether members can use the copies they own.' },
	available_from: { type: 'string', description: 'When it goes on sale, as "YYYY-MM-DD HH:MM". An empty text removes the start.' },
	available_to: { type: 'string', description: 'When it goes off sale, as "YYYY-MM-DD HH:MM". An empty text removes the end.' },
	recurring_days: {
		type: 'array',
		items: { type: 'integer' },
		description: 'Weekdays it is on sale, 0 for Sunday to 6 for Saturday. An empty list removes the weekly schedule.'
	},
	recurring_from: { type: 'string', description: 'With recurring_days: the time it opens each of those days, as "HH:MM".' },
	recurring_to: { type: 'string', description: 'With recurring_days: the time it closes each of those days, as "HH:MM".' },
	...SETTING_FIELDS
};

const ID_FIELD = { type: 'integer', description: 'The id of the item, from list_items.' };

type Parsed<T> = { value: T } | { error: string };

function parseJson(value: unknown): any {
	if (typeof value !== 'string') return value ?? null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function shown(item: any) {
	const config = parseJson(item.config) ?? {};
	return {
		id: item.id,
		name: item.name,
		effect_type: item.effect_type,
		cost: item.cost,
		enabled: item.enabled !== false && item.enabled !== 0,
		usable: item.usable !== false && item.usable !== 0,
		description: item.description ?? null,
		settings: config,
		what_it_does: effectSummary({ effect_type: item.effect_type, description: item.description, config }),
		available_from: item.available_from ?? null,
		available_to: item.available_to ?? null,
		recurring: parseJson(item.recurring_schedule)
	};
}

function settingsFor(effectType: string, args: Record<string, unknown>, current: Record<string, unknown>): Parsed<Record<string, unknown>> {
	const defaults = getItemEffect(effectType)?.defaultConfig ?? {};
	const settings: Record<string, unknown> = {};
	for (const [key, fallback] of Object.entries(defaults)) {
		const value = args[key] ?? current[key] ?? fallback;
		if (key === 'scope') {
			if (!BOOST_SCOPES.includes(String(value))) return { error: `scope must be one of ${BOOST_SCOPES.join(', ')}` };
			settings[key] = String(value);
			continue;
		}
		const range = SETTING_RANGES[key] ?? { min: 0, max: Number.MAX_SAFE_INTEGER };
		const number = Number(value);
		if (!Number.isFinite(number) || number < range.min || number > range.max) {
			return { error: `${key} must be a number${range.max < Number.MAX_SAFE_INTEGER ? ` from ${range.min} to ${range.max}` : ` of ${range.min} or more`}` };
		}
		settings[key] = number;
	}
	if (Number(settings.min_percent) > Number(settings.max_percent)) return { error: 'min_percent cannot be higher than max_percent' };
	return { value: settings };
}

function wallClock(value: unknown, key: string): Parsed<string | null> {
	if (value === null || String(value).trim() === '') return { value: null };
	const match = String(value).match(WALL_CLOCK);
	return match ? { value: `${match[1]} ${match[2]}:00` } : { error: `${key} must look like "YYYY-MM-DD HH:MM"` };
}

function weekly(args: Record<string, unknown>, current: any): Parsed<{ days: number[]; from: string; to: string } | null> {
	if (!('recurring_days' in args) && !('recurring_from' in args) && !('recurring_to' in args)) return { value: current ?? null };
	const days = Array.isArray(args.recurring_days)
		? [...new Set(args.recurring_days.map(Number))].sort((a, b) => a - b)
		: ((current?.days ?? []) as number[]).map(Number);
	if (days.length === 0) return { value: null };
	if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
		return { error: 'recurring_days takes whole numbers from 0 for Sunday to 6 for Saturday' };
	const from = String(args.recurring_from ?? current?.from ?? '').trim();
	const to = String(args.recurring_to ?? current?.to ?? '').trim();
	if (!CLOCK.test(from) || !CLOCK.test(to)) return { error: 'A weekly schedule needs recurring_from and recurring_to as "HH:MM"' };
	return { value: { days, from, to } };
}

function itemData(args: Record<string, unknown>, current: any | null): Parsed<Record<string, unknown>> {
	const name = String(args.name ?? current?.name ?? '').trim();
	if (!name) return { error: 'The item needs a name' };
	if (name.length > MAX_NAME_LENGTH) return { error: `The name must be at most ${MAX_NAME_LENGTH} characters` };

	const effectType = String(args.effect_type ?? current?.effect_type ?? '');
	if (!EFFECT_TYPE_IDS.includes(effectType)) return { error: `effect_type must be one of ${EFFECT_TYPE_IDS.join(', ')}` };

	const cost = args.cost ?? (current && current.effect_type === effectType ? current.cost : effectDefaultCost(effectType));
	if (!Number.isInteger(Number(cost)) || Number(cost) < 0) return { error: 'cost must be a whole number of 0 or more' };

	const settings = settingsFor(effectType, args, current && current.effect_type === effectType ? (parseJson(current.config) ?? {}) : {});
	if ('error' in settings) return settings;

	const from = 'available_from' in args ? wallClock(args.available_from, 'available_from') : { value: current?.available_from ?? null };
	if ('error' in from) return from;
	const to = 'available_to' in args ? wallClock(args.available_to, 'available_to') : { value: current?.available_to ?? null };
	if ('error' in to) return to;
	const recurring = weekly(args, current ? parseJson(current.recurring_schedule) : null);
	if ('error' in recurring) return recurring;

	return {
		value: {
			name,
			effect_type: effectType,
			description: 'description' in args ? String(args.description ?? '').trim() || null : (current?.description ?? null),
			cost: Number(cost),
			config: settings.value,
			enabled: typeof args.enabled === 'boolean' ? args.enabled : current ? current.enabled !== false && current.enabled !== 0 : true,
			usable: typeof args.usable === 'boolean' ? args.usable : current ? current.usable !== false && current.usable !== 0 : true,
			available_from: from.value,
			available_to: to.value,
			recurring_schedule: recurring.value
		}
	};
}

const CATALOG = ITEM_EFFECTS.map((effect) => {
	const settings = Object.entries(effect.defaultConfig)
		.map(([key, value]) => `${key} ${value}`)
		.join(', ');
	return `- ${effect.id}: ${effect.summary(effect.defaultConfig)} ${effect.targeted ? 'Used on another member.' : 'Used on yourself.'} Usual price ${effect.defaultCost} XP.${settings ? ` Settings and their usual values: ${settings}.` : ' No settings.'}`;
}).join('\n');

export function itemsPack(reach: AgentReach, session: AgentSession): AgentPack {
	const panelId = reach.panelId;

	async function owned(id: unknown): Promise<any | null> {
		const item = await db.getItem(Number(id)).catch(() => null);
		return item && Number((item as any).panel_id) === panelId ? item : null;
	}

	return {
		instructions: `# Shop items\nItems are the XP shop catalog, shared by every server on this panel that has items turned on. Members buy them with XP. Each item is one of these kinds:\n${CATALOG}\nDurations and cooldowns are in minutes and percentages are plain numbers. Set only what the admin asked for and let every other setting keep its usual value. Sale times are wall-clock times that apply in each member's own timezone. You cannot delete an item. To take one off sale, set enabled to false: members keep the copies they own.`,
		tools: [
			{
				name: 'list_items',
				description: 'Every item in the shop catalog, with its id, price, settings and sale times.',
				parameters: { type: 'object', properties: {} },
				run: async () => ({ ok: true, items: (await db.listItems(panelId, {})).map(shown) })
			},
			{
				name: 'create_item',
				description: 'Add an item to the shop catalog.',
				parameters: { type: 'object', properties: ITEM_FIELDS, required: ['name', 'effect_type'] },
				run: async (args) => {
					const data = itemData(args, null);
					if ('error' in data) return { ok: false, reason: data.error };
					const item = await db.createItem(panelId, data.value);
					session.changed.add('items');
					logger.log(`${session.actor} created item "${data.value.name}" (${data.value.effect_type}) through the assistant`);
					return { ok: true, item: item ? shown(item) : null };
				}
			},
			{
				name: 'update_item',
				description: 'Change an item in the shop catalog. Send only the fields that change.',
				parameters: { type: 'object', properties: { id: ID_FIELD, ...ITEM_FIELDS }, required: ['id'] },
				run: async ({ id, ...changes }) => {
					const current = await owned(id);
					if (!current) return { ok: false, reason: 'not_found' };
					const unknown = Object.keys(changes).filter((key) => !BASE_KEYS.includes(key) && !SETTING_KEYS.includes(key));
					if (unknown.length > 0) return { ok: false, reason: `Unknown fields: ${unknown.join(', ')}` };
					const data = itemData(changes, current);
					if ('error' in data) return { ok: false, reason: data.error };
					const item = await db.updateItem(current.id, data.value);
					session.changed.add('items');
					logger.log(`${session.actor} updated item ${current.id} through the assistant`);
					return { ok: true, item: item ? shown(item) : null };
				}
			}
		]
	};
}
