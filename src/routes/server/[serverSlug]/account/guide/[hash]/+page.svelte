<script lang="ts">
	import { getContext } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import {
		BASICS as basics,
		EARN_METHODS as earnMethods,
		FEATURES as features,
		FRIEND_BOOST as friendBoost,
		TIPS as tips,
		buildGuideItems
	} from '$lib/guide.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;

	const guideItems = $derived.by(() => buildGuideItems((data.items ?? []) as any[]));

	function fmtCost(n: number | null): string {
		if (n == null) return '';
		return (ctx?.fmt ? ctx.fmt(n) : Number(n).toLocaleString()) + ' XP';
	}

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

<svelte:head><title>{data.server.name || data.server.slug} Guide | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet cardGrid(cards: any[])}
	<div class="g-earn">
		{#each cards as c, i}
			<div class="g-earn-card" style="--ac: {c.accent}; --d: {i * 60}ms">
				<span class="g-earn-ic"><i class="fas {c.icon}"></i></span>
				<div class="g-earn-body">
					<h3>{c.title}</h3>
					<p>{c.desc}</p>
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet stepGrid(steps: any[])}
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
{/snippet}

{#snippet callout(n: any)}
	<div class="g-friend" style="--ac: {n.accent}">
		<span class="g-friend-ic"><i class="fas {n.icon}"></i></span>
		<div class="g-friend-body">
			<h3>{n.title}</h3>
			<p>{n.text}</p>
		</div>
	</div>
{/snippet}

<div class="g-wrap">
	<header class="g-hero" use:reveal>
		<div class="g-hero-badge"><i class="fas fa-book-open"></i></div>
		<h1 class="g-hero-title">How the XP Game Works</h1>
		<p class="g-hero-sub">Earn XP, clear tasks, shop for items, and outplay everyone.</p>
	</header>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-bolt"></i>How to earn XP</h2>
		<p class="g-sec-lead">XP is the currency for everything here, and your rank on the leaderboard.</p>
		{@render cardGrid(earnMethods)}
		{@render callout(friendBoost)}
	</section>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-circle-info"></i>Know the basics</h2>
		<p class="g-sec-lead">The words you will see around your account, and what each one means.</p>
		{@render cardGrid(basics)}
	</section>

	{#each features as f}
		<section class="g-sec" use:reveal>
			<h2 class="g-sec-head"><i class="fas {f.icon}"></i>{f.title}</h2>
			<p class="g-sec-lead">{f.lead}</p>
			{@render stepGrid(f.steps)}
			{#if f.cards.length}
				{@render cardGrid(f.cards)}
			{/if}
			{@render callout(f.note)}

			{#if f.id === 'items'}
				<h3 class="g-sub-head">Every item explained</h3>
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
			{/if}
		</section>
	{/each}

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
