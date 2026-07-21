<script lang="ts">
	import { getContext } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import { effectLabel, effectIcon, effectAccentHex } from '$lib/items.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const p = $derived(data.profile);

	function rolePillVars(color: string | null): string {
		if (!color) return '';
		return `--role-color: ${color};`;
	}

	const voiceMix = $derived.by(() => {
		const active = Math.max(0, p.voiceActive || 0);
		const afk = Math.max(0, p.voiceAfk || 0);
		const video = Math.max(0, p.voiceVideo || 0);
		const stream = Math.max(0, p.voiceStreaming || 0);
		const total = active + afk + video + stream;
		if (total <= 0) return null;
		return {
			total,
			active: (active / total) * 100,
			afk: (afk / total) * 100,
			video: (video / total) * 100,
			stream: (stream / total) * 100
		};
	});

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

	function barPct(v: number, list: { xp?: number; hits?: number; uses?: number; ticks?: number }[]): number {
		const max = Math.max(1, ...list.map((x) => Number(x.xp ?? x.hits ?? x.uses ?? x.ticks) || 0));
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

	const buddies = $derived((data.levelingFriends ?? []) as { name: string; avatar: string | null; ticks: number; xp: number }[]);
</script>

<svelte:head><title>{data.server.name || data.server.slug} Account | {APP_NAME} Discord Bot</title></svelte:head>

<div class="m-ov">
	<div class="m-stat-card m-overview-card m-ov-full">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-1"><i class="fas fa-id-card"></i></div>
			<h2 class="m-stat-card-title">Membership</h2>
		</div>
		<div class="m-mini-grid">
			<div class="m-mini">
				<i class="fas fa-calendar-check"></i>
				<span class="m-mini-value"><LocalTime value={p.joined} fallback="—" /></span>
				<span class="m-mini-label">Joined server</span>
			</div>
			<div class="m-mini">
				<i class="fab fa-discord"></i>
				<span class="m-mini-value"><LocalTime value={p.discordSince} fallback="—" /></span>
				<span class="m-mini-label">On Discord since</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-gem"></i>
				<span class="m-mini-value">{p.isBooster ? 'Yes' : 'No'}</span>
				<span class="m-mini-label">Server booster</span>
			</div>
			{#if p.isBooster && p.boosterSince}
				<div class="m-mini">
					<i class="fas fa-heart"></i>
					<span class="m-mini-value"><LocalTime value={p.boosterSince} fallback="—" /></span>
					<span class="m-mini-label">Boosting since</span>
				</div>
			{/if}
			<div class="m-mini">
				<i class="fas fa-ranking-star"></i>
				<span class="m-mini-value">{data.balance?.rank ? `#${fmt(data.balance.rank)}` : '—'}</span>
				<span class="m-mini-label">Server rank</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-moon"></i>
				<span class="m-mini-value">{p.isAfk ? 'AFK' : 'Active'}</span>
				<span class="m-mini-label">Status</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card m-ov-full">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-5"><i class="fas fa-microphone-alt"></i></div>
			<h2 class="m-stat-card-title">Activity</h2>
		</div>
		{#if voiceMix}
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Voice time breakdown</span>
					<span class="m-bar-meta">{fmt(voiceMix.total)} min</span>
				</div>
				<div class="m-seg-bar m-seg-bar--3" title="Active · AFK · Video · Stream">
					<div class="m-seg m-seg--text" style="width: {voiceMix.active}%"></div>
					<div class="m-seg m-seg--other" style="width: {voiceMix.afk}%"></div>
					<div class="m-seg m-seg--voice" style="width: {voiceMix.video}%"></div>
					<div class="m-seg m-seg--b" style="width: {voiceMix.stream}%"></div>
				</div>
				<div class="m-legend m-legend--3">
					<span><i class="fas fa-circle"></i> Active</span>
					<span><i class="fas fa-circle"></i> AFK</span>
					<span><i class="fas fa-circle"></i> Video</span>
				</div>
			</div>
		{/if}
		<div class="m-mini-grid">
			<div class="m-mini">
				<i class="fas fa-comments"></i>
				<span class="m-mini-value">{fmt(p.chatTotal)}</span>
				<span class="m-mini-label">Messages</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-check-circle"></i>
				<span class="m-mini-value">{fmt(p.voiceActive)}</span>
				<span class="m-mini-label">Voice min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-pause-circle"></i>
				<span class="m-mini-value">{fmt(p.voiceAfk)}</span>
				<span class="m-mini-label">AFK min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-video"></i>
				<span class="m-mini-value">{fmt(p.voiceVideo)}</span>
				<span class="m-mini-label">Video min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-desktop"></i>
				<span class="m-mini-value">{fmt(p.voiceStreaming)}</span>
				<span class="m-mini-label">Stream min</span>
			</div>
		</div>
	</div>

	{#if p.roles.length > 0}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-4"><i class="fas fa-user-tag"></i></div>
				<h2 class="m-stat-card-title">Roles</h2>
			</div>
			<div class="m-ov-roles">
				{#each p.roles as role}
					<span class="m-ov-role" style={rolePillVars(role.color)}>
						<i class="fas fa-circle"></i>{role.name || 'Role'}
					</span>
				{/each}
			</div>
		</div>
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

	{#if buddies.length > 0}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-5"><i class="fas fa-people-group"></i></div>
				<h2 class="m-stat-card-title">Voice buddies</h2>
			</div>
			<p class="m-buddy-cap">Members you level up with most in voice</p>
			<div class="m-buddy-list">
				{#each buddies as b, i}
					<div class="m-buddy">
						<span class="m-buddy-rank">{i + 1}</span>
						{#if b.avatar}
							<img class="m-buddy-av" src={b.avatar} alt="" loading="lazy" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
						{:else}
							<span class="m-buddy-av m-buddy-av--ph"><i class="fas fa-user"></i></span>
						{/if}
						<div class="m-buddy-body">
							<div class="m-buddy-head">
								<span class="m-ov-list-name">{b.name}</span>
								<span class="m-ov-list-val">{fmt(b.xp)} XP together</span>
							</div>
							<div class="m-ov-bar-track">
								<div
									class="m-ov-bar-fill m-ov-bar-fill--steal"
									style="width: {barPct(
										b.ticks,
										buddies.map((x) => ({ ticks: x.ticks }))
									)}%;"
								></div>
							</div>
						</div>
					</div>
				{/each}
			</div>
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
						{#each ins.favorite_items as it}
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
