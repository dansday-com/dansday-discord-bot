import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db, { type BotWikiInput } from '$lib/database.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

const MAX_NAME_LENGTH = 64;
const MAX_URL_LENGTH = 512;
const MAX_DESCRIPTION_LENGTH = 255;
const MAX_WIKIS_PER_BOT = 15;

async function authorize(locals: App.Locals, params: Partial<Record<string, string>>) {
	if (!locals.user.authenticated) {
		return { error: json({ success: false, error: 'Authentication required' }, { status: 401 }) };
	}

	const botId = Number(params.id);
	if (!Number.isFinite(botId)) {
		return { error: json({ success: false, error: 'Invalid bot id' }, { status: 400 }) };
	}

	const bot = await db.getBot(botId);
	if (!bot) {
		return { error: json({ success: false, error: 'Bot not found' }, { status: 404 }) };
	}

	if (!(await accountOwnsBot(locals, botId))) {
		return { error: json({ success: false, error: 'Access denied' }, { status: 403 }) };
	}

	return { botId };
}

function parseBody(body: Record<string, unknown>): { error: string } | { value: BotWikiInput } {
	const name = String(body.name ?? '').trim();
	const api_url = String(body.api_url ?? '').trim();
	const site_url = String(body.site_url ?? '').trim();
	const description = String(body.description ?? '').trim();

	if (!name) return { error: 'Wiki name is required' };
	if (name.length > MAX_NAME_LENGTH) return { error: `Wiki name must be at most ${MAX_NAME_LENGTH} characters` };
	if (!api_url) return { error: 'API URL is required' };
	if (api_url.length > MAX_URL_LENGTH) return { error: `API URL must be at most ${MAX_URL_LENGTH} characters` };
	if (!/^https?:\/\//i.test(api_url)) return { error: 'API URL must start with http:// or https://' };
	if (!/api\.php/i.test(api_url)) return { error: 'API URL must point at the MediaWiki api.php endpoint, e.g. https://fischipedia.org/w/api.php' };
	if (site_url && !/^https?:\/\//i.test(site_url)) return { error: 'Site URL must start with http:// or https://' };
	if (site_url.length > MAX_URL_LENGTH) return { error: `Site URL must be at most ${MAX_URL_LENGTH} characters` };
	if (description.length > MAX_DESCRIPTION_LENGTH) return { error: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters` };

	return {
		value: {
			enabled: body.enabled !== false,
			name,
			api_url,
			site_url: site_url || null,
			description: description || null
		}
	};
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const auth = await authorize(locals, params);
	if (auth.error) return auth.error;

	return json({ wikis: await db.getBotWikis(auth.botId!) });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const auth = await authorize(locals, params);
	if (auth.error) return auth.error;
	const botId = auth.botId!;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = parseBody(body);
	if ('error' in parsed) return json({ success: false, error: parsed.error }, { status: 400 });

	const existing = await db.getBotWikis(botId);
	if (existing.length >= MAX_WIKIS_PER_BOT) {
		return json({ success: false, error: `A bot can have at most ${MAX_WIKIS_PER_BOT} wikis` }, { status: 400 });
	}
	if (existing.some((wiki) => wiki.name.toLowerCase() === parsed.value.name.toLowerCase())) {
		return json({ success: false, error: 'A wiki with that name already exists' }, { status: 400 });
	}

	return json({ success: true, wiki: await db.createBotWiki(botId, parsed.value) });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const auth = await authorize(locals, params);
	if (auth.error) return auth.error;
	const botId = auth.botId!;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const wikiId = Number(body.id);
	if (!Number.isFinite(wikiId)) return json({ success: false, error: 'Invalid wiki id' }, { status: 400 });

	const current = await db.getBotWiki(botId, wikiId);
	if (!current) return json({ success: false, error: 'Wiki not found' }, { status: 404 });

	const parsed = parseBody(body);
	if ('error' in parsed) return json({ success: false, error: parsed.error }, { status: 400 });

	const existing = await db.getBotWikis(botId);
	if (existing.some((wiki) => wiki.id !== wikiId && wiki.name.toLowerCase() === parsed.value.name.toLowerCase())) {
		return json({ success: false, error: 'A wiki with that name already exists' }, { status: 400 });
	}

	return json({ success: true, wiki: await db.updateBotWiki(botId, wikiId, parsed.value) });
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const auth = await authorize(locals, params);
	if (auth.error) return auth.error;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const wikiId = Number(body.id);
	if (!Number.isFinite(wikiId)) return json({ success: false, error: 'Invalid wiki id' }, { status: 400 });

	const current = await db.getBotWiki(auth.botId!, wikiId);
	if (!current) return json({ success: false, error: 'Wiki not found' }, { status: 404 });

	await db.deleteBotWiki(auth.botId!, wikiId);
	return json({ success: true });
};
