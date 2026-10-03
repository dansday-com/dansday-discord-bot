<script lang="ts">
	import { untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { SceneClock, playWhenVisible } from './clock.svelte.js';
	import DiscordEmbed from './DiscordEmbed.svelte';
	import DiscordMessage from './DiscordMessage.svelte';
	import DiscordWindow from './DiscordWindow.svelte';
	import Rich from './Rich.svelte';
	import type { Scene, SceneEvent } from './types.js';

	let { scenes, label }: { scenes: Scene[]; label: string } = $props();

	const TYPE_MS = 40;
	const POP_TONES = { gold: '#efb11d', red: '#f23f43', green: '#23a55a' } as const;

	let index = $state(0);
	const scene = $derived(scenes[index]);

	const clock = untrack(() => new SceneClock(scenes[0].duration, scenes[0].rest));
	clock.onend = () => select((index + 1) % scenes.length);

	function select(i: number) {
		index = i;
		clock.duration = scenes[i].duration;
		clock.t = clock.still ? scenes[i].rest : 0;
	}

	const t = $derived(clock.t);

	function build(sc: Scene, count: number) {
		const list = [...sc.context, ...sc.events.slice(0, count)];
		return list.map((event, i) => {
			const prev = list[i - 1];
			return {
				key: `${sc.id}:${event.id}`,
				event,
				person: sc.people[event.who] ?? { name: '', avatar: '' },
				system: event.who === 'system',
				reply: replyOf(sc, event),
				continued: !!prev && prev.who === event.who && !event.newGroup && !event.ephemeral && !prev.ephemeral && !event.replyTo
			};
		});
	}

	function plain(text: string) {
		return text
			.replace(/<@bot>/g, `@${APP_NAME}`)
			.replace(/<@&?([^>]+)>/g, '@$1')
			.replace(/<#([^>]+)>/g, '#$1')
			.replace(/\*\*/g, '');
	}

	function replyOf(sc: Scene, event: SceneEvent) {
		if (!event.replyTo) return null;
		const target = [...sc.context, ...sc.events].find((e) => e.id === event.replyTo);
		const person = target ? sc.people[target.who] : null;
		return target && person ? { name: person.name, avatar: person.avatar, text: plain(target.text ?? '') } : null;
	}

	const shown = $derived(scene.events.filter((e) => t >= e.at).length);
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
		const typing = scene.events.find((e) => e.typeFrom !== undefined && t >= e.typeFrom && t < e.at);
		if (!typing?.text || typing.typeFrom === undefined) return '';
		return Array.from(plain(typing.text))
			.slice(0, Math.floor((t - typing.typeFrom) / TYPE_MS))
			.join('');
	});

	const typingWho = $derived.by(() => {
		const run = scene.typing?.find((r) => t >= r.from && t < r.to);
		return run ? scene.people[run.who].name : null;
	});

	const fade = $derived(Math.max(0, Math.min(1, t / 300, (scene.duration - t) / 400)));
	const active = $derived(scene.steps.findIndex((s) => t >= s.from && t < s.to));
	const progress = $derived(active < 0 ? 0 : (t - scene.steps[active].from) / (scene.steps[active].to - scene.steps[active].from));
</script>

<div use:playWhenVisible={clock} class="flex flex-col gap-4">
	<div role="tablist" aria-label={label} class="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
		{#each scenes as s, i (s.id)}
			<button
				type="button"
				role="tab"
				aria-selected={i === index}
				onclick={() => select(i)}
				class="relative flex shrink-0 items-center gap-2 rounded-sm px-3 pt-2 pb-2.5 text-[11.5px] font-extrabold tracking-[0.08em] uppercase transition-colors duration-200 {i ===
				index
					? 'text-base-content'
					: 'text-base-content/45 hover:text-base-content/75'}"
			>
				<i class="fas {s.icon} {i === index ? 'text-primary' : ''}"></i>{s.label}
				<span class="bg-base-300 absolute right-3 bottom-0 left-3 h-0.5 overflow-hidden rounded-full">
					{#if i === index}
						<span class="bg-primary block h-full w-full origin-left" style="transform: scaleX({clock.still ? 1 : t / s.duration})"></span>
					{/if}
				</span>
			</button>
		{/each}
	</div>

	<div class="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
		<DiscordWindow server={scene.server ?? 'Night Owls'} channel={scene.channel} {draft} typing={typingWho} {fade}>
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
		</DiscordWindow>

		<ol class="flex flex-col">
			{#each scene.steps as step, i (`${scene.id}:${i}`)}
				{@const state = clock.still || t >= step.to ? 'done' : i === active ? 'active' : 'next'}
				<li class="relative py-3 pl-5 transition-opacity duration-300 ease-out {state === 'next' ? 'opacity-45' : 'opacity-100'}">
					<span class="bg-base-300 absolute top-3.5 bottom-3.5 left-0 w-0.5 overflow-hidden rounded-full">
						<span class="bg-primary block h-full w-full origin-top" style="transform: scaleY({state === 'done' ? 1 : state === 'active' ? progress : 0})"
						></span>
					</span>
					<p class="text-base-content text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">
						<span class="text-primary mr-2 tabular-nums">0{i + 1}</span>{step.title}
					</p>
					<p class="text-base-content/70 mt-1 text-[12.5px] leading-[1.5]">{step.desc}</p>
				</li>
			{/each}
		</ol>
	</div>
</div>

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

	@media (prefers-reduced-motion: reduce) {
		.scene-pop {
			animation: none;
		}
	}
</style>
