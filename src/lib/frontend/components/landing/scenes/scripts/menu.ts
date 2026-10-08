import { BRAND_PRIMARY } from '$lib/brand.js';
import { APP_DOMAIN, APP_NAME } from '$lib/backend/panelServer.js';
import type { SceneButton, SceneEmbed, SceneEvent, SceneRow } from '../types.js';
import { BOT, FOOTER, at, avatar, defineScene } from './common.js';

const OK = '#57f287';
const MENU_CHANNEL = '「💻」menu';
const BACK: SceneButton = { label: '⬅️ Back' };

type Item = { label: string; desc: string; tone?: SceneButton['tone']; pressAt?: number };

function panel(pressAt: number): SceneEvent {
	return {
		id: 'panel',
		at: -1,
		who: 'bot',
		time: 'Yesterday at 18:02',
		embed: {
			color: BRAND_PRIMARY,
			title: `${APP_NAME} Bot Panel`,
			description: 'Click **Menu** to access bot features based on your role permissions.',
			thumbnail: BOT.avatar,
			footer: FOOTER
		},
		rows: [[{ label: '📋 Menu', tone: 'blurple', pressAt }]]
	};
}

function mainMenu(press: { me?: number }): { embed: SceneEmbed; rows: SceneRow[] } {
	return {
		embed: {
			color: BRAND_PRIMARY,
			title: `📋 ${APP_NAME} Bot Menu`,
			description: `Select a feature from the buttons below:\n\n🌐 Server page: [nightowls.${APP_DOMAIN}](https://nightowls.${APP_DOMAIN})`,
			fields: [
				{ name: '👥 Members', value: '1,284', inline: true },
				{ name: '📊 Total XP', value: '4,812,950', inline: true },
				{ name: '⭐ Top Level', value: '61', inline: true }
			],
			footer: FOOTER
		},
		rows: [
			[
				{ label: '👤 Me', tone: 'blurple', pressAt: press.me },
				{ label: '🎉 Community', tone: 'blurple' },
				{ label: '💎 Perks', tone: 'blurple' },
				{ label: '🔨 Staff', tone: 'red' }
			],
			[{ label: 'Select Language' }, { label: '👤 Account', link: true }]
		]
	};
}

function category(title: string, about: string, items: Item[]): { embed: SceneEmbed; rows: SceneRow[] } {
	return {
		embed: {
			color: BRAND_PRIMARY,
			title,
			description: [about, ...items.map((item) => `**${item.label}**\n${item.desc}`)].join('\n\n'),
			footer: FOOTER
		},
		rows: [items.map((item) => ({ label: item.label, tone: item.tone ?? 'green', pressAt: item.pressAt })), [BACK]]
	};
}

export const setup = defineScene({
	id: 'setup',
	label: 'Setup',
	icon: 'fa-terminal',
	tagline: 'One command, run once by an admin.',
	channel: 'general',
	duration: 15000,
	rest: 13800,
	people: {
		bot: BOT,
		kai: { name: 'Kai', avatar: avatar(0) },
		rin: { name: 'Rin', avatar: avatar(3) }
	},
	commands: [{ name: 'setup', desc: 'Set up the bot: pick the server language, then create the menu and channels. Admins only.' }],
	context: [
		{ id: 'c1', at: -1, who: 'rin', time: at('20:56'), text: 'is the bot in yet?' },
		{ id: 'c2', at: -1, who: 'kai', time: at('20:57'), text: 'just added it, one sec' }
	],
	events: [
		{
			id: 'lang',
			at: 2900,
			typeFrom: 700,
			who: 'bot',
			time: at('20:58'),
			used: { who: 'kai', command: '/setup' },
			ephemeral: true,
			embed: {
				color: BRAND_PRIMARY,
				title: '🌐 Choose the server language',
				description:
					"Pick the language for this server. It names the channels `/setup` creates and is used for the menu, approval posts, every public bot message, and the AI's chat and voice.",
				footer: FOOTER
			},
			rows: [
				{
					placeholder: 'Select the server language',
					options: [{ label: 'English' }, { label: 'Bahasa Indonesia' }, { label: 'Deutsch' }, { label: 'Español' }, { label: '日本語' }],
					selected: 0,
					openAt: 4100,
					pickAt: 5000,
					pick: 0
				}
			]
		},
		{ id: 'ask', at: 9400, who: 'rin', time: at('20:59'), text: 'ok so what are the commands' },
		{ id: 'none', at: 12100, typeFrom: 10100, who: 'kai', time: at('20:59'), text: `there aren't any. just tap Menu in <#${MENU_CHANNEL}>` }
	],
	patches: [
		{ at: 5250, id: 'lang', embed: { color: OK, description: '⏳ Setting up in **English**…' }, rows: [] },
		{
			at: 6600,
			id: 'lang',
			embed: {
				color: OK,
				title: 'Owner registration',
				description: `🌐 Server language: **English**\nCreated **13** new channel(s).\n\n✅ Bot interface sent to <#${MENU_CHANNEL}>.\n\nOnly you can see this. Unused owner invite links expire **24 hours** after they are created.\n\n[Click here to register as owner](register)`
			},
			rows: [[{ label: 'Open registration', link: true }]]
		}
	],
	typing: [{ from: 8300, to: 9400, who: 'rin' }],
	steps: [
		{
			from: 0,
			to: 2900,
			title: 'Type / once',
			desc: 'The only slash command is /setup. It has no options, and only an admin can run it.'
		},
		{
			from: 2900,
			to: 6600,
			title: 'Pick a language',
			desc: 'Choose it from a list. Channel names, the menu, every post and the AI follow it.'
		},
		{
			from: 6600,
			to: 15000,
			title: 'Never type again',
			desc: 'Thirteen channels are created and wired, the menu is posted, and nobody needs a command after that.'
		}
	]
});

export const member = defineScene({
	id: 'member',
	label: 'Members',
	icon: 'fa-hand-pointer',
	tagline: 'Members tap. They never type a command.',
	channel: MENU_CHANNEL,
	duration: 16000,
	rest: 14800,
	people: { bot: BOT },
	context: [panel(1300)],
	events: [
		{ id: 'menu', at: 1700, who: 'bot', time: at('21:14'), ephemeral: true, ...mainMenu({ me: 4000 }) },
		{
			id: 'set',
			at: 10300,
			who: 'bot',
			time: at('21:14'),
			ephemeral: true,
			newGroup: true,
			embed: {
				color: BRAND_PRIMARY,
				title: '✅ AFK Status Set!',
				description: "You're now marked as AFK: **grabbing dinner 🍜**\n\nYou will be muted and deafened in voice.",
				fields: [{ name: '💡 How to remove', value: '• Send any message (auto-removes AFK and unmutes)' }],
				footer: FOOTER
			}
		}
	],
	patches: [
		{
			at: 4250,
			id: 'menu',
			...category('👤 Me', 'Your own status and alerts.', [
				{ label: '⏸️ Set AFK Status', desc: 'Set or clear your AFK status.', pressAt: 6600 },
				{ label: '🔔 Notifications', desc: 'Pick channels that notify you.' },
				{ label: '📨 Invites', desc: 'See your invites and get your invite link.' },
				{ label: '🔮 Discord Quest', desc: 'Claim active Discord quests.' }
			])
		}
	],
	modals: [
		{
			at: 6900,
			submitAt: 9600,
			title: '⏸️ Set AFK Status',
			fields: [
				{ label: 'AFK Message (Optional)', placeholder: 'e.g., Taking a break, Studying, etc.', value: 'grabbing dinner 🍜', typeFrom: 7800 },
				{ label: 'Deafen in Voice?', value: 'Yes', select: true }
			]
		}
	],
	steps: [
		{
			from: 0,
			to: 4000,
			title: 'Tap Menu',
			desc: 'One pinned button in the menu channel opens a menu only you can see.'
		},
		{
			from: 4000,
			to: 6600,
			title: 'Pick a feature',
			desc: 'Me, Community, Perks and Staff. Every button says what it does.'
		},
		{
			from: 6600,
			to: 16000,
			title: 'Fill in a form',
			desc: 'A form pops up instead of command options. Nothing to remember, nothing to mistype.'
		}
	]
});
