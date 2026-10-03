<script lang="ts">
	import { untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { SceneClock, playWhenVisible } from './clock.svelte.js';
	import BrowserFrame from './BrowserFrame.svelte';
	import DiscordEmbed from './DiscordEmbed.svelte';
	import DiscordMessage from './DiscordMessage.svelte';
	import DiscordMobileChat from './DiscordMobileChat.svelte';
	import DiscordWindow from './DiscordWindow.svelte';
	import PhoneFrame from './PhoneFrame.svelte';
	import Rich from './Rich.svelte';
	import type { Scene, SceneEvent } from './types.js';

	let { scenes, label, variant = 'desktop' }: { scenes: Scene[]; label: string; variant?: 'desktop' | 'phone' } = $props();

	const TYPE_MS = 40;
	const POP_TONES = { gold: '#efb11d', red: '#f23f43', green: '#23a55a' } as const;

	let index = $state(0);
	const scene = $derived(scenes[index]);

	const clock = untrack(() => new SceneClock(scenes[0].duration, scenes[0].rest));
	let startedFromRest = true;
	clock.onend = () => {
		if (startedFromRest) startedFromRest = false;
		else select((index + 1) % scenes.length);
	};

	function select(i: number) {
		startedFromRest = false;
		index = i;
		clock.duration = scenes[i].duration;
		clock.t = clock.still ? scenes[i].rest : 0;
	}

	const t = $derived(clock.t);

	function plain(text: string) {
		return text
			.replace(/<@bot>/g, `@${APP_NAME}`)
			.replace(/<@&?([^>]+)>/g, '@$1')
			.replace(/<#([^>]+)>/g, '#$1')
			.replace(/\*\*/g, '');
	}

	function replyOf(sc: Scene, event: SceneEvent) {
		if (!event.replyTo) return null;
		const target = [...(sc.context ?? []), ...(sc.events ?? [])].find((e) => e.id === event.replyTo);
		const person = target ? sc.people?.[target.who] : null;
		return target && person ? { name: person.name, avatar: person.avatar, text: plain(target.text ?? '') } : null;
	}

	function build(sc: Scene, count: number) {
		const list = [...(sc.context ?? []), ...(sc.events ?? []).slice(0, count)];
		return list.map((event, i) => {
			const prev = list[i - 1];
			return {
				key: `${sc.id}:${event.id}`,
				event,
				person: sc.people?.[event.who] ?? { name: '', avatar: '' },
				system: event.who === 'system',
				reply: replyOf(sc, event),
				continued: !!prev && prev.who === event.who && !event.newGroup && !event.ephemeral && !prev.ephemeral && !event.replyTo
			};
		});
	}

	const shown = $derived((scene.events ?? []).filter((e) => t >= e.at).length);
	const lines = $derived(build(scene, shown));
	const resetting = $derived(t < 500);
	const animMs = $derived(clock.still ? 0 : 320);

	function view(e: SceneEvent, now: number) {
		let text = e.text;
		let embed = e.embed;
		for (const p of scene.patches ?? []) {
			if (p.id !== e.id || now < p.at) continue;
			if (p.text !== undefined) text = p.text;
			if (p.embed && embed) embed = { ...embed, ...p.embed };
		}
		return { text, embed };
	}

	function nameColor(who: string, now: number) {
		let color: string | null = null;
		for (const c of scene.nameColors ?? []) if (c.who === who && now >= c.at) color = c.color;
		return color;
	}

	const draft = $derived.by(() => {
		const typing = (scene.events ?? []).find((e) => e.typeFrom !== undefined && t >= e.typeFrom && t < e.at);
		if (!typing?.text || typing.typeFrom === undefined) return '';
		return Array.from(plain(typing.text))
			.slice(0, Math.floor((t - typing.typeFrom) / TYPE_MS))
			.join('');
	});

	const typingWho = $derived.by(() => {
		const run = scene.typing?.find((r) => t >= r.from && t < r.to);
		return run ? (scene.people?.[run.who]?.name ?? null) : null;
	});

	const fade = $derived(Math.max(0, Math.min(1, t / 300, (scene.duration - t) / 400)));
	const active = $derived(scene.steps.findIndex((s) => t >= s.from && t < s.to));
	const progress = $derived(active < 0 ? 0 : (t - scene.steps[active].from) / (scene.steps[active].to - scene.steps[active].from));
</script>

{#snippet feed()}
	{#each lines as line (line.key)}
		{@const v = view(line.event, t)}
		<div animate:flip={{ duration: resetting ? 0 : animMs, easing: quintOut }} in:fly={{ y: 8, duration: animMs, easing: quintOut }}>
			{#if line.system}
				<div class="mt-3 flex items-center gap-4 px-4 py-0.5">
					<span class="flex w-10 shrink-0 justify-center"><i class="fas fa-arrow-right text-[15px] text-[#23a55a]"></i></span>
					<p class="text-ash-200 min-w-0 text-[14.5px] leading-[1.375]">
						<Rich text={v.text ?? ''} roles={scene.roles} /><span class="text-ash-300 ml-1.5 text-[12px]">{line.event.time}</span>
					</p>
				</div>
			{:else}
				<DiscordMessage
					name={line.person.name}
					avatar={line.person.avatar}
					time={line.event.time}
					app={line.person.app}
					continued={line.continued}
					ephemeral={line.event.ephemeral}
					reply={line.reply}
					nameColor={nameColor(line.event.who, t)}
				>
					{#if v.text}<Rich text={v.text} roles={scene.roles} />{/if}
					{#if v.embed}<DiscordEmbed embed={v.embed} roles={scene.roles} {t} />{/if}
					{#snippet aside()}
						{@const pop = line.event.pop}
						{#if pop && t >= line.event.at + 120 && t < line.event.at + 1220}
							<span
								class="scene-pop pointer-events-none absolute top-1 right-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold"
								style="color: {POP_TONES[pop.tone]}; background: color-mix(in srgb, {POP_TONES[pop.tone]} 16%, transparent);"
							>
								{pop.text}
							</span>
						{/if}
					{/snippet}
				</DiscordMessage>
			{/if}
		</div>
	{/each}
{/snippet}

{#snippet stepList(sc: Scene, live: boolean, compact: boolean)}
	<ol class="flex flex-col">
		{#each sc.steps as step, i (`${sc.id}:${i}`)}
			{@const state = !live ? 'next' : clock.still || t >= step.to ? 'done' : i === active ? 'active' : 'next'}
			<li class="relative pl-5 transition-opacity duration-300 ease-out {compact ? 'py-2' : 'py-3'} {state === 'next' ? 'opacity-45' : 'opacity-100'}">
				<span class="bg-base-300 absolute left-0 w-0.5 overflow-hidden rounded-full {compact ? 'top-2.5 bottom-2.5' : 'top-3.5 bottom-3.5'}">
					<span class="bg-primary block h-full w-full origin-top" style="transform: scaleY({state === 'done' ? 1 : state === 'active' ? progress : 0})"></span>
				</span>
				<p class="text-base-content leading-[1.32] font-extrabold tracking-[0.02em] uppercase {compact ? 'text-[12px]' : 'text-[13px]'}">
					<span class="text-primary mr-2 tabular-nums">0{i + 1}</span>{step.title}
				</p>
				<p class="text-base-content/70 mt-1 leading-[1.5] {compact ? 'text-[12px]' : 'text-[12.5px]'}">{step.desc}</p>
			</li>
		{/each}
	</ol>
{/snippet}

{#if variant === 'desktop'}
	<div use:playWhenVisible={clock} class="flex flex-col gap-4">
		<div role="tablist" aria-label={label} class="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-1">
			{#each scenes as s, i (s.id)}
				{@const on = i === index}
				<button
					type="button"
					role="tab"
					aria-selected={on}
					onclick={() => select(i)}
					class="relative flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg border px-2.5 py-2 text-[10px] font-extrabold tracking-[0.02em] uppercase transition-colors duration-200 sm:gap-2 sm:rounded-sm sm:border-0 sm:px-3 sm:pt-2 sm:pb-2.5 sm:text-[11.5px] sm:tracking-[0.08em] {on
						? 'border-primary/40 bg-base-100 text-base-content sm:bg-transparent'
						: 'border-base-300 text-base-content/55 hover:text-base-content/75'}"
				>
					<i class="fas {s.icon} shrink-0 {on ? 'text-primary' : ''}"></i><span class="truncate">{s.label}</span>
					<span class="bg-base-300 absolute right-2.5 bottom-0 left-2.5 h-0.5 overflow-hidden rounded-full sm:right-3 sm:left-3">
						{#if on}
							<span class="bg-primary block h-full w-full origin-left" style="transform: scaleX({clock.still ? 1 : t / s.duration})"></span>
						{/if}
					</span>
				</button>
			{/each}
		</div>

		<div class="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
			{#if scene.screen}
				{@const Screen = scene.screen}
				<BrowserFrame url={scene.url ?? ''}>
					<div class="h-full" style="opacity: {fade}"><Screen {t} still={clock.still} /></div>
				</BrowserFrame>
			{:else}
				<DiscordWindow server={scene.server ?? 'Night Owls'} channel={scene.channel ?? 'general'} {draft} typing={typingWho} {fade}>
					{@render feed()}
				</DiscordWindow>
			{/if}
			{@render stepList(scene, true, false)}
		</div>
	</div>
{:else}
	<div use:playWhenVisible={clock} class="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
		<div class="relative isolate flex justify-center py-6 lg:order-last">
			<span class="scene-stage pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></span>
			<PhoneFrame dark={!scene.url}>
				{#if scene.screen}
					{@const Screen = scene.screen}
					<div class="flex min-h-0 flex-1 flex-col" style="opacity: {fade}"><Screen {t} still={clock.still} /></div>
				{:else}
					<DiscordMobileChat channel={scene.channel ?? 'general'} {draft} typing={typingWho} {fade}>
						{@render feed()}
					</DiscordMobileChat>
				{/if}
			</PhoneFrame>
		</div>

		<ul aria-label={label} class="flex flex-col gap-2.5">
			{#each scenes as s, i (s.id)}
				{@const on = i === index}
				<li
					class="rounded-2xl border transition-[border-color,background-color,box-shadow] duration-300 {on
						? 'border-primary/35 bg-base-100 shadow-sm'
						: 'border-base-300 hover:border-base-content/25'}"
				>
					<button type="button" aria-expanded={on} onclick={() => select(i)} class="flex w-full items-center gap-3.5 p-4 text-left">
						<span
							class="grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-300 {on
								? 'bg-primary text-primary-content'
								: 'bg-base-300/60 text-base-content/60'}"
						>
							<i class="fas {s.icon}"></i>
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-[13px] font-extrabold tracking-[0.04em] uppercase {on ? 'text-base-content' : 'text-base-content/70'}">{s.label}</span>
							{#if s.tagline}<span class="text-base-content/60 mt-0.5 block text-[12.5px] leading-[1.45]">{s.tagline}</span>{/if}
						</span>
						<span class="text-base-content/20 shrink-0 text-[20px] leading-none font-black tabular-nums">0{i + 1}</span>
					</button>
					<div class="scene-panel grid {on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}">
						<div class="min-h-0 overflow-hidden">
							<div class="px-4 pb-3">
								<span class="bg-base-300 mb-1 block h-0.5 overflow-hidden rounded-full">
									<span class="bg-primary block h-full w-full origin-left" style="transform: scaleX({on ? (clock.still ? 1 : t / s.duration) : 0})"></span>
								</span>
								{@render stepList(s, on, true)}
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.scene-pop {
		animation: scene-pop 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes scene-pop {
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

	.scene-panel {
		transition: grid-template-rows 360ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.scene-stage {
		background:
			radial-gradient(closest-side, color-mix(in srgb, var(--color-primary) 26%, transparent), transparent),
			radial-gradient(circle, color-mix(in srgb, var(--color-base-content) 14%, transparent) 1px, transparent 1.6px) 0 0 / 18px 18px;
		-webkit-mask-image: radial-gradient(closest-side, #000 55%, transparent);
		mask-image: radial-gradient(closest-side, #000 55%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.scene-pop {
			animation: none;
		}

		.scene-panel {
			transition: none;
		}
	}
</style>
