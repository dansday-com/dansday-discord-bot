<script lang="ts">
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { APP_DOMAIN, APP_NAME } from '$lib/frontend/panelServer.js';
	import { BRAND_PRIMARY } from '$lib/brand.js';
	import { xpForLevel } from '$lib/level-rewards.js';
	import { SceneClock, playWhenVisible } from './clock.svelte.js';
	import DiscordEmbed from './DiscordEmbed.svelte';
	import DiscordMessage from './DiscordMessage.svelte';
	import DiscordWindow from './DiscordWindow.svelte';

	const BASE_XP = 100;
	const MULTIPLIER = 1.2;
	const XP_PER_MESSAGE = 15;
	const START_XP = 515;
	const ROLE = { name: 'Regular', color: '#1abc9c' };

	const DURATION = 15000;
	const REST = 13500;
	const TYPE_MS = 40;
	const BOT_TYPING_AT = 4200;
	const EMBED_AT = 5000;
	const ROLE_AT = 8200;

	const avatar = (n: number) => `https://cdn.discordapp.com/embed/avatars/${n}.png`;
	const MIRA = { name: 'Mira', avatar: avatar(2) };
	const BOT = { name: APP_NAME, avatar: '/favicon-96x96.png' };

	type Line = { id: string; name: string; avatar: string; time: string; text: string; mira: boolean; bot: boolean; pop: number | null; continued: boolean };
	type Event = { id: string; at: number; typeFrom?: number; text?: string; who: 'mira' | 'bot'; time: string; xp: boolean };

	const chat = (id: string, name: string, n: number, time: string, text: string, continued = false): Line => ({
		id,
		name,
		avatar: avatar(n),
		time,
		text,
		mira: false,
		bot: false,
		pop: null,
		continued
	});
	const CONTEXT: Line[] = [
		chat('c1', 'Jun', 4, 'Today at 20:58', 'who carried last night tho 👀'),
		chat('c2', 'Jun', 4, 'Today at 20:58', 'not you kai', true),
		chat('c3', 'Kai', 0, 'Today at 21:01', 'anyone up for ranked tonight?'),
		chat('c4', 'Rin', 3, 'Today at 21:02', 'in 10, grabbing food 🍜')
	];
	const FEED: Event[] = [
		{ id: 'm1', who: 'mira', typeFrom: 500, at: 1900, text: 'gg, that last round was insane', time: 'Today at 21:04', xp: true },
		{ id: 'm2', who: 'mira', typeFrom: 2700, at: 3600, text: 'running it back 🔁', time: 'Today at 21:04', xp: true },
		{ id: 'bot', who: 'bot', at: EMBED_AT, time: 'Today at 21:04', xp: false },
		{ id: 'm3', who: 'mira', typeFrom: 8800, at: 9900, text: 'finally made Regular 🎉', time: 'Today at 21:05', xp: false }
	];

	const STEPS = [
		{ from: 0, to: 4300, title: 'They chat', desc: `Every message past the cooldown earns XP: ${XP_PER_MESSAGE} by default, or any rate you set.` },
		{ from: 4300, to: 8000, title: 'They level up', desc: 'The bot posts it in your level-up channel, with their rank and the XP left to the next level.' },
		{
			from: 8000,
			to: DURATION,
			title: 'The role is theirs',
			desc: 'Given the moment they reach the level, colour and all. You pick the role and the level on the Rewards tab.'
		}
	];

	function feedLines(count: number): Line[] {
		return FEED.slice(0, count).map((e, i, shown) => {
			const who = e.who === 'mira' ? MIRA : BOT;
			return {
				id: e.id,
				...who,
				time: e.time,
				text: e.text ?? '',
				mira: e.who === 'mira',
				bot: e.who === 'bot',
				pop: e.xp ? e.at : null,
				continued: i > 0 && shown[i - 1].who === e.who
			};
		});
	}

	function levelAt(xp: number) {
		let lv = 1;
		while (xp >= xpForLevel(lv + 1, BASE_XP, MULTIPLIER)) lv++;
		return lv;
	}

	const endXp = START_XP + FEED.filter((e) => e.xp).length * XP_PER_MESSAGE;
	const level = levelAt(endXp);
	const floorXp = xpForLevel(level, BASE_XP, MULTIPLIER);
	const nextXp = xpForLevel(level + 1, BASE_XP, MULTIPLIER);
	const ratio = (endXp - floorXp) / (nextXp - floorXp);
	const filled = Math.round(ratio * 10);

	const fields = [
		{ name: '📊 Total XP', value: endXp.toLocaleString('en-US'), inline: true },
		{ name: '🏆 Rank', value: '#12 (▲3)', inline: true },
		{ name: '🎁 Reward unlocked', role: ROLE },
		{
			name: `⚡ Progress to Level ${level + 1}`,
			value: `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${Math.round(ratio * 100)}%\n**${(nextXp - endXp).toLocaleString('en-US')}** XP to go`
		}
	];
	const footer = `Powered by ${APP_DOMAIN} ${new Date().getFullYear()}`;
	const buttons = [{ label: '👤 Account' }, { label: '🌐 Leaderboard', link: true }];

	const clock = new SceneClock(DURATION, REST);
	const t = $derived(clock.t);

	const shown = $derived(FEED.filter((e) => t >= e.at).length);
	const lines = $derived([...CONTEXT, ...feedLines(shown)]);
	const resetting = $derived(t < 500);

	const draft = $derived.by(() => {
		const typing = FEED.find((e) => e.typeFrom !== undefined && t >= e.typeFrom && t < e.at);
		if (!typing?.text || typing.typeFrom === undefined) return '';
		return Array.from(typing.text)
			.slice(0, Math.floor((t - typing.typeFrom) / TYPE_MS))
			.join('');
	});

	const fade = $derived(Math.max(0, Math.min(1, t / 300, (DURATION - t) / 400)));
	const roleOn = $derived(t >= ROLE_AT);
	const active = $derived(STEPS.findIndex((s) => t >= s.from && t < s.to));
	const progress = $derived(active < 0 ? 0 : (t - STEPS[active].from) / (STEPS[active].to - STEPS[active].from));
</script>

<div use:playWhenVisible={clock} class="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
	<DiscordWindow server="{APP_NAME} Community" channel="general" {draft} typing={t >= BOT_TYPING_AT && t < EMBED_AT ? APP_NAME : null} {fade}>
		{#each lines as line (line.id)}
			<div animate:flip={{ duration: resetting ? 0 : 320, easing: quintOut }} in:fly={{ y: 8, duration: 320, easing: quintOut }}>
				<DiscordMessage
					name={line.name}
					avatar={line.avatar}
					time={line.time}
					app={line.bot}
					continued={line.continued}
					nameColor={line.mira && roleOn ? ROLE.color : null}
				>
					{#if line.bot}
						<DiscordEmbed color={BRAND_PRIMARY} title="🎉 Level Up!" thumbnail={MIRA.avatar} {fields} {footer} {buttons}>
							{#snippet description()}
								<span class="rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">@{MIRA.name}</span> has reached
								<strong class="font-semibold">Level {level}</strong>!
							{/snippet}
						</DiscordEmbed>
					{:else}
						{line.text}
					{/if}
					{#snippet aside()}
						{#if line.pop !== null && t >= line.pop + 120 && t < line.pop + 1220}
							<span
								class="xp-pop text-brand-gold pointer-events-none absolute top-1 right-4 inline-flex items-center gap-1 rounded-full bg-[#efb11d]/15 px-2 py-0.5 text-[12px] font-bold"
							>
								<i class="fas fa-star text-[10px]"></i>+{XP_PER_MESSAGE} XP
							</span>
						{/if}
					{/snippet}
				</DiscordMessage>
			</div>
		{/each}
	</DiscordWindow>

	<ol class="flex flex-col">
		{#each STEPS as step, i (step.title)}
			{@const state = clock.still || t >= step.to ? 'done' : i === active ? 'active' : 'next'}
			<li class="relative py-3 pl-5 transition-opacity duration-300 ease-out {state === 'next' ? 'opacity-45' : 'opacity-100'}">
				<span class="bg-base-300 absolute top-3.5 bottom-3.5 left-0 w-0.5 overflow-hidden rounded-full">
					<span class="bg-primary block h-full w-full origin-top" style="transform: scaleY({state === 'done' ? 1 : state === 'active' ? progress : 0})"></span>
				</span>
				<p class="text-base-content text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">
					<span class="text-primary mr-2 tabular-nums">0{i + 1}</span>{step.title}
				</p>
				<p class="text-base-content/70 mt-1 text-[12.5px] leading-[1.5]">{step.desc}</p>
			</li>
		{/each}
	</ol>
</div>

<style>
	.xp-pop {
		animation: xp-pop 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes xp-pop {
		0% {
			opacity: 0;
			transform: translateY(4px) scale(0.96);
		}
		18% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-14px) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.xp-pop {
			animation: none;
		}
	}
</style>
