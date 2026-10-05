import { BOT, FOOTER, at, avatar, defineScene } from './common.js';

export const steal = defineScene({
	id: 'steal',
	label: 'Steal & defend',
	icon: 'fa-sack-dollar',
	tagline: 'XP only goes up on other bots. Here it gets stolen.',
	channel: 'items',
	duration: 15500,
	rest: 14000,
	people: {
		bot: BOT,
		kai: { name: 'Kai', avatar: avatar(0) }
	},
	context: [
		{
			id: 'reflect-on',
			at: -1,
			who: 'bot',
			time: at('20:12'),
			text: '<@Kai>',
			embed: {
				color: '#7b5ea7',
				title: '🪞 Reflect Activated',
				description: '<@Kai> will bounce the next attack back at the attacker (until in 2 hours).',
				footer: FOOTER
			}
		}
	],
	events: [
		{
			id: 'robbed',
			at: 1400,
			who: 'bot',
			time: at('21:20'),
			text: '<@Mira> <@Jun>',
			pop: { text: '★ +1,250 XP', tone: 'gold' },
			embed: {
				color: '#c0392b',
				title: '💰 Member Robbed!',
				description: '<@Mira> robbed <@Jun> with **Pickpocket**!',
				fields: [
					{ name: 'Attacker', value: '<@Mira>', inline: true },
					{ name: 'Victim', value: '<@Jun>', inline: true },
					{ name: 'XP stolen', value: '1,250 XP (12%)', inline: true },
					{ name: '🛡️ Immunity', value: '<@Jun> is immune until in 30 minutes' }
				],
				footer: FOOTER
			}
		},
		{
			id: 'reflected',
			at: 5800,
			who: 'bot',
			time: at('21:24'),
			text: '<@Mira> <@Kai>',
			pop: { text: '−980 XP', tone: 'red' },
			embed: {
				color: '#7b5ea7',
				title: '🪞 Attack Reflected',
				description: '<@Kai> reflected the attack back at <@Mira>!',
				fields: [{ name: 'XP lost by attacker', value: '980 XP', inline: true }],
				footer: FOOTER
			}
		},
		{ id: 'lol', at: 7900, who: 'kai', time: at('21:24'), text: 'nice try 😏' },
		{
			id: 'bounty',
			at: 10000,
			who: 'bot',
			time: at('21:26'),
			text: '<@Jun> <@Mira>',
			embed: {
				color: '#a8327d',
				title: '🎯 Bounty Placed',
				description: '<@Jun> placed a bounty on <@Mira>. Whoever steals or bombs them next collects it.',
				fields: [{ name: 'Bounty', value: '500 XP', inline: true }],
				footer: FOOTER
			}
		}
	],
	typing: [{ from: 7000, to: 7900, who: 'kai' }],
	steps: [
		{
			from: 0,
			to: 5400,
			title: 'They steal XP',
			desc: "Members buy a Steal in your server's shop and use it from their account page. It takes 1–25% of the target's XP."
		},
		{
			from: 5400,
			to: 9600,
			title: 'Targets fight back',
			desc: 'A Shield blocks it, Reflect bounces it back at the attacker, and Insurance refunds half of what was lost.'
		},
		{
			from: 9600,
			to: 15500,
			title: 'Thieves get hunted',
			desc: 'Anyone can put XP on a head. Whoever lands the next steal or bomb on them collects it.'
		}
	]
});

const ITEM = 'Midnight Wing Crown';
const itemFields = (price: string, quantity: string, watching: string) => [
	{ name: 'Category', value: 'Hats', inline: true },
	{ name: 'Price', value: price, inline: true },
	{ name: 'Creator', value: '✅ Roblox', inline: true },
	{ name: 'Quantity', value: quantity, inline: true },
	{ name: 'Favorites', value: '9.214', inline: true },
	{ name: 'Notifications', value: watching, inline: true }
];
const CROWN = { background: 'linear-gradient(135deg, #1b1f3b, #4b3fb5 60%, #f5c542)', icon: 'fa-crown' };

export const roblox = defineScene({
	id: 'roblox',
	label: 'Roblox alerts',
	icon: 'fa-cube',
	tagline: 'Price drops tagged to the members who care.',
	channel: 'roblox-catalog',
	duration: 16000,
	rest: 14500,
	people: {
		bot: BOT,
		jun: { name: 'Jun', avatar: avatar(4) }
	},
	context: [{ id: 'c1', at: -1, who: 'jun', time: at('19:40'), text: 'please let the next limited be cheap 🙏' }],
	events: [
		{
			id: 'new',
			at: 1200,
			who: 'bot',
			time: at('20:00'),
			embed: {
				color: '#ffd700',
				title: ITEM,
				description: 'A crown that only shows up after dark.',
				thumbnailArt: CROWN,
				fields: itemFields('1.500 Robux', '1.842/2.000', '🔔 41'),
				footer: FOOTER
			},
			rows: [
				[
					{ label: '🛍️ Open on Roblox', link: true },
					{ label: '🔔 Notify me', pressAt: 4200 }
				]
			]
		},
		{
			id: 'saved',
			at: 4700,
			who: 'bot',
			time: at('20:01'),
			ephemeral: true,
			text: `🔔 Saved. You will be tagged for **${ITEM}** on: 💰 Price, 📦 Stock left. 42 watching.`
		},
		{
			id: 'update',
			at: 9200,
			who: 'bot',
			time: at('22:47'),
			newGroup: true,
			text: '<@Mira>',
			embed: {
				color: '#57f287',
				title: `[Updated] ${ITEM}`,
				description: '**Price**: 1.500 Robux → 1.200 Robux\n**Stock left**: 1.842 → 312',
				thumbnailArt: CROWN,
				fields: itemFields('1.200 Robux', '312/2.000', '🔔 42'),
				footer: FOOTER
			},
			rows: [[{ label: '🛍️ Open on Roblox', link: true }, { label: '🔔 Notify me' }]]
		}
	],
	steps: [
		{
			from: 0,
			to: 4000,
			title: 'New items, as they drop',
			desc: 'Every new official item and Limited is posted with its price, stock, supply and favourites.'
		},
		{
			from: 4000,
			to: 8800,
			title: 'Members pick what matters',
			desc: 'Tap Notify me under any item and choose price, resale price, stock or total supply.'
		},
		{
			from: 8800,
			to: 16000,
			title: 'They get tagged on changes',
			desc: 'The post shows old → new and tags only the members watching that value. Their own watchlist, not a channel feed.'
		}
	]
});
