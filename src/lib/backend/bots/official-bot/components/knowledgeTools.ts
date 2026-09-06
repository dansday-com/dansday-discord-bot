import { Type } from '@google/genai';
import { BASICS, EARN_METHODS, FEATURES, FRIEND_BOOST, GUIDE_TITLE, TIPS, buildGuideItems } from '../../../../guide.js';
import {
	DOCS_TITLE,
	DOCS_URL,
	accountFields,
	aiChatFields,
	aiToolRules,
	aiVoiceRules,
	aiWikiRules,
	botKinds,
	envVars,
	permissionRoles,
	selfhostSteps,
	modules,
	setupChannels,
	shopSteps,
	startSteps,
	tiers
} from '../../../../docs.js';
import { APP_NAME } from '../../../../frontend/panelServer.js';
import { LEGAL_LAST_UPDATED, LEGAL_RETENTION_DAYS, PRIVACY_URL, SECURITY_EMAIL, TERMS_URL, privacy, terms } from '../../../../legal.js';
import { computePublicServerSlugForServerId } from '../../../../frontend/public/server-slug/index.js';
import {
	COMMUNITY_DISCORD_URL,
	DISCORD_APP_DIRECTORY_URL,
	MAINTAINER_DISCORD_HANDLE,
	OFFICIAL_BOT_INVITE_URL,
	SOURCE_REPO_URL,
	publicServerUrl,
	publicSiteOrigin
} from '../../../../url.js';
import { loadItemsCatalog } from '../../../../frontend/public/items/index.js';
import { VOICE_NOTE, fail, publicServer } from './aiToolShared.js';

const GUIDE_TOPICS = ['all', 'earning', 'basics', 'items', 'tasks', 'minigames', 'assets', 'tips'];

const DOCS_TOPICS = [
	'all',
	'start',
	'bots',
	'setup',
	'accounts',
	'roles',
	'permissions',
	'modules',
	'ai',
	'wikis',
	'shop',
	'public',
	'legal',
	'terms',
	'privacy',
	'selfhost'
];

const line = (e) => `${e.title ?? e.label ?? e.name}: ${e.desc}`;

function renderLegalDoc(doc) {
	return doc.sections.flatMap((section) =>
		section.blocks.flatMap((block) => {
			if (block.kind === 'text') return [`${section.heading}: ${block.text}`];
			if (block.kind === 'list') return block.items.map((item) => `${section.heading}: ${item}`);
			if (block.kind === 'defs') return block.items.map((item) => `${section.heading} — ${item.term}: ${item.desc}`);
			if (block.kind === 'links') {
				const links = block.links.map((link) => `${link.label} (${link.href})`).join(', ');
				return [`${section.heading}: ${block.text} ${links}${block.tail ?? ''}`.replace(/\s+/g, ' ').trim()];
			}
			return [];
		})
	);
}

function legalPoints(doc, url) {
	return [`Read it in full: ${url}`, `Last updated ${doc.lastUpdated}.`, ...renderLegalDoc(doc)];
}

const DOCS_SECTIONS = {
	start: { title: 'Getting started', points: () => startSteps.map(line) },
	bots: { title: 'Official bot vs selfbot', points: () => botKinds.flatMap((b) => [`${b.title}: ${b.what}`, ...b.fields.map(line)]) },
	setup: { title: 'The /setup command', points: () => setupChannels.map(line) },
	accounts: { title: 'Accounts & staff', points: () => accountFields.map(line) },
	roles: { title: 'Who can do what', points: () => tiers.flatMap((t) => [`${t.title}: ${t.what}`, ...t.can.map((c) => `${t.title} can: ${c}`)]) },
	permissions: { title: 'Permissions', points: () => permissionRoles.map(line) },
	modules: {
		title: 'Modules',
		summary: () => [
			'On by default: Welcomer, Booster, Channel notification, Leveling, Giveaway, AFK, Moderation and Roblox Catalog.',
			'Off until enabled: Forwarder, Custom Supporter Role, Feedback, Staff Rating, Content Creator and Discord Quest.',
			'Always on: Main settings, Permissions and Public statistics cannot be switched off.',
			'Items, Assets, Minigames and Daily tasks are sub-toggles of Public statistics, all on by default.',
			`Ask for topic "modules" for every setting of a named module: ${modules.map((m) => m.title).join(', ')}.`
		],
		points: () => modules.flatMap((m) => [`${m.title}: ${m.what}`, ...(m.fields ?? []).map((f) => `${m.title} — ${f.label}: ${f.desc}`)])
	},
	ai: { title: 'AI chat, voice and tools', points: () => [...aiChatFields.map(line), ...aiVoiceRules.map(line), ...aiToolRules.map(line)] },
	wikis: { title: 'Wiki knowledge', points: () => aiWikiRules.map(line) },
	shop: { title: 'Items shop', points: () => shopSteps.map(line) },
	support: {
		title: 'Support, and who makes this',
		points: () => [
			`Support server, for help, bug reports and feature requests: ${COMMUNITY_DISCORD_URL}`,
			`${APP_NAME} Discord Bot is built and run by ${MAINTAINER_DISCORD_HANDLE} on Discord, who is the owner and maintainer of the whole system — the bot, the panel and the website.`,
			`${MAINTAINER_DISCORD_HANDLE} is not the owner of this Discord server and has no role in it. A server owner or staff member here is the person to ask about anything to do with this server's own settings.`,
			`Listed on the Discord App Directory: ${DISCORD_APP_DIRECTORY_URL}`,
			`Add the bot to another server: ${OFFICIAL_BOT_INVITE_URL}`,
			`Free and open source under the GNU AGPL-3.0: ${SOURCE_REPO_URL}`,
			`Security problems go privately to ${SECURITY_EMAIL}, never a public issue or a public channel.`
		]
	},
	legal: {
		title: 'Terms and privacy',
		summary: () => [
			`Terms of Service: ${TERMS_URL}`,
			`Privacy Policy: ${PRIVACY_URL}`,
			`Both were last updated ${LEGAL_LAST_UPDATED}.`,
			`Deleted records are purged after ${LEGAL_RETENTION_DAYS} days.`,
			`Security problems go to ${SECURITY_EMAIL}, never a public issue.`,
			'Ask for topic "terms" or "privacy" to read either document in full before answering anything about them.'
		],
		points: () => [...legalPoints(terms, TERMS_URL), ...legalPoints(privacy, PRIVACY_URL)]
	},
	terms: { title: terms.heading, detailOnly: true, points: () => legalPoints(terms, TERMS_URL) },
	privacy: { title: privacy.heading, detailOnly: true, points: () => legalPoints(privacy, PRIVACY_URL) },
	selfhost: { title: 'Self-hosting', points: () => [...selfhostSteps.map(line), ...envVars.map(line)] }
};

const LEGAL_NEXT_STEP = `This is the real text of the document. Answer only from it, quote it where it is exact, and link the member to ${TERMS_URL} or ${PRIVACY_URL} to read it themselves. Never go beyond what it says, never promise what will happen to someone's data, and never answer a legal question from memory.`;

async function publicPagesSection(botId, guildId) {
	const origin = publicSiteOrigin();
	if (!origin) return null;

	const directories = [
		`Every public server ranked by XP: ${origin}/servers`,
		`Active Discord Quests: ${origin}/quests`,
		`Tracked Roblox catalog items: ${origin}/roblox`,
		`Every shop item, effect and cost: ${origin}/shop`,
		`Every daily and weekly task: ${origin}/tasks`,
		`Every wiki the bot can read: ${origin}/wikis`,
		`The manual: ${DOCS_URL}`
	];

	const ctx = await publicServer(botId, guildId).catch(() => ({ error: true }));
	const slug = ctx?.server ? await computePublicServerSlugForServerId(Number(ctx.server.id)).catch(() => null) : null;

	const here = slug
		? [
				`This server's statistics: ${publicServerUrl(slug)}`,
				`This server's leaderboard: ${publicServerUrl(slug, 'leaderboard')}`,
				`This server's member directory: ${publicServerUrl(slug, 'members')}`,
				`A member signs in for their own overview, history, guide, items, assets, minigames and tasks: ${publicServerUrl(slug, 'account')}`
			]
		: [];

	return { topic: 'public', title: 'The public website', points: [...here, ...directories] };
}

export async function runDocsTool(botId, guildId, args) {
	const topic = DOCS_TOPICS.includes(args?.topic) ? args.topic : 'all';
	const wanted = topic === 'all' ? Object.keys(DOCS_SECTIONS).filter((key) => !DOCS_SECTIONS[key].detailOnly) : topic === 'public' ? [] : [topic];

	const sections = wanted.map((key) => {
		const section = DOCS_SECTIONS[key];
		const points = topic === 'all' && section.summary ? section.summary() : section.points();
		return { topic: key, title: section.title, points };
	});

	if (topic === 'all' || topic === 'public') {
		const pages = await publicPagesSection(botId, guildId);
		if (pages) sections.push(pages);
		else if (topic === 'public') return fail('public_site_unavailable');
	}

	return {
		ok: true,
		documentation: DOCS_TITLE,
		topic,
		read_more: DOCS_URL,
		sections,
		next_step:
			topic === 'legal' || topic === 'terms' || topic === 'privacy'
				? LEGAL_NEXT_STEP
				: 'Answer from these points. This is the manual for running and configuring the bot — for how the XP game itself works for members, use get_guide instead.'
	};
}

export async function runGuideTool(botId, guildId, args) {
	const ctx = await publicServer(botId, guildId);
	const topic = GUIDE_TOPICS.includes(args?.topic) ? args.topic : 'all';

	const catalog = ctx.error ? [] : await loadItemsCatalog(ctx.server.id).catch(() => []);
	const liveItems = catalog.filter((i) => i.live);

	const feature = (id) => {
		const f = FEATURES.find((x) => x.id === id);
		if (!f) return null;
		return {
			title: f.title,
			summary: f.lead,
			steps: f.steps.map((s) => `${s.title}: ${s.desc}`),
			facts: f.cards.map((c) => `${c.title}: ${c.desc}`),
			important: `${f.note.title} — ${f.note.text}`
		};
	};

	const sections = {
		earning: {
			title: 'How to earn XP',
			summary: 'XP is the currency for everything here, and your rank on the leaderboard.',
			facts: EARN_METHODS.map((c) => `${c.title}: ${c.desc}`).concat(`${FRIEND_BOOST.title} — ${FRIEND_BOOST.text}`)
		},
		basics: { title: 'Know the basics', facts: BASICS.map((c) => `${c.title}: ${c.desc}`) },
		items: feature('items'),
		tasks: feature('tasks'),
		minigames: feature('minigames'),
		assets: feature('assets'),
		tips: { title: 'Tips', facts: TIPS.map((t) => t.text) }
	};

	if (topic !== 'all') {
		const picked = sections[topic];
		if (!picked) return fail('unknown_topic', { topics: GUIDE_TOPICS });
		return {
			ok: true,
			guide: GUIDE_TITLE,
			topic,
			...picked,
			...(topic === 'items'
				? {
						every_item: buildGuideItems(liveItems)
							.filter((i) => i.available)
							.map((i) => ({ name: i.label, cost_xp: i.cost, what_it_does: i.summary }))
					}
				: {})
		};
	}

	return {
		ok: true,
		guide: GUIDE_TITLE,
		topic: 'all',
		sections,
		next_step: 'Answer from these sections. For the full detail of one area, call this again with that topic.'
	};
}

const DOCS_DESCRIPTION =
	'The documentation for running this bot: getting started, what /setup creates, panel accounts and staff invites, permissions and roles, every module and how it is configured, how AI chat, voice, wikis and the tools are set up, the items shop, the public website with the exact links to this server\'s pages and the global directories, the support server and who builds the bot, the full Terms of Service and Privacy Policy, and self-hosting with its environment variables. Use it for "how do I set this up", "what does /setup do", "how do I add staff", "how do I configure the Roblox notifier", "where can I see the leaderboard online", "is there a page with every item", "where do I report a bug", "who made this bot", "what data do you keep", "do you store my messages", "how do I delete my data", "how do I self-host". This is the admin manual — for how the XP game works for members, use get_guide instead.';

const GUIDE_DESCRIPTION =
	'The official "How the XP Game Works" guide members read on this server — how XP is earned, what the wallet, cooldown, immunity and bounty mean, and how items, tasks and streaks, minigames and the assets market work, plus the tips. Use this for any "how does X work", "how do I earn XP", "what is a streak", "how do tasks work", "explain the game" question. Answer from this rather than guessing, because these rules are specific to this server. This is the player guide — for setting the bot up, use get_docs instead.';

export function buildKnowledgeTools() {
	return [
		{
			type: 'function',
			function: {
				name: 'get_docs',
				description: DOCS_DESCRIPTION,
				parameters: {
					type: 'object',
					properties: { topic: { type: 'string', enum: DOCS_TOPICS, description: 'Narrow to one area. Leave out for everything.' } }
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_guide',
				description: GUIDE_DESCRIPTION,
				parameters: {
					type: 'object',
					properties: { topic: { type: 'string', enum: GUIDE_TOPICS, description: 'Narrow to one area. Leave out to get every section at once.' } }
				}
			}
		}
	];
}

export function buildKnowledgeDeclarations() {
	return [
		{
			name: 'get_docs',
			description: `${DOCS_DESCRIPTION}\n\n${VOICE_NOTE} Give the steps out loud in order, never read the whole page.`,
			parameters: {
				type: Type.OBJECT,
				properties: { topic: { type: Type.STRING, enum: DOCS_TOPICS, description: 'Narrow to one area. Leave out for everything.' } }
			}
		},
		{
			name: 'get_guide',
			description: `${GUIDE_DESCRIPTION}\n\n${VOICE_NOTE} Explain it in your own words, do not recite the whole guide.`,
			parameters: {
				type: Type.OBJECT,
				properties: { topic: { type: Type.STRING, enum: GUIDE_TOPICS, description: 'Narrow to one area. Leave out for everything.' } }
			}
		}
	];
}

export const KNOWLEDGE_TOOL_NAMES = new Set(['get_docs', 'get_guide']);

export function runKnowledgeTool(name, args, { botId, guildId }) {
	if (name === 'get_docs') return runDocsTool(botId, guildId, args);
	if (name === 'get_guide') return runGuideTool(botId, guildId, args);
	return Promise.resolve(fail('unknown_tool'));
}

export default { buildKnowledgeTools, buildKnowledgeDeclarations, runKnowledgeTool, KNOWLEDGE_TOOL_NAMES };
