<script lang="ts">
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { APP_NAME } from '$lib/backend/panelServer.js';
	import { avatar } from '../scripts/common.js';
	import type { SceneScreenProps } from '../types.js';

	let { t, still }: SceneScreenProps = $props();

	const PEOPLE = [
		{ id: 'mira', name: 'Mira', avatar: avatar(2), muted: false },
		{ id: 'bot', name: APP_NAME, avatar: '/favicon-96x96.png', muted: false },
		{ id: 'kai', name: 'Kai', avatar: avatar(0), muted: true },
		{ id: 'rin', name: 'Rin', avatar: avatar(3), muted: false }
	];

	const SPEECH = [
		{ id: 's1', who: 'mira', from: 900, to: 1700, text: 'hey stupid' },
		{ id: 's2', who: 'bot', from: 1900, to: 2500, text: 'Yes?' },
		{ id: 's3', who: 'mira', from: 2900, to: 5000, text: "who's top of the leaderboard this week?" },
		{ id: 's4', who: 'bot', from: 5500, to: 9700, text: "Kai, with 18,240 XP this week. You're third, 2,100 behind Rin." },
		{ id: 's5', who: 'mira', from: 10300, to: 11200, text: "nice, I'm done" }
	];
	const AWAKE = { from: 1800, to: 11700 };

	const nameOf = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? '';
	const speaking = (id: string) => SPEECH.some((s) => s.who === id && t >= s.from && t < s.to);
	const botMuted = $derived(t < AWAKE.from || t >= AWAKE.to);
	const heardCount = $derived(SPEECH.filter((s) => t >= s.from + 150).length);
	const heard = $derived(SPEECH.slice(0, heardCount).slice(-3));
	const asleep = $derived(t >= AWAKE.to + 200);
	const animMs = $derived(still ? 0 : 320);
</script>

<div class="flex min-h-0 flex-1 flex-col bg-[#1a1b1e]">
	<div class="flex h-12 shrink-0 items-center gap-3 px-4">
		<i class="fas fa-chevron-down text-ash-200 text-[14px]"></i>
		<div class="min-w-0 leading-tight">
			<p class="text-ash-50 flex items-center gap-1.5 text-[15px] font-bold"><i class="fas fa-volume-high text-ash-200 text-[12px]"></i>Squad</p>
			<p class="text-ash-200 text-[11px]">Night Owls</p>
		</div>
		<i class="fas fa-user-plus text-ash-200 ml-auto text-[14px]"></i>
	</div>

	<div class="grid shrink-0 grid-cols-2 gap-2 px-3 pt-1">
		{#each PEOPLE as p (p.id)}
			{@const talking = speaking(p.id)}
			{@const muted = p.id === 'bot' ? botMuted : p.muted}
			<div class="voice-tile bg-ash-800 relative grid aspect-[4/3.3] place-items-center rounded-2xl" class:voice-tile-on={talking}>
				<img src={p.avatar} alt="" class="voice-avatar size-[60px] rounded-full" class:voice-avatar-on={talking} loading="lazy" />
				{#if p.id === 'bot' && talking}
					<span class="voice-bars absolute top-2.5 right-3 flex h-3.5 items-end gap-[3px]"><i></i><i></i><i></i><i></i><i></i></span>
				{/if}
				<span
					class="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white"
				>
					{#if muted}<i class="fas fa-microphone-slash text-[10px] text-[#f23f43]"></i>{/if}
					<span class="truncate">{p.name}</span>
					{#if p.id === 'bot'}<span class="rounded-[3px] bg-[#5865f2] px-1 text-[8.5px] leading-[13px] font-bold">APP</span>{/if}
				</span>
			</div>
		{/each}
	</div>

	<div class="border-ash-700/60 bg-ash-900 mx-3 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-3">
		<p class="text-ash-200 flex shrink-0 items-center gap-1.5 text-[10.5px] font-bold tracking-[0.08em] uppercase">
			<i class="fas fa-wave-square"></i>Said in the call
		</p>
		<div class="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden">
			{#each heard as line (line.id)}
				<p
					animate:flip={{ duration: animMs, easing: quintOut }}
					in:fly={{ y: 8, duration: animMs, easing: quintOut }}
					class="text-ash-100 text-[13px] leading-snug"
				>
					<b class="font-semibold {line.who === 'bot' ? 'text-[#c9cdfb]' : 'text-ash-50'}">{nameOf(line.who)}</b>
					{line.text}
				</p>
			{/each}
			{#if asleep}
				<p in:fly={{ y: 8, duration: animMs, easing: quintOut }} class="text-ash-200 text-[12px] italic">
					<i class="fas fa-microphone-slash mr-1 text-[10px] text-[#f23f43]"></i>{APP_NAME} muted itself. Say "hey stupid" to wake it.
				</p>
			{/if}
		</div>
	</div>

	<div class="flex h-[68px] shrink-0 items-center justify-center gap-3">
		<span class="bg-ash-700 text-ash-100 grid size-11 place-items-center rounded-full"><i class="fas fa-video-slash"></i></span>
		<span class="bg-ash-700 text-ash-100 grid size-11 place-items-center rounded-full"><i class="fas fa-microphone"></i></span>
		<span class="bg-ash-700 text-ash-100 grid size-11 place-items-center rounded-full"><i class="fas fa-volume-high"></i></span>
		<span class="grid size-11 place-items-center rounded-full bg-[#da373c] text-white"><i class="fas fa-phone-slash"></i></span>
	</div>
</div>

<style>
	.voice-tile {
		box-shadow: inset 0 0 0 0 transparent;
		transition: box-shadow 200ms ease;
	}

	.voice-tile-on {
		box-shadow: inset 0 0 0 2px #23a55a;
	}

	.voice-avatar {
		box-shadow: 0 0 0 0 transparent;
		transition: box-shadow 200ms ease;
	}

	.voice-avatar-on {
		box-shadow: 0 0 0 3px #23a55a;
	}

	.voice-bars i {
		display: block;
		width: 3px;
		height: 100%;
		border-radius: 2px;
		background: #23a55a;
		transform-origin: bottom;
		animation: voice-bar 0.9s ease-in-out infinite;
	}

	.voice-bars i:nth-child(2) {
		animation-delay: -0.3s;
	}

	.voice-bars i:nth-child(3) {
		animation-delay: -0.6s;
	}

	.voice-bars i:nth-child(4) {
		animation-delay: -0.15s;
	}

	.voice-bars i:nth-child(5) {
		animation-delay: -0.45s;
	}

	@keyframes voice-bar {
		0%,
		100% {
			transform: scaleY(0.3);
		}
		50% {
			transform: scaleY(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.voice-bars i {
			animation: none;
			transform: scaleY(0.6);
		}
	}
</style>
