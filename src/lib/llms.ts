import { APP_NAME, APP_NAME_PLAIN, APP_URL } from './frontend/panelServer.js';
import { LANDING_DESCRIPTION, LANDING_FACTS, faq, features } from './landing.js';
import { PRIVACY_URL, TERMS_URL } from './legal.js';
import { COMMUNITY_DISCORD_URL, DISCORD_APP_DIRECTORY_URL, OFFICIAL_BOT_INVITE_URL, SOURCE_REPO_URL } from './url.js';
import {
	DOCS_URL,
	sections,
	subSections,
	shopSteps,
	aiChatFields,
	aiToolFields,
	aiToolRules,
	aiVoiceRules,
	aiServerRules,
	aiServerTopics,
	aiWikiFields,
	aiWikiRules,
	aiWikiRelaySteps,
	envVars,
	selfhostSteps,
	startSteps,
	setupChannels,
	accountFields,
	tiers,
	permissionRoles,
	modules,
	discordMenu
} from './docs.js';

type Field = { label: string; desc: string; req?: string };
type Step = { title: string; desc: string };

const NAME = `${APP_NAME_PLAIN} Discord Bot`;
const LLMS_FULL_URL = `${APP_URL}/llms-full.txt`;

const fieldList = (fields: Field[]): string => fields.map((f) => `- **${f.label}**${f.req ? ` (${f.req})` : ''}: ${f.desc}`).join('\n');
const bulletList = (items: Step[]): string => items.map((s) => `- **${s.title}**: ${s.desc}`).join('\n');
const stepList = (steps: Step[]): string => steps.map((s, i) => `${i + 1}. **${s.title}**: ${s.desc}`).join('\n');
const link = (label: string, url: string, note: string): string => `- [${label}](${url}): ${note}`;
const blocks = (...parts: string[]): string => parts.filter(Boolean).join('\n\n');
const plain = (text: string): string => text.replaceAll(APP_NAME, APP_NAME_PLAIN);

function subHead(id: string): string {
	const s = subSections[id];
	return blocks(`#### ${s.heading}`, s.lead ?? '');
}

const SECTION_BODY: Record<string, () => string> = {
	start: () => stepList(startSteps),
	'setup-command': () => fieldList(setupChannels.map((c) => ({ label: c.name, desc: c.desc }))),
	accounts: () => fieldList(accountFields),
	roles: () => blocks(...tiers.map((t) => blocks(`#### ${t.title}`, t.what, t.can.map((c) => `- ${c}`).join('\n')))),
	permissions: () => fieldList(permissionRoles),
	modules: () => blocks(...modules.map((m) => blocks(`#### ${m.title}`, m.what, fieldList(m.fields)))),
	'ai-chat': () => blocks(fieldList(aiChatFields), subHead('ai-voice'), bulletList(aiVoiceRules)),
	'ai-tools': () => blocks(fieldList(aiToolFields), subHead('ai-tools-how'), bulletList(aiToolRules)),
	'ai-wikis': () => blocks(fieldList(aiWikiFields), subHead('ai-wiki-how'), bulletList(aiWikiRules), subHead('ai-wiki-relay'), stepList(aiWikiRelaySteps)),
	'ai-server': () => blocks(bulletList(aiServerTopics), subHead('ai-server-how'), bulletList(aiServerRules)),
	shop: () => stepList(shopSteps),
	discord: () => fieldList(discordMenu),
	selfhost: () => blocks(stepList(selfhostSteps), subHead('selfhost-env'), fieldList(envVars))
};

const intro = (): string =>
	blocks(
		`# ${NAME}`,
		`> ${LANDING_DESCRIPTION}`,
		[APP_NAME_PLAIN === APP_NAME ? '' : `The name is styled \`${APP_NAME}\`.`, `${LANDING_FACTS.join('. ')}.`].filter(Boolean).join(' ')
	);

export function llmsIndex(): string {
	return (
		blocks(
			intro(),
			'## Documentation',
			[
				link('Documentation', DOCS_URL, 'Setup from adding the bot to configuring every module, field by field.'),
				link('Full documentation in Markdown', LLMS_FULL_URL, `All ${features.length} features, the FAQ and every documentation section in one file.`)
			].join('\n'),
			'## Product',
			[
				link('Homepage', `${APP_URL}/`, `What the bot does, all ${features.length} features and the FAQ.`),
				link('Add the bot to a Discord server', OFFICIAL_BOT_INVITE_URL, 'The hosted bot. Nothing to run.'),
				link('Source code', SOURCE_REPO_URL, 'AGPL-3.0, with Docker Compose and a Node adapter for self-hosting.'),
				link('Discord App Directory listing', DISCORD_APP_DIRECTORY_URL, "The bot's page in Discord's own directory.")
			].join('\n'),
			'## Public directories',
			[
				link('Server directory', `${APP_URL}/servers`, 'Every Discord server running the bot with public pages switched on, ranked by total XP earned.'),
				link('Task directory', `${APP_URL}/tasks`, 'Every daily and weekly task the bot can hand out, with what each one asks for and the module it needs.'),
				link('Item directory', `${APP_URL}/shop`, 'Every item in the shop catalog: what each one does, what it costs in XP and when it is on sale.'),
				link('Discord Quest directory', `${APP_URL}/quests`, 'Every Discord Quest the bot has tracked, with the game, the task, the reward and when it runs.'),
				link(
					'Roblox catalog directory',
					`${APP_URL}/roblox`,
					'Every Roblox catalog item the bot watches, with price, lowest resale, favourites and remaining stock.'
				),
				link('Wiki knowledge directory', `${APP_URL}/wikis`, 'Every wiki the bot can look up, and whether it is active or disabled.'),
				link('Forwarder source servers', `${APP_URL}/forwarder-servers`, 'Every Discord server messages can be forwarded from.')
			].join('\n'),
			'## Optional',
			[
				link('Sitemap', `${APP_URL}/sitemap.xml`, "Every public URL, including each public server's statistics, leaderboard and members pages."),
				link('Community Discord', COMMUNITY_DISCORD_URL, 'Support and updates.'),
				link('Terms of Service', TERMS_URL, 'Terms for the website, the panel and the bot.'),
				link('Privacy Policy', PRIVACY_URL, 'What is collected and how it is used.')
			].join('\n')
		) + '\n'
	);
}

export function llmsFull(): string {
	return (
		blocks(
			intro(),
			`Website: ${APP_URL}/. Source code: ${SOURCE_REPO_URL}. Add the bot: ${OFFICIAL_BOT_INVITE_URL}.`,
			'## Features',
			features.map((f) => `- **${f.title}**: ${f.desc} ${f.more}`).join('\n'),
			'## Frequently asked questions',
			...faq.map((f) => blocks(`### ${plain(f.q)}`, plain(f.a))),
			'## Documentation',
			`Source: ${DOCS_URL}`,
			...sections.map((s) => blocks(`### ${s.heading}`, s.lead, SECTION_BODY[s.id]?.() ?? ''))
		) + '\n'
	);
}
