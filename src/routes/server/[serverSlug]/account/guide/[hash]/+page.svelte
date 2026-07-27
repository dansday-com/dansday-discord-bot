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
		{ icon: 'fa-comments', accent: '#5a8a1f', title: 'Chat', desc: 'Messages in enabled channels earn XP.' },
		{ icon: 'fa-microphone', accent: '#1d6f8a', title: 'Voice', desc: 'Active minutes in voice earn XP, AFK minutes earn less.' },
		{ icon: 'fa-video', accent: '#7b5ea7', title: 'Video', desc: 'Camera on in voice pays bonus XP per minute.' },
		{ icon: 'fa-tower-broadcast', accent: '#c8911a', title: 'Streaming', desc: 'Going live or screen-sharing pays extra per minute.' }
	];

	const friendBoost = {
		icon: 'fa-handshake',
		accent: '#2f8f4e',
		title: '🤝 Friend Boost',
		text: 'Every other member sharing your voice channel adds +10% voice XP, and it stacks — five friends is +50%.'
	};

	const basics = [
		{
			icon: 'fa-wallet',
			accent: '#245f73',
			title: 'Wallet XP',
			desc: 'Your XP is both level progress and shop currency, so spending or losing it drops your rank.'
		},
		{
			icon: 'fa-wand-magic-sparkles',
			accent: '#7b5ea7',
			title: 'Effect status',
			desc: 'Active buffs and debuffs sit as chips at the top with the time each has left.'
		},
		{
			icon: 'fa-stopwatch',
			accent: '#d35400',
			title: 'Cooldown',
			desc: 'Steal, bomb and insurance lock for a while after use. A Purifier never clears cooldowns.'
		},
		{
			icon: 'fa-shield-halved',
			accent: '#1f9e8f',
			title: 'Immunity',
			desc: 'Right after you are robbed or bombed, attacks bounce off until the window runs out.'
		},
		{ icon: 'fa-crosshairs', accent: '#a8327d', title: 'Bounty', desc: 'A bounty puts XP on a member’s head for whoever robs or bombs them next.' },
		{
			icon: 'fa-clock-rotate-left',
			accent: '#4b6584',
			title: 'History',
			desc: 'Every buy, use, attack, trade and reward is logged. Disguised attackers stay anonymous.'
		}
	];

	const features = [
		{
			id: 'items',
			icon: 'fa-cart-shopping',
			title: 'Items & the shop',
			lead: 'Spend XP on buffs, protection and attacks. Your bag holds 50 items.',
			steps: [
				{ icon: 'fa-store', title: 'Open Items', desc: 'Browse by category. Each card shows its cost and effect.' },
				{ icon: 'fa-coins', title: 'Buy with XP', desc: 'Copies stack on one card, and every price drops while Luck runs.' },
				{ icon: 'fa-bolt', title: 'Use it', desc: 'Hit Use on an owned card. Buffs apply instantly, Remove drops one.' },
				{ icon: 'fa-crosshairs', title: 'Pick a target', desc: 'Steal, bomb, leech, spy, gift and bounty ask who to hit.' }
			],
			note: {
				icon: 'fa-triangle-exclamation',
				accent: '#b23b2e',
				title: '⚠️ XP you spend is gone',
				text: 'Buying takes XP straight out of your Wallet, so it can cost you levels and leaderboard places. Buy what you will actually use.'
			}
		},
		{
			id: 'tasks',
			icon: 'fa-list-check',
			title: 'Tasks & streaks',
			lead: 'Nine daily goals plus nine harder weekly ones, generated from what you already do here.',
			steps: [
				{ icon: 'fa-calendar-check', title: 'Check in', desc: 'Claim one day of the 7-day cycle. Day 7 is the jackpot.' },
				{ icon: 'fa-bolt', title: 'Just play', desc: 'Chat, voice, gamble, trade or attack — progress tracks itself.' },
				{ icon: 'fa-gift', title: 'Claim rewards', desc: 'Finished tasks pay XP or a shop item, and items need bag space.' },
				{ icon: 'fa-fire', title: 'Keep the streak', desc: 'Clear all nine dailies for +2% task XP per streak day, up to +100%.' }
			],
			note: {
				icon: 'fa-snowflake',
				accent: '#1d6f8a',
				title: '❄️ Built to be reachable',
				text: 'Goals are sized to your own last seven days, never your level. Miss a day and one of your two freezes covers the streak, but the check-in cycle restarts at day 1.'
			}
		},
		{
			id: 'minigames',
			icon: 'fa-dice',
			title: 'Minigames',
			lead: 'Free-to-play games where you wager XP for a shot at more. New games get added over time.',
			steps: [
				{ icon: 'fa-dice', title: 'Open Minigames', desc: 'Pick a game from the Minigames tab. No item or ticket needed.' },
				{ icon: 'fa-percent', title: 'Set your odds', desc: 'In Gamble you pick the multiplier up to 10×; win chance is 100 ÷ it.' },
				{ icon: 'fa-coins', title: 'Wager XP', desc: 'Only XP earned above your level is at risk, so a loss never de-levels you.' },
				{ icon: 'fa-bolt', title: 'Play & win', desc: 'Results post to the channel and feed the Minigames leaderboard.' }
			],
			note: {
				icon: 'fa-triangle-exclamation',
				accent: '#b23b2e',
				title: '⚠️ The house edge shows up over time',
				text: 'Odds are fair on each play, but chasing losses drains XP fast. Only wager what you can afford to drop on the leaderboard.'
			}
		},
		{
			id: 'assets',
			icon: 'fa-chart-line',
			title: 'Assets market',
			lead: 'Invest XP in real crypto at live prices — no real money and no real coins.',
			steps: [
				{ icon: 'fa-magnifying-glass', title: 'Open Assets', desc: 'Browse the Top 50, Gainers, Losers, or search any coin.' },
				{ icon: 'fa-arrow-trend-up', title: 'Invest XP', desc: 'Buy from 10,000 XP up. Buying again averages into one holding.' },
				{ icon: 'fa-wallet', title: 'Watch it move', desc: 'Invested XP leaves your Wallet and your level until you sell.' },
				{ icon: 'fa-hand-holding-dollar', title: 'Sell anytime', desc: 'No cooldown. XP comes back scaled by how the price moved.' }
			],
			note: {
				icon: 'fa-triangle-exclamation',
				accent: '#b23b2e',
				title: '⚠️ Safe from players, not from the market',
				text: 'Nobody can steal, bomb or leech XP parked in an asset, but prices are real. Sell after a drop and you get back less than you invested.'
			}
		}
	];

	const tips = [
		{ icon: 'fa-fire', accent: '#d35400', text: 'Check in and clear your dailies first — a longer streak makes every later reward bigger.' },
		{ icon: 'fa-list-check', accent: '#1a7f57', text: 'Tasks that ask you to buy or use items always pay back more XP than they cost.' },
		{ icon: 'fa-calendar-week', accent: '#7b5ea7', text: 'Aim your week at the weekly tasks; the same activity clears your dailies on the way.' },
		{ icon: 'fa-clover', accent: effectAccentHex('luck'), text: 'Activate Luck first. Timed buffs lock in whatever luck you had when you used them.' },
		{ icon: 'fa-magnifying-glass', accent: effectAccentHex('spy'), text: 'Spy before you attack so you never waste an item on a shielded target.' },
		{ icon: 'fa-shield', accent: effectAccentHex('shield'), text: 'Raise a Shield before you log off so nobody farms you while away.' },
		{ icon: 'fa-handshake', accent: '#2f8f4e', text: 'Grind voice with friends — every member in the channel adds +10% voice XP.' },
		{ icon: 'fa-chart-line', accent: '#245f73', text: 'Park XP in an asset to hide it from attacks, and only risk what you can lose.' }
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
