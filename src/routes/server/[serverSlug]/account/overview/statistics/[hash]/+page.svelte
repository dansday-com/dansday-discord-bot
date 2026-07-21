<script lang="ts">
	import { getContext } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { effectLabel, effectIcon } from '$lib/items.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const d = $derived((data.dashboard ?? {}) as Record<string, number>);
	const ins = $derived(data.insights ?? { favorite_items: [], top_steal_targets: [], top_aggressors: [], top_giftees: [] });

	const hasEconomy = $derived((d.assets_trade_count ?? 0) > 0 || (d.items_buys ?? 0) > 0 || (d.minigames_plays ?? 0) > 0);
	const hasPvp = $derived(
		(d.items_steals_landed ?? 0) > 0 ||
			(d.items_steals_caught ?? 0) > 0 ||
			(d.items_bombed ?? 0) > 0 ||
			(d.items_gifted ?? 0) > 0 ||
			(d.items_spies ?? 0) > 0 ||
			(d.items_bounties_placed ?? 0) > 0 ||
			(d.items_stolen_from ?? 0) > 0 ||
			(d.items_bombed_by ?? 0) > 0 ||
			(d.items_gifts_received ?? 0) > 0 ||
			(d.bounty_on_me ?? 0) > 0
	);
	const hasEngagement = $derived(
		(d.giveaways_entered ?? 0) > 0 ||
			(d.giveaways_hosted ?? 0) > 0 ||
			(d.quests_enrolled ?? 0) > 0 ||
			(d.streams_total ?? 0) > 0 ||
			(d.feedback_submitted ?? 0) > 0
	);
	const hasInsights = $derived(
		ins.favorite_items.length > 0 || ins.top_steal_targets.length > 0 || ins.top_aggressors.length > 0 || ins.top_giftees.length > 0
	);

	const assetsPnl = $derived(Number(d.assets_pnl) || 0);
	const minigamesNet = $derived(Number(d.minigames_net) || 0);

	const empty = $derived(!hasEconomy && !hasPvp && !hasEngagement && !hasInsights);
</script>

<svelte:head><title>{data.server.name || data.server.slug} Statistics | {APP_NAME} Discord Bot</title></svelte:head>

<div class="m-ov">
	{#if empty}
		<div class="m-members-empty m-ov-full">No activity recorded yet. Buy an item, trade, or play to start your stats.</div>
	{/if}

	{#if hasInsights}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-3"><i class="fas fa-fire-flame-curved"></i></div>
				<h2 class="m-stat-card-title">Highlights</h2>
			</div>
			<div class="m-ov-lists">
				{#if ins.favorite_items.length > 0}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-star"></i> Favorite items</span>
						{#each ins.favorite_items as it, i}
							<div class="m-ov-list-row">
								<span class="m-ov-rank">{i + 1}</span>
								<i class="fas {it.effect_type ? effectIcon(it.effect_type) : 'fa-cube'}"></i>
								<span class="m-ov-list-name">{it.name}</span>
								<span class="m-ov-list-val">{fmt(it.uses)}×</span>
							</div>
						{/each}
					</div>
				{/if}
				{#if ins.top_steal_targets.length > 0}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-hand"></i> Steals from</span>
						{#each ins.top_steal_targets as t, i}
							<div class="m-ov-list-row">
								<span class="m-ov-rank">{i + 1}</span>
								<span class="m-ov-list-name">{t.name}</span>
								<span class="m-ov-list-val">{fmt(t.xp)} XP</span>
							</div>
						{/each}
					</div>
				{/if}
				{#if ins.top_aggressors.length > 0}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-skull-crossbones"></i> Robbed by</span>
						{#each ins.top_aggressors as t, i}
							<div class="m-ov-list-row">
								<span class="m-ov-rank">{i + 1}</span>
								<span class="m-ov-list-name">{t.name}</span>
								<span class="m-ov-list-val">{fmt(t.xp)} XP</span>
							</div>
						{/each}
					</div>
				{/if}
				{#if ins.top_giftees.length > 0}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-gift"></i> Gifts to</span>
						{#each ins.top_giftees as t, i}
							<div class="m-ov-list-row">
								<span class="m-ov-rank">{i + 1}</span>
								<span class="m-ov-list-name">{t.name}</span>
								<span class="m-ov-list-val">{fmt(t.xp)} XP</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if hasEconomy}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-2"><i class="fas fa-coins"></i></div>
				<h2 class="m-stat-card-title">Your economy</h2>
			</div>
			<div class="m-mini-grid">
				{#if d.assets_trade_count > 0 || d.assets_market_value > 0}
					<div class="m-mini">
						<i class="fas fa-chart-line"></i>
						<span class="m-mini-value">{fmt(d.assets_market_value)}</span>
						<span class="m-mini-label">Assets value</span>
					</div>
					<div class="m-mini" data-dir={assetsPnl >= 0 ? 'up' : 'down'}>
						<i class="fas fa-scale-balanced"></i>
						<span class="m-mini-value">{assetsPnl >= 0 ? '+' : '−'}{fmt(Math.abs(assetsPnl))}</span>
						<span class="m-mini-label">Open P/L</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-right-left"></i>
						<span class="m-mini-value">{fmt(d.assets_trade_count)}</span>
						<span class="m-mini-label">Trades</span>
					</div>
				{/if}
				{#if d.items_buys > 0}
					<div class="m-mini">
						<i class="fas fa-cart-shopping"></i>
						<span class="m-mini-value">{fmt(d.items_buys)}</span>
						<span class="m-mini-label">Items bought</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-coins"></i>
						<span class="m-mini-value">{fmt(d.items_buy_spend)}</span>
						<span class="m-mini-label">XP spent</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-wand-magic-sparkles"></i>
						<span class="m-mini-value">{fmt(d.items_activations)}</span>
						<span class="m-mini-label">Activations</span>
					</div>
				{/if}
				{#if d.minigames_plays > 0}
					<div class="m-mini">
						<i class="fas fa-dice"></i>
						<span class="m-mini-value">{fmt(d.minigames_wagered)}</span>
						<span class="m-mini-label">XP wagered</span>
					</div>
					<div class="m-mini" data-dir={minigamesNet >= 0 ? 'up' : 'down'}>
						<i class="fas fa-scale-balanced"></i>
						<span class="m-mini-value">{minigamesNet >= 0 ? '+' : '−'}{fmt(Math.abs(minigamesNet))}</span>
						<span class="m-mini-label">Net winnings</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-trophy"></i>
						<span class="m-mini-value">{fmt(d.minigames_biggest_win)}</span>
						<span class="m-mini-label">Biggest win</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if hasPvp}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-3"><i class="fas fa-crosshairs"></i></div>
				<h2 class="m-stat-card-title">Your PvP record</h2>
			</div>
			<div class="m-mini-grid">
				<div class="m-mini">
					<i class="fas fa-hand"></i>
					<span class="m-mini-value">{fmt(d.items_stolen)}</span>
					<span class="m-mini-label">XP stolen</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-shield-halved"></i>
					<span class="m-mini-value">{fmt(d.items_stolen_from)}</span>
					<span class="m-mini-label">Stolen from you</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-bomb"></i>
					<span class="m-mini-value">{fmt(d.items_bombed)}</span>
					<span class="m-mini-label">XP bombed</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-burst"></i>
					<span class="m-mini-value">{fmt(d.items_bombed_by)}</span>
					<span class="m-mini-label">Bombed you</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-gift"></i>
					<span class="m-mini-value">{fmt(d.items_gifted)}</span>
					<span class="m-mini-label">Gifted out</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-hand-holding-heart"></i>
					<span class="m-mini-value">{fmt(d.items_gifts_received)}</span>
					<span class="m-mini-label">Received</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-magnifying-glass"></i>
					<span class="m-mini-value">{fmt(d.items_spies)}</span>
					<span class="m-mini-label">Spy reports</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-crown"></i>
					<span class="m-mini-value">{fmt(d.items_bounties_placed)}</span>
					<span class="m-mini-label">Bounties set</span>
				</div>
				{#if d.bounty_on_me > 0}
					<div class="m-mini" data-dir="down">
						<i class="fas fa-skull"></i>
						<span class="m-mini-value">{fmt(d.bounty_on_me)}</span>
						<span class="m-mini-label">Bounty on you</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if hasEngagement}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-4"><i class="fas fa-fire"></i></div>
				<h2 class="m-stat-card-title">Your engagement</h2>
			</div>
			<div class="m-mini-grid">
				{#if d.giveaways_entered > 0 || d.giveaways_hosted > 0}
					<div class="m-mini">
						<i class="fas fa-ticket"></i>
						<span class="m-mini-value">{fmt(d.giveaways_entered)}</span>
						<span class="m-mini-label">Giveaways entered</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-medal"></i>
						<span class="m-mini-value">{fmt(d.giveaways_won)}</span>
						<span class="m-mini-label">Giveaways won</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-gift"></i>
						<span class="m-mini-value">{fmt(d.giveaways_hosted)}</span>
						<span class="m-mini-label">Hosted</span>
					</div>
				{/if}
				{#if d.quests_enrolled > 0}
					<div class="m-mini">
						<i class="fas fa-scroll"></i>
						<span class="m-mini-value">{fmt(d.quests_enrolled)}</span>
						<span class="m-mini-label">Quests</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-award"></i>
						<span class="m-mini-value">{fmt(d.quests_claimed)}</span>
						<span class="m-mini-label">Rewards claimed</span>
					</div>
				{/if}
				{#if d.streams_total > 0}
					<div class="m-mini">
						<i class="fas fa-tower-broadcast"></i>
						<span class="m-mini-value">{fmt(d.streams_total)}</span>
						<span class="m-mini-label">Streams</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-eye"></i>
						<span class="m-mini-value">{fmt(d.streams_peak_viewers)}</span>
						<span class="m-mini-label">Peak viewers</span>
					</div>
					<div class="m-mini">
						<i class="fas fa-heart"></i>
						<span class="m-mini-value">{fmt(d.streams_likes)}</span>
						<span class="m-mini-label">Likes</span>
					</div>
				{/if}
				{#if d.feedback_submitted > 0}
					<div class="m-mini">
						<i class="fas fa-comment-dots"></i>
						<span class="m-mini-value">{fmt(d.feedback_submitted)}</span>
						<span class="m-mini-label">Feedback given</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.m-ov {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.m-ov-full {
		grid-column: 1 / -1;
	}
	.m-ov :global(.m-mini[data-dir='up']) {
		border-color: rgba(31, 138, 76, 0.35);
	}
	.m-ov :global(.m-mini[data-dir='up'] .m-mini-value) {
		color: #1f8a4c;
	}
	.m-ov :global(.m-mini[data-dir='down']) {
		border-color: rgba(178, 59, 59, 0.35);
	}
	.m-ov :global(.m-mini[data-dir='down'] .m-mini-value) {
		color: #b23b3b;
	}
	.m-ov-lists {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 18px;
		margin-top: 14px;
	}
	.m-ov-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.m-ov-list-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--lb-text-muted);
	}
	.m-ov-list-title i {
		margin-right: 6px;
		color: var(--chili-hot);
	}
	.m-ov-list-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--lb-text);
	}
	.m-ov-rank {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 6px;
		font-size: 10px;
		font-weight: 800;
		background: rgba(36, 95, 115, 0.12);
		color: rgba(36, 95, 115, 0.9);
		flex-shrink: 0;
	}
	.m-ov-list-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.m-ov-list-val {
		font-variant-numeric: tabular-nums;
		color: var(--lb-text-muted);
		font-weight: 700;
	}
</style>
