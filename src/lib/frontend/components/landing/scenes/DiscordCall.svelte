<script lang="ts">
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';
	import { tapping } from './clock.svelte.js';
	import Tap from './Tap.svelte';
	import type { Person, SceneCall, SceneCallMember } from './types.js';

	let { call, people, t, still }: { call: SceneCall; people: Record<string, Person>; t: number; still: boolean } = $props();

	const POP_MS = 1100;
	const POP_GAP_MS = 140;

	const present = $derived(call.members.filter((m) => t >= (m.joinAt ?? -1)));
	const percent = $derived(present.filter((m) => m.who !== call.me).length * 10);
	const camera = $derived(t >= call.cameraAt);
	const live = $derived(t >= call.liveAt);
	const tick = $derived(still ? null : (call.ticks.find((k) => t >= k.at && t < k.at + POP_MS + k.gains.length * POP_GAP_MS) ?? null));
	const animMs = $derived(still || t < 500 ? 0 : 320);

	const talking = (m: SceneCallMember) => (m.talk ?? []).some(([from, to]) => t >= from && t < to);
</script>

<div class="bg-ash-950 shrink-0 px-3 pt-2 pb-3 sm:px-4">
	<div class="flex h-7 items-center gap-2">
		<i class="fas fa-volume-high text-ash-200 text-[12px]"></i>
		<span class="text-ash-50 text-[13.5px] font-semibold">{call.channel}</span>
		{#if percent > 0}
			{#key percent}
				<span class="call-boost rounded-full bg-[#23a55a]/20 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-[#57f287]">
					🤝 +{percent}%<span class="hidden sm:inline"> Friend boost</span>
				</span>
			{/key}
		{/if}
		<span class="ml-auto flex shrink-0 items-center gap-1.5 text-[11px]">
			<span
				class="relative grid size-7 place-items-center rounded-full transition-colors duration-200 {camera
					? 'bg-ash-50 text-ash-950'
					: 'bg-ash-700 text-ash-100'}"
			>
				<i class="fas {camera ? 'fa-video' : 'fa-video-slash'}"></i>
				{#if tapping(t, call.cameraAt)}<Tap />{/if}
			</span>
			<span
				class="relative grid size-7 place-items-center rounded-full transition-colors duration-200 {live
					? 'bg-ash-50 text-ash-950'
					: 'bg-ash-700 text-ash-100'}"
			>
				<i class="fas fa-display"></i>
				{#if tapping(t, call.liveAt)}<Tap />{/if}
			</span>
			<span class="grid size-7 place-items-center rounded-full bg-[#da373c] text-white"><i class="fas fa-phone-slash"></i></span>
		</span>
	</div>

	<div class="mt-2 flex justify-center gap-2">
		{#each present as m (m.who)}
			{@const person = people[m.who]}
			{@const me = m.who === call.me}
			<div
				animate:flip={{ duration: animMs, easing: quintOut }}
				in:scale={{ start: 0.8, duration: animMs, easing: quintOut }}
				class="relative h-[84px] w-[calc((100%-1rem)/3)] max-w-40 sm:h-[92px]"
			>
				<div class="bg-ash-800 relative grid size-full place-items-center overflow-hidden rounded-xl">
					<img src={person.avatar} alt="" class="size-10 rounded-full" loading="lazy" />
					{#if me && camera}
						<img
							in:scale={{ start: 1.25, duration: animMs, easing: quintOut }}
							src={person.avatar}
							alt=""
							class="absolute inset-0 size-full object-cover"
							loading="lazy"
						/>
					{/if}
					<span class="call-ring absolute inset-0 rounded-xl" class:call-ring-on={talking(m)}></span>
					{#if me && live}
						<span
							in:scale={{ start: 0.6, duration: animMs, easing: quintOut }}
							class="absolute top-1.5 left-1.5 rounded-[4px] bg-[#f23f43] px-1 text-[9px] leading-[14px] font-extrabold tracking-[0.04em] text-white"
						>
							LIVE
						</span>
					{/if}
					<span
						class="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold text-white"
					>
						{#if me && camera}<i class="fas fa-video text-[8.5px]"></i>{/if}
						<span class="truncate">{person.name}</span>
					</span>
				</div>
				{#if me && tick}
					{#each tick.gains as gain, i (`${tick.at}:${i}`)}
						<span
							class="call-pop pointer-events-none absolute right-1.5 rounded-full bg-black/75 px-1.5 py-px text-[10.5px] font-bold whitespace-nowrap text-[#efb11d]"
							style="top: {6 + i * 21}px; animation-delay: {i * POP_GAP_MS}ms; animation-duration: {POP_MS}ms"
						>
							{gain}
						</span>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.call-ring {
		box-shadow: inset 0 0 0 2px #23a55a;
		opacity: 0;
		transition: opacity 180ms ease;
	}

	.call-ring-on {
		opacity: 1;
	}

	.call-boost {
		animation: call-bump 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.call-pop {
		animation: call-pop cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes call-bump {
		0% {
			opacity: 0;
			transform: scale(0.82);
		}
		55% {
			opacity: 1;
			transform: scale(1.1);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes call-pop {
		0% {
			opacity: 0;
			transform: translateY(6px) scale(0.92);
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
		.call-ring {
			transition: none;
		}

		.call-boost,
		.call-pop {
			animation: none;
		}
	}
</style>
