import AccountScreen from '../screens/AccountScreen.svelte';
import ThemesScreen from '../screens/ThemesScreen.svelte';
import VoiceScreen from '../screens/VoiceScreen.svelte';
import { defineScene } from './common.js';

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
