import { BRAND_PRIMARY } from '$lib/brand.js';
import type { SceneEmbed } from '../types.js';
import { BOT, FOOTER, at, avatar, defineScene } from './common.js';

const NOVA = avatar(1);

export const welcome = defineScene({
	id: 'welcome',
	label: 'Welcome & invites',
	icon: 'fa-door-open',
	channel: 'lobby',
	duration: 15000,
	rest: 13500,
	people: {
		bot: BOT,
		kai: { name: 'Kai', avatar: avatar(0) },
		rin: { name: 'Rin', avatar: avatar(3) },
		nova: { name: 'Nova', avatar: NOVA }
	},
	context: [
		{ id: 'c1', at: -1, who: 'kai', time: at('21:00'), text: 'sent nova my invite link, she should be here any sec 👀' },
		{ id: 'c2', at: -1, who: 'rin', time: at('21:01'), text: 'W 🙏' }
	],
	events: [
		{ id: 'join', at: 1300, who: 'system', time: at('21:03'), text: '**Nova** just showed up!' },
		{
			id: 'welcome',
			at: 2300,
			who: 'bot',
			time: at('21:03'),
			embed: {
				color: BRAND_PRIMARY,
				title: '🎉 Welcome to the Server!',
				description: '👋 Welcome <@Nova> to Night Owls! You are member #1284 (Account age: 412 days ago).',
				thumbnail: NOVA,
				fields: [
					{ name: '📅 Account Created', value: 'a year ago', inline: true },
					{ name: '👥 Member Count', value: 'Member #1284', inline: true },
					{ name: '📨 Invited By', value: '<@Kai> (5 invites)\nPersonal link', inline: true }
				],
				footer: FOOTER
			}
		},
		{ id: 'hi', at: 5200, typeFrom: 4400, who: 'nova', time: at('21:04'), text: 'heyy 👋 kai dragged me here' },
		{
			id: 'payout',
			at: 9000,
			who: 'bot',
			time: 'Tomorrow at 21:10',
			text: '📨 Invite XP: Kai gained +1000 XP for inviting Nova',
			pop: { text: '★ +1,000 XP', tone: 'gold' }
		},
		{ id: 'ez', at: 10900, who: 'kai', time: 'Tomorrow at 21:11', text: 'easiest 1k of my life 😎' }
	],
	steps: [
		{
			from: 0,
			to: 4000,
			title: 'They join',
			desc: 'The bot welcomes them with their member number and account age. Write your own lines, or let the AI write them.'
		},
		{
			from: 4000,
			to: 8500,
			title: 'You see who brought them',
			desc: 'Every join is traced to the inviter and the link they used: their personal link, your vanity URL or a plain invite.'
		},
		{
			from: 8500,
			to: 15000,
			title: 'The inviter gets paid',
			desc: '1,000 XP once the new member stays a day, then 25% of what they earn. Accounts under a week old pay nothing.'
		}
	]
});

function caseEmbed(
	kind: 'warn' | 'timeout',
	num: number,
	staff: string,
	source: string,
	reason: string,
	extra: { name: string; value: string; inline?: boolean }
): SceneEmbed {
	return {
		color: BRAND_PRIMARY,
		title: kind === 'warn' ? `⚠️ Member Warned · Case #${num}` : `🔇 Member Timed Out · Case #${num}`,
		description: `Case **#${num}** recorded for <@Nova>.`,
		thumbnail: NOVA,
		fields: [
			{ name: '👤 Member', value: '<@Nova> (Nova)', inline: true },
			{ name: '🛡️ Staff', value: staff, inline: true },
			{ name: '📍 Source', value: source, inline: true },
			{ name: '📝 Reason', value: reason },
			extra
		],
		footer: FOOTER
	};
}

export const moderation = defineScene({
	id: 'moderation',
	label: 'Moderation',
	icon: 'fa-gavel',
	channel: 'mod-log',
	duration: 15000,
	rest: 13500,
	people: { bot: BOT },
	context: [
		{
			id: 'c10',
			at: -1,
			who: 'bot',
			time: at('20:41'),
			text: '<@Nova>',
			embed: caseEmbed('warn', 10, '<@Kai> (Kai)', 'menu', 'Spamming in chat', { name: '📊 Active Warnings', value: '2', inline: true })
		}
	],
	events: [
		{
			id: 'c11',
			at: 1500,
			who: 'bot',
			time: at('21:06'),
			text: '<@Nova>',
			embed: caseEmbed('warn', 11, '<@Kai> (Kai)', 'menu', 'Spamming in chat', { name: '📊 Active Warnings', value: '3', inline: true })
		},
		{
			id: 'c12',
			at: 5600,
			who: 'bot',
			time: at('21:06'),
			text: '<@Nova>',
			embed: caseEmbed('timeout', 12, 'Automatic', 'auto', 'Reached 3 active warnings', { name: '⏱️ Duration', value: '1h (ends in an hour)' })
		}
	],
	steps: [
		{
			from: 0,
			to: 5200,
			title: 'Staff warn',
			desc: 'From the Discord menu or the dashboard, with a preset reason. Each action is a numbered case, and the member is tagged and DMed.'
		},
		{
			from: 5200,
			to: 10000,
			title: 'Rules escalate',
			desc: 'Set steps like 3 warnings = 1 hour timeout. The bot applies them itself and logs them as Automatic.'
		},
		{
			from: 10000,
			to: 15000,
			title: 'All on record',
			desc: 'Every case stays in the dashboard: who did it, from where and why. Warnings can expire on their own.'
		}
	]
});

const GIVEAWAY = '🎉 Nitro Night';
const GIVEAWAY_DESC =
	'**Prize:** Discord Nitro (1 month)\n**Winner:** 1\n**Entries:** Single entry per member\n**Role Restrictions:** <@&Regular>\n**Invites Needed:** 1';

export const giveaways = defineScene({
	id: 'giveaways',
	label: 'Giveaways',
	icon: 'fa-gift',
	channel: 'giveaways',
	duration: 15000,
	rest: 13500,
	people: {
		bot: BOT,
		kai: { name: 'Kai', avatar: avatar(0) },
		mira: { name: 'Mira', avatar: avatar(2) }
	},
	roles: { Regular: '#1abc9c' },
	context: [{ id: 'c1', at: -1, who: 'kai', time: at('20:55'), text: 'dropping something for the regulars tonight 👀' }],
	events: [
		{
			id: 'post',
			at: 1200,
			who: 'bot',
			time: at('21:00'),
			embed: {
				color: BRAND_PRIMARY,
				title: GIVEAWAY,
				description: GIVEAWAY_DESC,
				fields: [
					{ name: '👤 Hosted By', value: '<@Kai>', inline: true },
					{ name: '⏰ Ends', value: 'in 10 minutes', inline: true }
				],
				footer: FOOTER,
				buttons: [{ label: '🎉 Enter Giveaway', tone: 'green', pressAt: 3700 }]
			}
		},
		{
			id: 'entered',
			at: 4000,
			who: 'bot',
			time: at('21:01'),
			ephemeral: true,
			embed: { color: BRAND_PRIMARY, title: '✅ Entered Giveaway!', description: 'You have successfully entered the giveaway! Good luck! 🍀' }
		},
		{
			id: 'ended',
			at: 8800,
			who: 'bot',
			time: at('21:10'),
			newGroup: true,
			embed: {
				color: BRAND_PRIMARY,
				title: '🎉 Giveaway Ended!',
				description: '**Nitro Night**\n\n**Prize:** Discord Nitro (1 month)\n\n🎊 **Winner:** <@Mira>\n\nCongratulations! 🎉',
				footer: FOOTER
			}
		},
		{ id: 'won', at: 10600, typeFrom: 9700, who: 'mira', time: at('21:10'), text: 'NO WAY 😭 ty kai' }
	],
	patches: [{ at: 8600, id: 'post', embed: { buttons: [] } }],
	steps: [
		{
			from: 0,
			to: 3500,
			title: 'Host it in a minute',
			desc: 'Pick the roles that can enter, then the prize, winners and length. It posts with an Enter button.'
		},
		{
			from: 3500,
			to: 8400,
			title: 'Members enter',
			desc: 'One click. Role and invite requirements are checked on the spot, and you can allow multiple entries.'
		},
		{
			from: 8400,
			to: 15000,
			title: 'Winners are drawn',
			desc: 'When the timer runs out, or when you finish it early, the bot draws and announces the winners.'
		}
	]
});

export const alerts = defineScene({
	id: 'alerts',
	label: 'Creator alerts',
	icon: 'fa-tower-broadcast',
	channel: 'stream-alerts',
	duration: 16000,
	rest: 14500,
	people: {
		bot: BOT,
		kai: { name: 'Kai', avatar: avatar(0) },
		jun: { name: 'Jun', avatar: avatar(4) }
	},
	context: [{ id: 'c1', at: -1, who: 'kai', time: at('19:58'), text: 'going live in 5, ranked grind 🎮' }],
	events: [
		{
			id: 'live',
			at: 1200,
			who: 'bot',
			time: at('20:03'),
			text: '<@Mira> <@Rin>',
			embed: {
				color: '#9146ff',
				author: 'kaiplays',
				title: '[ranked grind until diamond 💎](https://twitch.tv)',
				fields: [
					{ name: 'Platform', value: 'Twitch', inline: true },
					{ name: 'Type', value: '🔴 Live stream', inline: true },
					{ name: 'Notifications', value: '🔔 2', inline: true }
				],
				image: { background: 'linear-gradient(135deg, #3b1d78, #9146ff 55%, #1f1147)', icon: 'fa-gamepad', badge: 'LIVE' },
				footer: FOOTER,
				buttons: [
					{ label: 'Open on Twitch', link: true },
					{ label: '🔔 Notify me', pressAt: 4300 }
				]
			}
		},
		{
			id: 'saved',
			at: 4800,
			who: 'bot',
			time: at('20:04'),
			ephemeral: true,
			text: '🔔 Saved. You will be tagged for **kaiplays** on: 🎬 New video, 🔴 Live stream. 3 watching.'
		},
		{
			id: 'video',
			at: 9400,
			who: 'bot',
			time: 'Tomorrow at 18:20',
			newGroup: true,
			text: '<@Mira> <@Rin> <@Jun>',
			embed: {
				color: '#ff0000',
				author: 'kaiplays',
				title: '[I finally hit Diamond](https://youtube.com)',
				fields: [
					{ name: 'Platform', value: 'YouTube', inline: true },
					{ name: 'Type', value: '🎬 New video', inline: true },
					{ name: 'Notifications', value: '🔔 3', inline: true }
				],
				image: { background: 'linear-gradient(135deg, #2a0b0b, #c4302b 60%, #170606)', icon: 'fa-play' },
				footer: FOOTER,
				buttons: [{ label: 'Open on YouTube', link: true }, { label: '🔔 Notify me' }]
			}
		}
	],
	steps: [
		{
			from: 0,
			to: 4000,
			title: 'Creators post',
			desc: 'YouTube, Twitch and TikTok are checked every two minutes. Videos, streams and posts each get an alert.'
		},
		{
			from: 4000,
			to: 9000,
			title: 'Members choose',
			desc: 'Tap Notify me and pick videos, streams or posts. Each member follows the creators they actually watch.'
		},
		{
			from: 9000,
			to: 16000,
			title: 'Only fans get tagged',
			desc: 'Every alert tags just the members who follow that creator for that kind of post. No @everyone.'
		}
	]
});
