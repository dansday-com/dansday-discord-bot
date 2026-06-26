<script lang="ts">
	import { getContext } from 'svelte';
	import { ITEM_EFFECTS, effectAccentHex, effectGuide, effectSummary } from '$lib/items.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;

	// Real configured items for this server, keyed by effect type, so the guide shows actual costs.
	const itemByEffect = $derived.by(() => {
		const map = new Map<string, any>();
		for (const it of (data.items ?? []) as any[]) {
			if (!map.has(it.effect_type)) map.set(it.effect_type, it);
		}
		return map;
	});

	// Walk the full catalog so every item type is explained, even if not enabled yet.
	const guideItems = $derived.by(() =>
		ITEM_EFFECTS.filter((e) => e.id !== 'gamble' || itemByEffect.has('gamble')).map((e) => {
			const live = itemByEffect.get(e.id);
			return {
				id: e.id,
				label: live?.name || e.label,
				emoji: e.emoji,
				icon: e.icon,
				accent: effectAccentHex(e.id),
				cost: live?.cost ?? null,
				available: !!live,
				summary: live ? effectSummary({ effect_type: e.id, config: live.config }) : e.summary(e.defaultConfig),
				guide: effectGuide(e.id)
			};
		})
	);

	const earnMethods = [
		{ icon: 'fa-comments', accent: '#5a8a1f', title: 'Chat', desc: 'Send messages in enabled channels to steadily earn XP.' },
		{ icon: 'fa-microphone', accent: '#1d6f8a', title: 'Voice', desc: 'Hang out in voice channels — XP ticks up the longer you stay active.' },
		{ icon: 'fa-video', accent: '#7b5ea7', title: 'Video', desc: 'Turn your camera on in voice for bonus XP per minute.' },
		{ icon: 'fa-tower-broadcast', accent: '#c8911a', title: 'Streaming', desc: 'Go live / screen-share in voice for extra XP per minute.' }
	];

	const steps = [
		{ icon: 'fa-store', title: 'Open the Shop', desc: 'Browse items by category. Each shows its cost and what it does.' },
		{ icon: 'fa-coins', title: 'Buy with XP', desc: 'Spend your earned XP. The item drops into your Bag (holds up to 50).' },
		{ icon: 'fa-bag-shopping', title: 'Open your Bag', desc: 'Find the item and hit Use. Buffs apply to you instantly.' },
		{ icon: 'fa-crosshairs', title: 'Pick a target', desc: 'Offensive items (steal, bomb, leech, spy, gift, bounty) ask who to use it on.' }
	];

	const tips = [
		{ icon: 'fa-magnifying-glass', accent: effectAccentHex('spy'), text: 'Spy before you attack — never waste an item on a shielded target.' },
		{ icon: 'fa-shield', accent: effectAccentHex('shield'), text: 'Raise a Shield before you log off so nobody farms you while away.' },
		{ icon: 'fa-soap', accent: effectAccentHex('purifier'), text: 'Stuck with a leech draining you? A Purifier wipes it instantly.' },
		{ icon: 'fa-mask', accent: effectAccentHex('disguise'), text: 'Disguise lets you strike rivals without revealing who you are.' },
		{ icon: 'fa-handshake', accent: '#2f8f4e', text: 'Grind voice with friends — Friend Boost stacks +10% each.' },
		{ icon: 'fa-arrows-rotate', accent: effectAccentHex('reflect'), text: 'Expecting a hit? Reflect turns their attack back on them.' }
	];

	function fmtCost(n: number | null): string {
		if (n == null) return '';
		return (ctx?.fmt ? ctx.fmt(n) : Number(n).toLocaleString()) + ' XP';
	}

	// Scroll-reveal: add .in when a section enters the viewport.
	function reveal(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') {
			node.classList.add('in');
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						(e.target as HTMLElement).classList.add('in');
						io.unobserve(e.target);
					}
				}
			},
			{ threshold: 0.12 }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Items Guide | {APP_NAME} Discord Bot</title></svelte:head>

<div class="g-wrap">
	<header class="g-hero" use:reveal>
		<div class="g-hero-badge"><i class="fas fa-book-open"></i></div>
		<h1 class="g-hero-title">How the Item Game Works</h1>
		<p class="g-hero-sub">Earn XP, spend it in the shop, and outplay everyone with steals, shields, spies and more.</p>
	</header>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-bolt"></i>How to earn XP</h2>
		<p class="g-sec-lead">XP is the currency. The more you earn, the more you can buy — and the higher you climb the leaderboard.</p>
		<div class="g-earn">
			{#each earnMethods as m, i}
				<div class="g-earn-card" style="--ac: {m.accent}; --d: {i * 70}ms">
					<span class="g-earn-ic"><i class="fas {m.icon}"></i></span>
					<div class="g-earn-body">
						<h3>{m.title}</h3>
						<p>{m.desc}</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="g-friend" style="--ac: #2f8f4e">
			<span class="g-friend-ic"><i class="fas fa-handshake"></i></span>
			<div class="g-friend-body">
				<h3>🤝 Friend Boost</h3>
				<p>
					Hang out in the <strong>same voice channel</strong> as other members and your voice XP gets a
					<strong>+10% boost for every friend</strong> in there with you. Five friends? That's <strong>+50% XP</strong> — it stacks.
				</p>
			</div>
		</div>
	</section>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-cart-shopping"></i>How to buy &amp; use items</h2>
		<div class="g-steps">
			{#each steps as s, i}
				<div class="g-step" style="--d: {i * 80}ms">
					<span class="g-step-num">{i + 1}</span>
					<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
					<h3>{s.title}</h3>
					<p>{s.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-boxes-stacked"></i>Every item explained</h2>
		<div class="g-items">
			{#each guideItems as it, i}
				<article class="g-item" class:g-item--soon={!it.available} style="--ac: {it.accent}; --d: {(i % 6) * 60}ms">
					<div class="g-item-glow"></div>
					<div class="g-item-top">
						<span class="g-item-emoji">{it.emoji}</span>
						<div class="g-item-titles">
							<h3 class="g-item-name">{it.label}</h3>
							{#if it.available && it.cost != null}
								<span class="g-item-cost"><i class="fas fa-coins"></i>{fmtCost(it.cost)}</span>
							{:else}
								<span class="g-item-cost g-item-cost--soon">Not in this shop yet</span>
							{/if}
						</div>
					</div>
					{#if it.guide}
						<p class="g-item-what">{it.guide.what}</p>
						<div class="g-item-row"><i class="fas fa-circle-play"></i><span>{it.guide.how}</span></div>
						<div class="g-item-tip"><i class="fas fa-lightbulb"></i><span>{it.guide.tip}</span></div>
					{:else}
						<p class="g-item-what">{it.summary}</p>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-chess-knight"></i>Strategy &amp; combos</h2>
		<div class="g-tips">
			{#each tips as t, i}
				<div class="g-tip" style="--ac: {t.accent}; --d: {i * 60}ms">
					<span class="g-tip-ic"><i class="fas {t.icon}"></i></span>
					<p>{t.text}</p>
				</div>
			{/each}
		</div>
	</section>
</div>
