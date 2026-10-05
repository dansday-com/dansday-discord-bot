import AccountScreen from '../screens/AccountScreen.svelte';
import DashboardScreen from '../screens/DashboardScreen.svelte';
import PublicScreen from '../screens/PublicScreen.svelte';
import TasksScreen from '../screens/TasksScreen.svelte';
import ThemesScreen from '../screens/ThemesScreen.svelte';
import VoiceScreen from '../screens/VoiceScreen.svelte';
import { defineScene } from './common.js';

export const dashboard = defineScene({
	id: 'dashboard',
	label: 'Dashboard',
	icon: 'fa-sliders',
	screen: DashboardScreen,
	url: 'dansday.dev/admin/bots/1/servers/12/config',
	duration: 16000,
	rest: 14500,
	steps: [
		{
			from: 0,
			to: 4900,
			title: 'Every feature is a switch',
			desc: 'Each module in the sidebar has its own on/off switch for this server. Grey means off.'
		},
		{
			from: 4900,
			to: 9700,
			title: 'Flip it, save once',
			desc: 'No commands and no restart. It applies straight away, and the change is logged.'
		},
		{
			from: 9700,
			to: 16000,
			title: 'Off means off',
			desc: 'Members who press a switched-off feature in Discord get a clear notice, and the AI stops using it.'
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

export const publicStats = defineScene({
	id: 'public',
	label: 'Public statistics',
	icon: 'fa-chart-pie',
	tagline: 'Statistics, leaderboard and members on a public link.',
	screen: PublicScreen,
	url: 'night-owls.dansday.dev',
	duration: 15000,
	rest: 13500,
	steps: [
		{
			from: 0,
			to: 2400,
			title: 'One public link',
			desc: 'Statistics, leaderboard and member list for your server. Visitors need no login.'
		},
		{
			from: 2400,
			to: 5200,
			title: 'Numbers count live',
			desc: 'XP, messages, items and games tick up as they happen in Discord.'
		},
		{
			from: 5200,
			to: 15000,
			title: 'Ranks move live',
			desc: 'Boards for XP, chat, voice, invites, items and minigames. Rows reorder the moment someone passes another.'
		}
	]
});

export const tasks = defineScene({
	id: 'tasks',
	label: 'Tasks & streaks',
	icon: 'fa-list-check',
	tagline: 'A task list made for each member, with nothing to set up.',
	screen: TasksScreen,
	url: 'dansday.dev',
	duration: 15000,
	rest: 13500,
	steps: [
		{
			from: 0,
			to: 5200,
			title: 'Tasks made for them',
			desc: 'Eighteen a day and eighteen a week, sized from their own last seven days. No two members get the same list.'
		},
		{
			from: 5200,
			to: 9600,
			title: 'Clear the day, keep the streak',
			desc: 'Each full day adds 2% reward XP, up to double. Freezes cover a missed day.'
		},
		{
			from: 9600,
			to: 15000,
			title: 'Check in for the big one',
			desc: 'A 7-day cycle from 1,000 to 50,000 XP, sometimes a shop item instead.'
		}
	]
});

export const themes = defineScene({
	id: 'themes',
	label: 'Card themes',
	icon: 'fa-wand-magic-sparkles',
	tagline: 'Seventy animated effects, won with XP.',
	screen: ThemesScreen,
	url: 'dansday.dev',
	duration: 15000,
	rest: 13500,
	steps: [
		{
			from: 0,
			to: 5200,
			title: 'Spin for an effect',
			desc: '1,000 XP a spin. Seventy animated effects, from fire and aurora to a black hole.'
		},
		{
			from: 5200,
			to: 9600,
			title: 'Theirs to keep',
			desc: 'Every spin rolls a fresh effect and a one-of-a-kind variant. Spins are never lost.'
		},
		{
			from: 9600,
			to: 15000,
			title: 'Everyone sees it',
			desc: 'It repaints their account, their leaderboard row and their card in the member list.'
		}
	]
});
