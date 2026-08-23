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
	envVars,
	permissionRoles,
	selfhostSteps,
	setupChannels,
	shopSteps,
	startSteps
} from '../../../../docs.js';
import { loadItemsCatalog } from '../../../../frontend/public/items/index.js';
import { VOICE_NOTE, fail, publicServer } from './aiToolShared.js';

const GUIDE_TOPICS = ['all', 'earning', 'basics', 'items', 'tasks', 'minigames', 'assets', 'tips'];

const DOCS_TOPICS = ['all', 'start', 'setup', 'accounts', 'permissions', 'modules', 'ai', 'wikis', 'shop', 'selfhost'];

const line = (e) => `${e.title ?? e.label ?? e.name}: ${e.desc}`;

const DOCS_SECTIONS = {
	start: { title: 'Getting started', points: () => startSteps.map(line) },
	setup: { title: 'The /setup command', points: () => setupChannels.map(line) },
	accounts: { title: 'Accounts & staff', points: () => accountFields.map(line) },
	permissions: { title: 'Permissions', points: () => permissionRoles.map(line) },
	modules: {
		title: 'Modules',
		points: () => [
			'On by default: Welcomer, Booster, Channel notification, Leveling, Giveaway, AFK, Moderation, Roblox Catalog and Public statistics.',
			'Off until enabled: Forwarder, Custom Supporter Role, Feedback, Staff Rating, Content Creator and Discord Quest.',
			'Always on: Main settings and Permissions cannot be switched off.',
			'Items, Assets, Minigames and Daily tasks are sub-toggles of Public statistics, all on by default.'
		]
	},
	ai: { title: 'AI chat, voice and tools', points: () => [...aiChatFields.map(line), ...aiVoiceRules.map(line), ...aiToolRules.map(line)] },
	wikis: { title: 'Wiki knowledge', points: () => aiWikiRules.map(line) },
	shop: { title: 'Items shop', points: () => shopSteps.map(line) },
	selfhost: { title: 'Self-hosting', points: () => [...selfhostSteps.map(line), ...envVars.map(line)] }
};

export function runDocsTool(args) {
	const topic = DOCS_TOPICS.includes(args?.topic) ? args.topic : 'all';
	const wanted = topic === 'all' ? Object.keys(DOCS_SECTIONS) : [topic];

	return Promise.resolve({
		ok: true,
		documentation: DOCS_TITLE,
		topic,
		read_more: DOCS_URL,
		sections: wanted.map((key) => ({ topic: key, title: DOCS_SECTIONS[key].title, points: DOCS_SECTIONS[key].points() })),
		next_step:
			'Answer from these points. This is the manual for running and configuring the bot — for how the XP game itself works for members, use get_guide instead.'
	});
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
	'The documentation for running this bot: getting started, what /setup creates, panel accounts and staff invites, permissions and roles, which modules exist and which are on by default, how AI chat, voice, wikis and the tools are configured, the items shop, and self-hosting with its environment variables. Use it for "how do I set this up", "what does /setup do", "how do I add staff", "which modules are on by default", "how do I add a wiki", "how do I self-host". This is the admin manual — for how the XP game works for members, use get_guide instead.';

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
	if (name === 'get_docs') return runDocsTool(args);
	if (name === 'get_guide') return runGuideTool(botId, guildId, args);
	return Promise.resolve(fail('unknown_tool'));
}

export default { buildKnowledgeTools, buildKnowledgeDeclarations, runKnowledgeTool, KNOWLEDGE_TOOL_NAMES };
