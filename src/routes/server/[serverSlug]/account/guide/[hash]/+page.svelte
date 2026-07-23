<script lang="ts">
	import { getContext } from 'svelte';
	import { ITEM_EFFECTS, effectAccentHex, effectGuide, effectSummary } from '$lib/items.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;

	const itemByEffect = $derived.by(() => {
		const map = new Map<string, any>();
		for (const it of (data.items ?? []) as any[]) {
			if (!map.has(it.effect_type)) map.set(it.effect_type, it);
		}
		return map;
	});

	const guideItems = $derived.by(() =>
		ITEM_EFFECTS.map((e) => {
			const live = itemByEffect.get(e.id);
			return {
				id: e.id,
				label: e.label,
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
		{ icon: 'fa-microphone', accent: '#1d6f8a', title: 'Voice', desc: 'Hang out in voice channels. XP ticks up the longer you stay active.' },
		{ icon: 'fa-video', accent: '#7b5ea7', title: 'Video', desc: 'Turn your camera on in voice for bonus XP per minute.' },
		{ icon: 'fa-tower-broadcast', accent: '#c8911a', title: 'Streaming', desc: 'Go live / screen-share in voice for extra XP per minute.' }
	];

	const concepts = [
		{
			icon: 'fa-wallet',
			accent: '#245f73',
			title: 'Wallet XP',
			desc: 'Your Wallet is your total XP. It’s both your level progress AND the currency you spend in the shop. Buying or losing XP can drop your level and leaderboard rank, so spend wisely.'
		},
		{
			icon: 'fa-wand-magic-sparkles',
			accent: '#7b5ea7',
			title: 'Effect Status',
			desc: 'Active buffs and debuffs (Shield, Boost, Leech, Disguise, a Bounty on you…) show as chips at the top with their time left. Watch them to know when you’re protected or exposed.'
		},
		{
			icon: 'fa-stopwatch',
			accent: '#d35400',
			title: 'Cooldown',
			desc: 'After you steal, bomb or use insurance, that action goes on cooldown and you must wait before using it again. Cooldowns show as status chips counting down. A Purifier does NOT reset them.'
		},
		{
			icon: 'fa-shield-halved',
			accent: '#1f9e8f',
			title: 'Immunity',
			desc: 'Right after someone robs or bombs you, you get a short Immunity window where attacks bounce off. It ticks down like a cooldown and protects you until it ends.'
		},
		{
			icon: 'fa-clock-rotate-left',
			accent: '#4b6584',
			title: 'History',
			desc: 'The History tab logs everything you bought, used, earned, every attack for and against you, and every asset trade. Anonymous attackers (Disguise) stay hidden there forever.'
		},
		{
			icon: 'fa-crosshairs',
			accent: '#a8327d',
			title: 'Bounty',
			desc: 'Placing a Bounty puts a reward on someone’s head. Whoever lands the next successful steal or bomb on that target claims the XP automatically.'
		}
	];

	const minigameSteps = [
		{ icon: 'fa-dice', title: 'Open Minigames', desc: 'Tap the Minigames tab and pick a game. Everything is free to play — no item or ticket needed.' },
		{
			icon: 'fa-coins',
			title: 'Wager XP',
			desc: 'Choose how much XP to risk. You can only wager XP earned above your current level, so a loss never drops your level or rank.'
		},
		{
			icon: 'fa-bolt',
			title: 'Play & win',
			desc: 'Win to grow your XP, lose and it’s gone. Every play is logged and counts toward the Minigames leaderboard.'
		}
	];

	const assetSteps = [
		{ icon: 'fa-chart-line', title: 'Open Assets', desc: 'Tap the Assets tab. Browse the Top 50, Gainers, Losers, or Search any coin.' },
		{ icon: 'fa-arrow-trend-up', title: 'Invest XP', desc: 'Pick a coin, choose how much XP to invest (minimum 10,000 XP), and buy at the live market price.' },
		{
			icon: 'fa-wallet',
			title: 'Watch it move',
			desc: 'Your asset tracks the real price. My Assets shows live profit or loss in XP. Buying the same coin again averages into one holding.'
		},
		{ icon: 'fa-hand-holding-dollar', title: 'Sell anytime', desc: 'Sell to cash out. You get XP back scaled by how the price moved since you bought.' }
	];

	const assetConcepts = [
		{
			icon: 'fa-coins',
			accent: '#245f73',
			title: 'XP becomes the investment',
			desc: 'When you buy an asset, that XP leaves your Wallet and locks into the asset. It no longer counts toward your level or leaderboard rank until you sell.'
		},
		{
			icon: 'fa-shield-halved',
			accent: '#1f9e8f',
			title: 'Safe from attacks',
			desc: 'XP held in assets can’t be stolen, bombed, or leeched. Parking XP in the market is one way to protect it, at the cost of price risk.'
		},
		{
			icon: 'fa-arrow-trend-up',
			accent: '#1a7f57',
			title: 'Real market prices',
			desc: 'Prices are live crypto prices in IDR from the real market. Sell higher than you bought and you gain XP; sell lower and you lose some. No cooldown, sell whenever.'
		},
		{
			icon: 'fa-clock-rotate-left',
			accent: '#4b6584',
			title: 'Tracked in History',
			desc: 'Every buy and sell is logged in the History tab so you can review what you invested, when, and how each trade turned out.'
		}
	];

	const steps = [
		{ icon: 'fa-store', title: 'Open Items', desc: 'Browse items by category. Each card shows its cost and what it does.' },
		{ icon: 'fa-coins', title: 'Buy with XP', desc: 'Spend your earned XP. Owned items stack on the same card (you can hold up to 50).' },
		{ icon: 'fa-bolt', title: 'Use it', desc: 'On an owned item, hit Use right on the card. Buffs apply to you instantly; Remove drops one.' },
		{ icon: 'fa-crosshairs', title: 'Pick a target', desc: 'Offensive items (steal, bomb, leech, spy, gift, bounty) ask who to use it on.' }
	];

	const tips = [
		{ icon: 'fa-magnifying-glass', accent: effectAccentHex('spy'), text: 'Spy before you attack so you never waste an item on a shielded target.' },
		{ icon: 'fa-triangle-exclamation', accent: effectAccentHex('spy'), text: 'A risky Spy can backfire. Fail and the target is alerted with your name.' },
		{ icon: 'fa-mask', accent: effectAccentHex('disguise'), text: 'Disguise hides your name, but a lucky Spy can still unmask you.' },
		{ icon: 'fa-shield', accent: effectAccentHex('shield'), text: 'Raise a Shield before you log off so nobody farms you while away.' },
		{ icon: 'fa-soap', accent: effectAccentHex('purifier'), text: 'Stuck with a leech draining you? A Purifier wipes it instantly.' },
		{ icon: 'fa-handshake', accent: '#2f8f4e', text: 'Grind voice with friends. Friend Boost stacks +10% each.' },
		{ icon: 'fa-arrows-rotate', accent: effectAccentHex('reflect'), text: 'Expecting a hit? Reflect turns their attack back on them.' },
		{
			icon: 'fa-clover',
			accent: effectAccentHex('luck'),
			text: 'Luck boosts everything at once: minigame odds, spy chance, leech skim, insurance refund, gift tax and shop prices. Pop it before a big session.'
		},
		{ icon: 'fa-crosshairs', accent: effectAccentHex('bounty'), text: 'Placed a Bounty? Land the kill yourself before someone else cashes in on your target.' },
		{
			icon: 'fa-shield-halved',
			accent: effectAccentHex('insurance'),
			text: 'Insurance only pays out on your next loss, so activate it right before you expect to get hit, not after.'
		}
	];

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

<svelte:head><title>{data.server.name || data.server.slug} Items Guide | {APP_NAME} Discord Bot</title></svelte:head>

<div class="g-wrap">
	<header class="g-hero" use:reveal>
		<div class="g-hero-badge"><i class="fas fa-book-open"></i></div>
		<h1 class="g-hero-title">How the Item Game Works</h1>
		<p class="g-hero-sub">Earn XP, spend it in the shop, and outplay everyone with steals, shields, spies and more.</p>
	</header>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-bolt"></i>How to earn XP</h2>
		<p class="g-sec-lead">XP is the currency. The more you earn, the more you can buy, and the higher you climb the leaderboard.</p>
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
					<strong>+10% boost for every friend</strong> in there with you. Five friends? That's <strong>+50% XP</strong>, it stacks.
				</p>
			</div>
		</div>
	</section>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-circle-info"></i>Know the basics</h2>
		<p class="g-sec-lead">A few things you’ll see around the items page and what they mean.</p>
		<div class="g-earn">
			{#each concepts as c, i}
				<div class="g-earn-card" style="--ac: {c.accent}; --d: {i * 60}ms">
					<span class="g-earn-ic"><i class="fas {c.icon}"></i></span>
					<div class="g-earn-body">
						<h3>{c.title}</h3>
						<p>{c.desc}</p>
					</div>
				</div>
			{/each}
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
		<h2 class="g-sec-head"><i class="fas fa-dice"></i>Minigames</h2>
		<p class="g-sec-lead">Free-to-play games in the Minigames tab where you wager XP for a shot at more. More games are added over time.</p>
		<div class="g-steps">
			{#each minigameSteps as s, i}
				<div class="g-step" style="--d: {i * 80}ms">
					<span class="g-step-num">{i + 1}</span>
					<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
					<h3>{s.title}</h3>
					<p>{s.desc}</p>
				</div>
			{/each}
		</div>

		<div class="g-friend" style="--ac: #b23b2e">
			<span class="g-friend-ic"><i class="fas fa-triangle-exclamation"></i></span>
			<div class="g-friend-body">
				<h3>⚠️ The house always has an edge over time</h3>
				<p>
					Odds are fair per play, but chasing losses drains XP fast. Only wager XP you’re willing to drop on the leaderboard — losses come straight out of your
					balance.
				</p>
			</div>
		</div>
	</section>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-chart-line"></i>Assets market</h2>
		<p class="g-sec-lead">
			Invest your XP in real-world crypto at live prices. It behaves like a stock market, but you’re trading with XP, no real money and no real coins.
		</p>
		<div class="g-earn">
			{#each assetConcepts as c, i}
				<div class="g-earn-card" style="--ac: {c.accent}; --d: {i * 60}ms">
					<span class="g-earn-ic"><i class="fas {c.icon}"></i></span>
					<div class="g-earn-body">
						<h3>{c.title}</h3>
						<p>{c.desc}</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="g-friend" style="--ac: #b23b2e">
			<span class="g-friend-ic"><i class="fas fa-triangle-exclamation"></i></span>
			<div class="g-friend-body">
				<h3>⚠️ Prices go down too</h3>
				<p>
					The market is real and volatile. If a coin drops after you buy, selling returns <strong>less XP than you invested</strong>. Only invest XP you’re
					willing to risk on the leaderboard.
				</p>
			</div>
		</div>
	</section>

	<section class="g-sec" use:reveal>
		<h2 class="g-sec-head"><i class="fas fa-arrow-trend-up"></i>How to trade assets</h2>
		<div class="g-steps">
			{#each assetSteps as s, i}
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
