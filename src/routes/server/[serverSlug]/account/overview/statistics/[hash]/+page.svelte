<script lang="ts">
	import { getContext } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { effectLabel, effectIcon, effectAccentHex } from '$lib/items.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const d = $derived((data.dashboard ?? {}) as Record<string, number>);
	const ins = $derived(data.insights ?? { favorite_items: [], top_steal_targets: [], top_aggressors: [], top_giftees: [], effect_usage: [] });

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

	const PALETTE = ['#245f73', '#733e24', '#c8911a', '#1f8a4c', '#b23b3b', '#6d5bd0', '#e07a5f', '#2a9d8f', '#9b2c6f', '#457b9d'];

	const usageTotal = $derived((ins.effect_usage ?? []).reduce((sum: number, e: any) => sum + (Number(e.uses) || 0), 0));
	const usageSegments = $derived.by(() => {
		const rows = (ins.effect_usage ?? []) as { effect_type: string; uses: number }[];
		if (usageTotal <= 0) return [];
		let offset = 0;
		return rows.map((r, i) => {
			const pct = (r.uses / usageTotal) * 100;
			const accent = effectAccentHex(r.effect_type);
			const color = accent === '#245f73' && i > 0 ? PALETTE[i % PALETTE.length] : accent;
			const seg = {
				...r,
				pct,
				start: offset,
				end: offset + pct,
				color,
				label: effectLabel(r.effect_type),
				icon: effectIcon(r.effect_type)
			};
			offset += pct;
			return seg;
		});
	});

	function polar(cx: number, cy: number, r: number, pctPoint: number) {
		const a = (pctPoint / 100) * 2 * Math.PI - Math.PI / 2;
		return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
	}
	const pieSlices = $derived(
		usageSegments.map((s) => {
			const large = s.pct > 50 ? 1 : 0;
			const p1 = polar(50, 50, 48, s.start);
			const p2 = polar(50, 50, 48, s.end);
			if (usageSegments.length === 1) return { ...s, d: '' };
			return { ...s, d: `M50,50 L${p1.x.toFixed(2)},${p1.y.toFixed(2)} A48,48 0 ${large} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)} Z` };
		})
	);

	function barPct(v: number, list: { xp?: number; hits?: number; uses?: number }[]): number {
		const max = Math.max(1, ...list.map((x) => Number(x.xp ?? x.hits ?? x.uses) || 0));
		return Math.max(4, Math.round((v / max) * 100));
	}

	const stealNet = $derived((Number(d.items_stolen) || 0) - (Number(d.items_stolen_from) || 0));

	const flow = $derived((ins.xp_flow ?? []) as { day: string; net: number }[]);
	const flowChart = $derived.by(() => {
		if (flow.length < 2) return null;
		const W = 300;
		const H = 90;
		let cum = 0;
		const pts = flow.map((f) => {
			cum += f.net;
			return cum;
		});
		const min = Math.min(0, ...pts);
		const max = Math.max(0, ...pts);
		const span = max - min || 1;
		const stepX = W / (pts.length - 1);
		const coords = pts.map((v, i) => ({ x: i * stepX, y: H - ((v - min) / span) * H }));
		const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
		const area = `${line} L${W},${H} L0,${H} Z`;
		const zeroY = H - ((0 - min) / span) * H;
		return { W, H, line, area, zeroY, last: pts[pts.length - 1], up: pts[pts.length - 1] >= 0, coords };
	});

	const empty = $derived(!hasEconomy && !hasPvp && !hasEngagement && !hasInsights);
</script>

<svelte:head><title>{data.server.name || data.server.slug} Statistics | {APP_NAME} Discord Bot</title></svelte:head>

<div class="m-ov">
	{#if empty}
		<div class="m-members-empty m-ov-full">No activity recorded yet. Buy an item, trade, or play to start your stats.</div>
	{/if}

	{#if usageSegments.length > 0}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-3"><i class="fas fa-chart-pie"></i></div>
				<h2 class="m-stat-card-title">How you play</h2>
			</div>
			<div class="m-chart-split">
				<div class="m-pie-wrap">
					<svg class="m-pie" viewBox="0 0 100 100" role="img" aria-label="Item usage by type">
						{#if usageSegments.length === 1}
							<circle cx="50" cy="50" r="48" fill={usageSegments[0].color} />
						{:else}
							{#each pieSlices as slice}
								<path d={slice.d} fill={slice.color} stroke="rgba(255,255,255,0.85)" stroke-width="0.8" />
							{/each}
						{/if}
						<circle cx="50" cy="50" r="26" fill="#fff" />
						<text x="50" y="47" text-anchor="middle" class="m-pie-total">{fmt(usageTotal)}</text>
						<text x="50" y="58" text-anchor="middle" class="m-pie-cap">uses</text>
					</svg>
					<div class="m-donut-legend">
						{#each usageSegments as seg}
							<div class="m-donut-leg">
								<span class="m-donut-dot" style="background: {seg.color};"></span>
								<i class="fas {seg.icon}" style="color: {seg.color};"></i>
								<span class="m-donut-leg-name">{seg.label}</span>
								<span class="m-donut-leg-val">{fmt(seg.uses)}× · {seg.pct.toFixed(0)}%</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="m-colchart">
					{#each usageSegments as seg}
						<div class="m-col">
							<span class="m-col-val">{fmt(seg.uses)}</span>
							<div class="m-col-track">
								<div class="m-col-fill" style="height: {Math.max(6, seg.pct)}%; background: {seg.color};"></div>
							</div>
							<i class="fas {seg.icon} m-col-ico" style="color: {seg.color};" title={seg.label}></i>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if flowChart}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-2"><i class="fas fa-chart-line"></i></div>
				<h2 class="m-stat-card-title">XP flow · last 14 days</h2>
			</div>
			<div class="m-line-meta">
				<span class="m-line-cap">Cumulative net XP</span>
				<span class="m-line-val" data-dir={flowChart.up ? 'up' : 'down'}>
					<i class="fas fa-arrow-trend-{flowChart.up ? 'up' : 'down'}"></i>{flowChart.up ? '+' : '−'}{fmt(Math.abs(flowChart.last))}
				</span>
			</div>
			<svg class="m-line" viewBox="0 0 {flowChart.W} {flowChart.H}" preserveAspectRatio="none" role="img" aria-label="XP flow over time">
				<defs>
					<linearGradient id="flowgrad" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color={flowChart.up ? 'rgba(31,138,76,0.35)' : 'rgba(178,59,59,0.35)'} />
						<stop offset="100%" stop-color="rgba(255,255,255,0)" />
					</linearGradient>
				</defs>
				<line x1="0" y1={flowChart.zeroY} x2={flowChart.W} y2={flowChart.zeroY} class="m-line-zero" />
				<path d={flowChart.area} fill="url(#flowgrad)" />
				<path
					d={flowChart.line}
					fill="none"
					stroke={flowChart.up ? '#1f8a4c' : '#b23b3b'}
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
					vector-effect="non-scaling-stroke"
				/>
			</svg>
		</div>
	{/if}

	{#if hasInsights}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-1"><i class="fas fa-fire-flame-curved"></i></div>
				<h2 class="m-stat-card-title">Highlights</h2>
			</div>
			<div class="m-ov-lists">
				{#if ins.favorite_items.length > 0}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-star"></i> Favorite items</span>
						{#each ins.favorite_items as it, i}
							<div class="m-ov-bar-row">
								<div class="m-ov-bar-head">
									<i
										class="fas {it.effect_type ? effectIcon(it.effect_type) : 'fa-cube'}"
										style="color: {it.effect_type ? effectAccentHex(it.effect_type) : 'var(--chili-hot)'};"
									></i>
									<span class="m-ov-list-name">{it.name}</span>
									<span class="m-ov-list-val">{fmt(it.uses)}×</span>
								</div>
								<div class="m-ov-bar-track">
									<div
										class="m-ov-bar-fill"
										style="width: {barPct(it.uses, ins.favorite_items)}%; background: {it.effect_type ? effectAccentHex(it.effect_type) : 'var(--chili-hot)'};"
									></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
				{#if ins.top_steal_targets.length > 0}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-hand"></i> Steals from</span>
						{#each ins.top_steal_targets as t}
							<div class="m-ov-bar-row">
								<div class="m-ov-bar-head">
									<span class="m-ov-list-name">{t.name}</span>
									<span class="m-ov-list-val">{fmt(t.xp)} XP</span>
								</div>
								<div class="m-ov-bar-track">
									<div class="m-ov-bar-fill m-ov-bar-fill--steal" style="width: {barPct(t.xp, ins.top_steal_targets)}%;"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
				{#if ins.top_aggressors.length > 0}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-skull-crossbones"></i> Robbed by</span>
						{#each ins.top_aggressors as t}
							<div class="m-ov-bar-row">
								<div class="m-ov-bar-head">
									<span class="m-ov-list-name">{t.name}</span>
									<span class="m-ov-list-val">{fmt(t.xp)} XP</span>
								</div>
								<div class="m-ov-bar-track">
									<div class="m-ov-bar-fill m-ov-bar-fill--danger" style="width: {barPct(t.xp, ins.top_aggressors)}%;"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
				{#if ins.top_giftees.length > 0}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-gift"></i> Gifts to</span>
						{#each ins.top_giftees as t}
							<div class="m-ov-bar-row">
								<div class="m-ov-bar-head">
									<span class="m-ov-list-name">{t.name}</span>
									<span class="m-ov-list-val">{fmt(t.xp)} XP</span>
								</div>
								<div class="m-ov-bar-track">
									<div class="m-ov-bar-fill m-ov-bar-fill--gift" style="width: {barPct(t.xp, ins.top_giftees)}%;"></div>
								</div>
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
			{#if d.items_stolen > 0 || d.items_stolen_from > 0}
				<div class="m-duel">
					<div class="m-duel-head">
						<span class="m-duel-l">You stole {fmt(d.items_stolen)}</span>
						<span class="m-duel-net" data-dir={stealNet >= 0 ? 'up' : 'down'}>{stealNet >= 0 ? 'net +' : 'net −'}{fmt(Math.abs(stealNet))}</span>
						<span class="m-duel-r">{fmt(d.items_stolen_from)} lost</span>
					</div>
					<div class="m-duel-bar">
						<div class="m-duel-fill m-duel-fill--win" style="width: {barPct(d.items_stolen, [{ xp: d.items_stolen }, { xp: d.items_stolen_from }])}%;"></div>
						<div
							class="m-duel-fill m-duel-fill--lose"
							style="width: {barPct(d.items_stolen_from, [{ xp: d.items_stolen }, { xp: d.items_stolen_from }])}%;"
						></div>
					</div>
				</div>
			{/if}
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
		grid-template-columns: 1fr;
		gap: 16px;
		align-items: start;
	}
	@media (min-width: 640px) {
		.m-ov {
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		}
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

	.m-ov-bar-row {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.m-ov-bar-head {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--lb-text);
	}
	.m-ov-bar-head i {
		font-size: 12px;
	}
	.m-ov-bar-track {
		height: 8px;
		border-radius: 99px;
		background: rgba(187, 189, 188, 0.28);
		overflow: hidden;
	}
	.m-ov-bar-fill {
		height: 100%;
		border-radius: 99px;
		transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.m-ov-bar-fill--steal {
		background: linear-gradient(90deg, var(--chili-brick), var(--chili-hot));
	}
	.m-ov-bar-fill--danger {
		background: linear-gradient(90deg, #b23b3b, #e07a5f);
	}
	.m-ov-bar-fill--gift {
		background: linear-gradient(90deg, #1f8a4c, #6bbf8a);
	}

	.m-chart-split {
		display: grid;
		grid-template-columns: 1fr;
		gap: 20px;
		margin-top: 14px;
	}
	@media (min-width: 560px) {
		.m-chart-split {
			grid-template-columns: 1.2fr 1fr;
			align-items: center;
		}
	}
	.m-pie-wrap {
		display: flex;
		align-items: center;
		gap: 18px;
		flex-wrap: wrap;
	}
	.m-pie {
		width: 130px;
		height: 130px;
		max-width: 40vw;
		flex-shrink: 0;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08));
	}
	.m-pie-total {
		font-size: 15px;
		font-weight: 800;
		fill: var(--lb-text);
	}
	.m-pie-cap {
		font-size: 6px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		fill: var(--lb-text-muted);
	}
	.m-colchart {
		display: flex;
		align-items: flex-end;
		justify-content: space-around;
		gap: 6px;
		height: 150px;
		padding-top: 8px;
	}
	.m-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		height: 100%;
	}
	.m-col-val {
		font-size: 11px;
		font-weight: 700;
		color: var(--lb-text);
		font-variant-numeric: tabular-nums;
	}
	.m-col-track {
		flex: 1;
		width: 60%;
		max-width: 26px;
		display: flex;
		align-items: flex-end;
		background: rgba(187, 189, 188, 0.22);
		border-radius: 6px 6px 0 0;
		overflow: hidden;
	}
	.m-col-fill {
		width: 100%;
		border-radius: 6px 6px 0 0;
		transition: height 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.m-col-ico {
		font-size: 13px;
	}
	.m-line-meta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		margin: 14px 0 8px;
	}
	.m-line-cap {
		font-size: 12px;
		font-weight: 600;
		color: var(--lb-text-muted);
	}
	.m-line-val {
		font-size: 15px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.m-line-val[data-dir='up'] {
		color: #1f8a4c;
	}
	.m-line-val[data-dir='down'] {
		color: #b23b3b;
	}
	.m-line {
		width: 100%;
		height: 90px;
		display: block;
	}
	.m-line-zero {
		stroke: var(--lb-border-light);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.m-donut-legend {
		flex: 1;
		min-width: 150px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.m-donut-leg {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--lb-text);
	}
	.m-donut-dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex-shrink: 0;
	}
	.m-donut-leg i {
		font-size: 12px;
		width: 16px;
		text-align: center;
	}
	.m-donut-leg-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.m-donut-leg-val {
		font-variant-numeric: tabular-nums;
		color: var(--lb-text-muted);
		font-weight: 700;
		font-size: 12px;
	}

	.m-duel {
		margin-top: 14px;
	}
	.m-duel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 6px;
		font-size: 12px;
		font-weight: 700;
	}
	.m-duel-l {
		color: rgba(36, 95, 115, 0.9);
	}
	.m-duel-r {
		color: #b23b3b;
	}
	.m-duel-net {
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 99px;
		background: rgba(36, 95, 115, 0.1);
		color: var(--lb-text-muted);
	}
	.m-duel-net[data-dir='up'] {
		background: rgba(31, 138, 76, 0.14);
		color: #1f8a4c;
	}
	.m-duel-net[data-dir='down'] {
		background: rgba(178, 59, 59, 0.14);
		color: #b23b3b;
	}
	.m-duel-bar {
		display: flex;
		height: 10px;
		border-radius: 99px;
		overflow: hidden;
		gap: 2px;
	}
	.m-duel-fill {
		height: 100%;
		border-radius: 99px;
		transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.m-duel-fill--win {
		background: linear-gradient(90deg, var(--chili-brick), var(--chili-hot));
	}
	.m-duel-fill--lose {
		background: linear-gradient(90deg, #e07a5f, #b23b3b);
	}
</style>
