import db from '$lib/database.js';
import { parseWikiInput, testWiki } from '$lib/frontend/wikis.server.js';
import { logger } from '$lib/utils/index.js';
import { dangerTool, type AgentPack, type AgentReach, type AgentSession, type DangerAction } from './runtime.server.js';

const WIKI_FIELDS = {
	name: { type: 'string', description: 'Short name of the wiki, 64 characters at most. Leave out to take it from the wiki itself.' },
	api_url: { type: 'string', description: "The wiki's MediaWiki api.php address, for example https://fischipedia.org/w/api.php." },
	site_url: { type: 'string', description: 'The address members open to read the wiki. Leave out to take it from the wiki itself.' },
	description: { type: 'string', description: 'One line on what the wiki covers, 255 characters at most. Leave out to take it from the wiki itself.' },
	relay_url: { type: 'string', description: 'Only for a wiki that blocks this server: the address of the relay script.' },
	relay_key: { type: 'string', description: 'The key of that relay. Needed together with relay_url.' },
	enabled: { type: 'boolean', description: 'Off keeps the wiki saved but the AI ignores it.' }
};

function shown(wiki: any) {
	return {
		id: wiki.id,
		name: wiki.name,
		enabled: wiki.enabled,
		api_url: wiki.api_url,
		site_url: wiki.site_url,
		description: wiki.description,
		uses_relay: Boolean(wiki.relay_url)
	};
}

function given(args: Record<string, unknown>, key: string): string {
	return typeof args[key] === 'string' ? (args[key] as string).trim() : '';
}

export function wikisPack(reach: AgentReach, session: AgentSession): AgentPack {
	const panelId = reach.panelId;

	async function nameTaken(name: string, exceptId: number | null): Promise<boolean> {
		const wikis = await db.getWikis(panelId);
		return wikis.some((wiki) => wiki.id !== exceptId && wiki.name.toLowerCase() === name.toLowerCase());
	}

	const remove: DangerAction = {
		name: 'delete_wiki',
		describe: async (args) => {
			const wiki = await db.getWiki(panelId, Number(args.id));
			return wiki ? `Delete the wiki "${wiki.name}"` : null;
		},
		run: async (args) => {
			const wiki = await db.getWiki(panelId, Number(args.id));
			if (!wiki) return 'That wiki no longer exists.';
			await db.deleteWiki(panelId, wiki.id);
			session.changed.add('wikis');
			logger.log(`${session.actor} deleted wiki "${wiki.name}" through the assistant`);
			return `Deleted the wiki "${wiki.name}".`;
		}
	};

	return {
		instructions:
			"# Wikis\nWikis are the game wikis the bot's AI looks things up in, in chat and voice, shared by every bot on this panel. Any MediaWiki site works, Fandom included. create_wiki checks the address first and takes the name, site address and description from the wiki itself, so the api.php address is all you need. When the admin gives a site address or only a wiki name, try test_wiki on the likely api.php addresses of that site, such as /w/api.php and /api.php, and use the one that answers. A wiki that refuses this server needs a relay, which only the admin can set up.",
		dangers: [remove],
		tools: [
			{
				name: 'list_wikis',
				description: 'Every wiki saved on this panel, with its id.',
				parameters: { type: 'object', properties: {} },
				run: async () => ({ ok: true, wikis: (await db.getWikis(panelId)).map(shown) })
			},
			{
				name: 'test_wiki',
				description: 'Check that an address is a working MediaWiki api.php endpoint. Returns the name, site address and description the wiki reports.',
				parameters: {
					type: 'object',
					properties: { api_url: WIKI_FIELDS.api_url, relay_url: WIKI_FIELDS.relay_url, relay_key: WIKI_FIELDS.relay_key },
					required: ['api_url']
				},
				run: (args) => testWiki(args)
			},
			{
				name: 'create_wiki',
				description: 'Add a wiki. The address is checked first, and a wiki that does not answer is not added.',
				parameters: { type: 'object', properties: WIKI_FIELDS, required: ['api_url'] },
				run: async (args) => {
					const test = await testWiki(args);
					if (!test.ok) return { ok: false, reason: test.error };
					const parsed = parseWikiInput({
						...args,
						name: given(args, 'name') || test.sitename.slice(0, 64),
						site_url: given(args, 'site_url') || test.site_url || '',
						description: given(args, 'description') || test.description || ''
					});
					if ('error' in parsed) return { ok: false, reason: parsed.error };
					if (await nameTaken(parsed.value.name, null)) return { ok: false, reason: 'A wiki with that name already exists' };

					const wiki = await db.createWiki(panelId, parsed.value);
					session.changed.add('wikis');
					logger.log(`${session.actor} added wiki "${parsed.value.name}" through the assistant`);
					return { ok: true, wiki: wiki ? shown(wiki) : null };
				}
			},
			{
				name: 'update_wiki',
				description: 'Change a saved wiki. Send only the fields that change.',
				parameters: {
					type: 'object',
					properties: { id: { type: 'integer', description: 'The id of the wiki, from list_wikis.' }, ...WIKI_FIELDS },
					required: ['id']
				},
				run: async ({ id, ...changes }) => {
					const current = await db.getWiki(panelId, Number(id));
					if (!current) return { ok: false, reason: 'not_found' };
					const parsed = parseWikiInput({ ...current, relay_url: current.relay_url ?? '', relay_key: current.relay_key ?? '', ...changes });
					if ('error' in parsed) return { ok: false, reason: parsed.error };
					if (await nameTaken(parsed.value.name, current.id)) return { ok: false, reason: 'A wiki with that name already exists' };

					const wiki = await db.updateWiki(panelId, current.id, parsed.value);
					session.changed.add('wikis');
					logger.log(`${session.actor} changed wiki "${parsed.value.name}" through the assistant`);
					return { ok: true, wiki: wiki ? shown(wiki) : null };
				}
			},
			dangerTool(session, remove, 'Delete a saved wiki.', {
				type: 'object',
				properties: { id: { type: 'integer', description: 'The id of the wiki, from list_wikis.' } },
				required: ['id']
			})
		]
	};
}
