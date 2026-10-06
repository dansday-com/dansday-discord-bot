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

const FRIEND_BOOST = ' (+20% Friend boost 🤝)';

export const xpCall = defineScene({
	id: 'xp-call',
	label: 'XP on call',
	icon: 'fa-headset',
	tagline: 'Voice, camera and streams all pay XP, not only chat.',
	channel: 'xp-log',
	duration: 16000,
	rest: 14800,
	people: {
		bot: BOT,
		mira: { name: 'Mira', avatar: avatar(2) },
		kai: { name: 'Kai', avatar: avatar(0) },
		rin: { name: 'Rin', avatar: avatar(3) }
	},
	call: {
		channel: 'Lounge',
		me: 'mira',
		cameraAt: 7000,
		liveAt: 10300,
		members: [
			{
				who: 'mira',
				talk: [
					[300, 1300],
					[4400, 5200],
					[9200, 10000],
					[13200, 14000]
				]
			},
			{
				who: 'kai',
				joinAt: 2900,
				talk: [
					[3200, 3800],
					[5900, 6800],
					[11000, 11900]
				]
			},
			{
				who: 'rin',
				joinAt: 3900,
				talk: [
					[7700, 8500],
					[12600, 13100]
				]
			}
		],
		ticks: [
			{ at: 1500, gains: ['🎤 +50'] },
			{ at: 5300, gains: ['🎤 +60'] },
			{ at: 8700, gains: ['🎤 +60', '📹 +60'] },
			{ at: 12100, gains: ['🎤 +60', '📹 +60', '📡 +60'] }
		]
	},
	context: [{ id: 'chat', at: -1, who: 'bot', time: at('21:30'), text: '💬 Chat XP: Mira gained +15 XP' }],
	events: [
		{ id: 'm1-voice', at: 1500, who: 'bot', time: at('21:31'), text: '🎤 Voice XP: Mira gained +50 XP' },
		{ id: 'm2-voice', at: 5300, who: 'bot', time: at('21:32'), text: `🎤 Voice XP: Mira gained +60 XP${FRIEND_BOOST}` },
		{ id: 'm3-voice', at: 8700, who: 'bot', time: at('21:33'), text: `🎤 Voice XP: Mira gained +60 XP${FRIEND_BOOST}` },
		{ id: 'm3-video', at: 8870, who: 'bot', time: at('21:33'), text: `📹 Video XP: Mira gained +60 XP${FRIEND_BOOST}` },
		{ id: 'm4-voice', at: 12100, who: 'bot', time: at('21:34'), text: `🎤 Voice XP: Mira gained +60 XP${FRIEND_BOOST}` },
		{ id: 'm4-video', at: 12270, who: 'bot', time: at('21:34'), text: `📹 Video XP: Mira gained +60 XP${FRIEND_BOOST}` },
		{ id: 'm4-stream', at: 12440, who: 'bot', time: at('21:34'), text: `📡 Streaming XP: Mira gained +60 XP${FRIEND_BOOST}` }
	],
	steps: [
		{
			from: 0,
			to: 2700,
			title: 'Talking pays too',
			desc: 'Every active minute in a voice channel earns XP, not only messages. Muted or AFK, it earns less.'
		},
		{
			from: 2700,
			to: 6700,
			title: 'Friends boost it',
			desc: 'Every other member in your voice channel adds +10% to your voice XP. Five friends is +50%.'
		},
		{
			from: 6700,
			to: 16000,
			title: 'Camera and streams stack',
			desc: 'Camera on and going live each add their own XP per minute, on top of voice. You set every rate in the panel.'
		}
	]
});

export const inviteShare = defineScene({
	id: 'invite-share',
	label: 'Invite XP share',
	icon: 'fa-user-plus',
	tagline: 'Bring someone in, then earn from what they earn.',
	channel: 'xp-log',
	duration: 15000,
	rest: 13500,
	people: { bot: BOT },
	context: [{ id: 'bonus', at: -1, who: 'bot', time: 'Yesterday at 21:10', text: '📨 Invite XP: Kai gained +1000 XP for inviting Nova' }],
	events: [
		{
			id: 'chat',
			at: 1400,
			who: 'bot',
			time: at('20:14'),
			text: '💬 Chat XP: Nova gained +20 XP · 📨 +5 to Kai (25% invite share)',
			pop: { text: '★ +5 XP', tone: 'gold' }
		},
		{
			id: 'voice',
			at: 4200,
			who: 'bot',
			time: at('20:31'),
			text: '🎤 Voice XP: Nova gained +60 XP · 📨 +15 to Kai (25% invite share)',
			pop: { text: '★ +15 XP', tone: 'gold' }
		},
		{
			id: 'invites',
			at: 8200,
			who: 'bot',
			time: at('20:40'),
			ephemeral: true,
			embed: {
				color: '#c8911a',
				title: '📨 Your Invites',
				description:
					'Earn **1000 XP** for each new member who joins with your link and stays 24h.\n📈 You also get **25%** of the chat and voice XP your invited members earn, for as long as they stay.',
				fields: [
					{ name: '📨 Total', value: '5', inline: true },
					{ name: '✅ Still here', value: '4', inline: true },
					{ name: '⭐ XP earned', value: '4,000', inline: true },
					{ name: '🤝 From shares', value: '1,935', inline: true }
				],
				footer: FOOTER
			}
		}
	],
	steps: [
		{
			from: 0,
			to: 3800,
			title: 'They earn, you earn',
			desc: 'After the join bonus, the inviter gets up to 25% of the chat and voice XP that member earns. It is paid on top, the member keeps all of theirs.'
		},
		{
			from: 3800,
			to: 7800,
			title: 'For as long as they stay',
			desc: 'No time limit. New accounts, your own link and rejoins never pay.'
		},
		{
			from: 7800,
			to: 15000,
			title: 'Every member has a link',
			desc: 'A personal invite link from the Discord menu, with its own join page and a running total of what it earned.'
		}
	]
});
