import AccountScreen from '../screens/AccountScreen.svelte';
import DashboardScreen from '../screens/DashboardScreen.svelte';
import VoiceScreen from '../screens/VoiceScreen.svelte';
import { defineScene } from './common.js';

export const dashboard = defineScene({
	id: 'dashboard',
	label: 'Dashboard',
	icon: 'fa-sliders',
	screen: DashboardScreen,
	url: 'dansday.dev/admin/bots/1/servers/12/rewards',
	duration: 15000,
	rest: 13500,
	steps: [
		{ from: 0, to: 3000, title: 'Set it in the browser', desc: 'Every module is a tab in the dashboard, not a slash command. Here: level 10 gives @Veteran.' },
		{
			from: 3000,
			to: 4300,
			title: 'Save once',
			desc: 'It applies right away. No commands, no restarts, and every change lands in the change log.'
		},
		{
			from: 4300,
			to: 15000,
			title: 'Discord catches up',
			desc: 'Members who already qualify get the role straight away. Everyone else gets it the moment they level up.'
		}
	]
});

export const voice = defineScene({
	id: 'voice',
	label: 'Voice AI',
	icon: 'fa-microphone-lines',
	tagline: 'Talk to your server, out loud. It talks back.',
	screen: VoiceScreen,
	duration: 16000,
	rest: 14500,
	steps: [
		{
			from: 0,
			to: 2800,
			title: 'Say "hey stupid"',
			desc: 'Ask it to join from chat. It sits muted in your voice channel until a wake-word model hears its name.'
		},
		{
			from: 2800,
			to: 10200,
			title: 'Ask out loud',
			desc: 'It answers in seconds from your live leaderboards, XP rates, shop and stats, plus any wiki you add.'
		},
		{
			from: 10200,
			to: 16000,
			title: 'One speaker at a time',
			desc: 'Whoever wakes it holds the conversation. Say you are done and it mutes itself for the next person.'
		}
	]
});

export const account = defineScene({
	id: 'account',
	label: 'Member account',
	icon: 'fa-id-card',
	tagline: 'Every member gets their own page, one tap from Discord.',
	screen: AccountScreen,
	url: 'dansday.dev',
	duration: 15000,
	rest: 13500,
	steps: [
		{
			from: 0,
			to: 2600,
			title: 'Open your account',
			desc: 'One tap on Account in the Discord menu: wallet, bag, tasks, rewards and history. No signup.'
		},
		{
			from: 2600,
			to: 7900,
			title: 'Use what is in your bag',
			desc: 'Pick a target and it resolves on the spot. Steals, bombs, spies and bounties all start here.'
		},
		{
			from: 7900,
			to: 15000,
			title: 'The server hears about it',
			desc: 'Your wallet updates live, levels and all, and the hit is posted in your items channel.'
		}
	]
});
