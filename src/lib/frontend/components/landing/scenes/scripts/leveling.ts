import { BRAND_PRIMARY } from '$lib/brand.js';
import { xpForLevel } from '$lib/level-rewards.js';
import { BOT, FOOTER, at, avatar, defineScene } from './common.js';

const BASE_XP = 100;
const MULTIPLIER = 1.2;
const XP_PER_MESSAGE = 15;
const START_XP = 515;
const ROLE_COLOR = '#1abc9c';

const endXp = START_XP + 2 * XP_PER_MESSAGE;
let level = 1;
while (endXp >= xpForLevel(level + 1, BASE_XP, MULTIPLIER)) level++;
const floorXp = xpForLevel(level, BASE_XP, MULTIPLIER);
const nextXp = xpForLevel(level + 1, BASE_XP, MULTIPLIER);
const ratio = (endXp - floorXp) / (nextXp - floorXp);
const filled = Math.round(ratio * 10);
const MIRA = avatar(2);

export const leveling = defineScene({
	id: 'leveling',
	label: 'Leveling & rewards',
	icon: 'fa-trophy',
	channel: 'general',
	duration: 15000,
	rest: 13500,
	people: {
		bot: BOT,
		jun: { name: 'Jun', avatar: avatar(4) },
		kai: { name: 'Kai', avatar: avatar(0) },
		rin: { name: 'Rin', avatar: avatar(3) },
		mira: { name: 'Mira', avatar: MIRA }
	},
	roles: { Regular: ROLE_COLOR },
	context: [
		{ id: 'c1', at: -1, who: 'jun', time: at('20:58'), text: 'who carried last night tho 👀' },
		{ id: 'c2', at: -1, who: 'jun', time: at('20:58'), text: 'not you kai' },
		{ id: 'c3', at: -1, who: 'kai', time: at('21:01'), text: 'anyone up for ranked tonight?' },
		{ id: 'c4', at: -1, who: 'rin', time: at('21:02'), text: 'in 10, grabbing food 🍜' }
	],
	events: [
		{
			id: 'm1',
			at: 1900,
			typeFrom: 500,
			who: 'mira',
			time: at('21:04'),
			text: 'gg, that last round was insane',
			pop: { text: `★ +${XP_PER_MESSAGE} XP`, tone: 'gold' }
		},
		{ id: 'm2', at: 3600, typeFrom: 2700, who: 'mira', time: at('21:04'), text: 'running it back 🔁', pop: { text: `★ +${XP_PER_MESSAGE} XP`, tone: 'gold' } },
		{
			id: 'levelup',
			at: 5000,
			who: 'bot',
			time: at('21:04'),
			embed: {
				color: BRAND_PRIMARY,
				title: '🎉 Level Up!',
				description: `<@Mira> has reached **Level ${level}**!`,
				thumbnail: MIRA,
				fields: [
					{ name: '📊 Total XP', value: endXp.toLocaleString('en-US'), inline: true },
					{ name: '🏆 Rank', value: '#12 (▲3)', inline: true },
					{ name: '🎁 Reward unlocked', value: '<@&Regular>' },
					{
						name: `⚡ Progress to Level ${level + 1}`,
						value: `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${Math.round(ratio * 100)}%\n**${(nextXp - endXp).toLocaleString('en-US')}** XP to go`
					}
				],
				footer: FOOTER,
				buttons: [{ label: '👤 Account' }, { label: '🌐 Leaderboard', link: true }]
			}
		},
		{ id: 'm3', at: 9900, typeFrom: 8800, who: 'mira', time: at('21:05'), text: 'finally made Regular 🎉' }
	],
	typing: [{ from: 4200, to: 5000, who: 'bot' }],
	nameColors: [{ at: 8200, who: 'mira', color: ROLE_COLOR }],
	steps: [
		{ from: 0, to: 4300, title: 'They chat', desc: `Every message past the cooldown earns XP: ${XP_PER_MESSAGE} by default, or any rate you set.` },
		{ from: 4300, to: 8000, title: 'They level up', desc: 'The bot posts it in your level-up channel, with their rank and the XP left to the next level.' },
		{
			from: 8000,
			to: 15000,
			title: 'The role is theirs',
			desc: 'Given the moment they reach the level, colour and all. You pick the role and the level on the Rewards tab.'
		}
	]
});
