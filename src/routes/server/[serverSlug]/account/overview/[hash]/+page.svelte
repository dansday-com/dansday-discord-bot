<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import { effectLabel, effectIcon, effectAccentHex } from '$lib/items.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	function fmtShort(v: number): string {
		const n = Math.abs(Number(v) || 0);
		if (n >= 1e9) return (v / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
		if (n >= 1e6) return (v / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
		if (n >= 1e3) return (v / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K';
		return String(Math.round(v));
	}

	let mounted = $state(false);
	let reduceMotion = false;
	onMount(() => {
		reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		if (reduceMotion) {
			mounted = true;
			return;
		}
		requestAnimationFrame(() => requestAnimationFrame(() => (mounted = true)));
	});
	const grow = $derived(mounted ? 1 : 0);

	function countUp(node: HTMLElement, target: number) {
		const render = (v: number) => (node.textContent = Math.round(v).toLocaleString());
		if (reduceMotion || !Number.isFinite(target)) {
			render(target || 0);
			return {};
		}
		let start = 0;
		let raf = 0;
		const tick = (now: number) => {
			if (!start) start = now;
			const t = Math.min(1, (now - start) / 900);
			render(target * (1 - Math.pow(1 - t, 3)));
			if (t < 1) raf = requestAnimationFrame(tick);
		};
		render(0);
		raf = requestAnimationFrame(tick);
		return { destroy: () => cancelAnimationFrame(raf) };
	}

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

	const memberAvatar = $derived(data.memberAvatar ?? `https://cdn.discordapp.com/embed/avatars/${(Number(data.memberDiscordId) || 0) % 5}.png`);

	const tenureDays = $derived.by(() => {
		if (!p.joined) return null;
		const t = new Date(p.joined.replace(' ', 'T') + 'Z').getTime();
		if (Number.isNaN(t)) return null;
		return Math.max(0, Math.floor((Date.now() - t) / 86400000));
	});

	const xpSources = $derived((p.xpSources ?? []) as { key: string; label: string; icon: string; color: string; xp: number }[]);
	const xpSourceTotal = $derived(xpSources.reduce((s, x) => s + x.xp, 0));
	const xpSourceBars = $derived.by(() => {
		const max = Math.max(1, ...xpSources.map((s) => s.xp));
		return xpSources.map((s) => ({ ...s, pct: Math.max(3, Math.round((s.xp / max) * 100)), share: xpSourceTotal > 0 ? (s.xp / xpSourceTotal) * 100 : 0 }));
	});

	const activityBars = $derived.by(() => {
		const rows = [
			{ label: 'Messages', value: Math.max(0, p.chatTotal || 0), icon: 'fa-comments', color: '#245f73' },
			{ label: 'Voice', value: Math.max(0, p.voiceActive || 0), icon: 'fa-microphone', color: '#1f8a4c' },
			{ label: 'Video', value: Math.max(0, p.voiceVideo || 0), icon: 'fa-video', color: '#6d5bd0' },
			{ label: 'Stream', value: Math.max(0, p.voiceStreaming || 0), icon: 'fa-desktop', color: '#c8911a' },
			{ label: 'AFK', value: Math.max(0, p.voiceAfk || 0), icon: 'fa-moon', color: '#b23b3b' }
		];
		const max = Math.max(1, ...rows.map((r) => r.value));
		return rows.map((r) => ({ ...r, pct: Math.max(2, Math.round((r.value / max) * 100)) }));
	});

	const d = $derived((data.dashboard ?? {}) as Record<string, number>);
	const ins = $derived(data.insights ?? { favorite_items: [], interactions: {}, effect_usage: [], asset_holdings: [] });
	const interactions = $derived((ins.interactions ?? {}) as Record<string, { out: any[]; in: any[] }>);

	const hasMarket = $derived((d.assets_trade_count ?? 0) > 0 || (d.assets_market_value ?? 0) > 0);
	const hasItems = $derived((d.items_buys ?? 0) > 0);
	const hasMinigames = $derived((d.minigames_plays ?? 0) > 0);
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

	const INTERACTION_LISTS = [
		{ key: 'steal', dir: 'out', title: 'Robbed most', icon: 'fa-hand', fill: 'm-ov-bar-fill--steal' },
		{ key: 'steal', dir: 'in', title: 'Robbed by', icon: 'fa-skull-crossbones', fill: 'm-ov-bar-fill--danger' },
		{ key: 'bomb', dir: 'out', title: 'Bombed most', icon: 'fa-bomb', fill: 'm-ov-bar-fill--steal' },
		{ key: 'bomb', dir: 'in', title: 'Bombed by', icon: 'fa-burst', fill: 'm-ov-bar-fill--danger' },
		{ key: 'leech', dir: 'out', title: 'Leeched most', icon: 'fa-droplet', fill: 'm-ov-bar-fill--steal' },
		{ key: 'leech', dir: 'in', title: 'Leeched by', icon: 'fa-droplet', fill: 'm-ov-bar-fill--danger' },
		{ key: 'gift', dir: 'out', title: 'Gifts to', icon: 'fa-gift', fill: 'm-ov-bar-fill--gift' },
		{ key: 'gift', dir: 'in', title: 'Gifts from', icon: 'fa-hand-holding-heart', fill: 'm-ov-bar-fill--gift' },
		{ key: 'spy', dir: 'out', title: 'Spied most', icon: 'fa-magnifying-glass', fill: 'm-ov-bar-fill--steal' }
	];
	const interactionLists = $derived(
		INTERACTION_LISTS.map((l) => ({ ...l, rows: (interactions[l.key]?.[l.dir as 'out' | 'in'] ?? []) as any[] })).filter((l) => l.rows.length > 0)
	);
	const hasFavorites = $derived((ins.favorite_items ?? []).length > 0);
	const hasHighlights = $derived(hasFavorites || interactionLists.length > 0);

	const positions = $derived(
		(data.positions ?? []) as {
			symbol: string;
			name: string;
			image: string | null;
			change24h: number;
			invested: number;
			value: number;
			pnl: number;
			pnlPercent: number;
		}[]
	);

	const assetsPnl = $derived(Number(d.assets_pnl) || 0);
	const minigamesNet = $derived(Number(d.minigames_net) || 0);
	const minigamesWinRate = $derived((d.minigames_plays ?? 0) > 0 ? Math.round((Number(d.minigames_wins) / Number(d.minigames_plays)) * 100) : 0);

	const PALETTE = ['#245f73', '#733e24', '#c8911a', '#1f8a4c', '#b23b3b', '#6d5bd0', '#e07a5f', '#2a9d8f', '#9b2c6f', '#457b9d'];

	function polar(cx: number, cy: number, r: number, pctPoint: number) {
		const a = (pctPoint / 100) * 2 * Math.PI - Math.PI / 2;
		return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
	}
	function buildPie(items: { value: number; color: string; label: string; icon: string }[]) {
		const total = items.reduce((s, x) => s + x.value, 0);
		if (total <= 0) return { total: 0, segments: [] as any[], full: null as any };
		const visible = items.filter((it) => (it.value / total) * 100 >= 0.5);
		if (visible.length === 1) {
			const it = visible[0];
			return { total, segments: [{ ...it, pct: 100, d: '' }], full: { ...it, pct: 100 } };
		}
		let offset = 0;
		const segments = visible.map((it) => {
			const pct = (it.value / total) * 100;
			const large = pct > 50 ? 1 : 0;
			const p1 = polar(50, 50, 48, offset);
			const p2 = polar(50, 50, 48, offset + pct);
			const dPath = `M50,50 L${p1.x.toFixed(2)},${p1.y.toFixed(2)} A48,48 0 ${large} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)} Z`;
			const seg = { ...it, pct, d: dPath };
			offset += pct;
			return seg;
		});
		return { total, segments, full: null };
	}

	const usagePie = $derived.by(() => {
		const rows = (ins.effect_usage ?? []) as { effect_type: string; uses: number }[];
		const items = rows.map((r, i) => {
			const accent = effectAccentHex(r.effect_type);
			return {
				value: Number(r.uses) || 0,
				color: accent === '#245f73' && i > 0 ? PALETTE[i % PALETTE.length] : accent,
				label: effectLabel(r.effect_type),
				icon: effectIcon(r.effect_type)
			};
		});
		return buildPie(items);
	});

	const allocationPie = $derived.by(() => {
		const rows = (ins.asset_holdings ?? []) as { symbol: string; name: string; invested: number }[];
		const items = rows.map((r, i) => ({
			value: Number(r.invested) || 0,
			color: PALETTE[i % PALETTE.length],
			label: r.symbol || r.name,
			icon: 'fa-coins'
		}));
		return buildPie(items);
	});

	const hasPortfolio = $derived(allocationPie.total > 0 || positions.length > 0);

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

	const buddies = $derived((data.levelFriends ?? []) as { name: string; avatar: string | null; ticks: number; xp: number }[]);
</script>

<svelte:head><title>{data.server.name || data.server.slug} Account | {APP_NAME} Discord Bot</title></svelte:head>

<div class="m-ov" class:m-ov--in={mounted}>
	<div class="m-stat-card m-overview-card m-ov-full m-profile">
		<div class="m-profile-top">
			<div class="m-profile-av">
				<img src={memberAvatar} alt={data.memberName ?? ''} loading="lazy" />
				<span class="m-profile-status" class:m-profile-status--afk={p.isAfk} title={p.isAfk ? 'AFK' : 'Active'}></span>
			</div>
			<div class="m-profile-id">
				<span class="m-profile-name">{data.memberName ?? 'Member'}</span>
				<div class="m-profile-badges">
					{#if data.balance?.rank}<span class="m-badge m-badge--rank"><i class="fas fa-ranking-star"></i> Rank #{fmt(data.balance.rank)}</span>{/if}
					<span class="m-badge"><i class="fas fa-chart-simple"></i> Lvl {fmt(data.balance?.level ?? 1)}</span>
					{#if p.isBooster}<span class="m-badge m-badge--boost"><i class="fas fa-gem"></i> Booster</span>{/if}
					<span class="m-badge" class:m-badge--afk={p.isAfk}><i class="fas {p.isAfk ? 'fa-moon' : 'fa-circle-check'}"></i> {p.isAfk ? 'AFK' : 'Active'}</span>
				</div>
			</div>
		</div>
		<div class="m-profile-meta">
			<div class="m-profile-metaitem">
				<i class="fas fa-calendar-check"></i>
				<div>
					<span class="m-profile-metaval"><LocalTime value={p.joined} fallback="—" /></span>
					<span class="m-profile-metacap"
						>Joined{#if tenureDays != null}
							· {fmt(tenureDays)}d ago{/if}</span
					>
				</div>
			</div>
			<div class="m-profile-metaitem">
				<i class="fab fa-discord"></i>
				<div>
					<span class="m-profile-metaval"><LocalTime value={p.discordSince} fallback="—" /></span>
					<span class="m-profile-metacap">On Discord since</span>
				</div>
			</div>
		</div>
		{#if p.roles.length > 0}
			<div class="m-ov-roles">
				{#each p.roles as role}
					<span class="m-ov-role" style={rolePillVars(role.color)}>
						<i class="fas fa-circle"></i>{role.name || 'Role'}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<div class="m-stat-card m-overview-card m-ov-full">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-3"><i class="fas fa-star"></i></div>
			<h2 class="m-stat-card-title">Total XP</h2>
		</div>
		<div class="m-hero">
			<span class="m-hero-val" use:countUp={p.totalXp}>{fmt(p.totalXp)}</span>
			<span class="m-hero-cap">lifetime experience</span>
		</div>
		{#if xpSourceBars.length > 0}
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Where your XP came from</span>
					<span class="m-bar-meta">{fmt(xpSourceTotal)} tracked</span>
				</div>
				<div class="m-seg-bar m-seg-bar--3" title="XP by source">
					{#each xpSourceBars as s}
						<div class="m-seg" style="width: {s.share * grow}%; background: {s.color};"></div>
					{/each}
				</div>
			</div>
			<div class="m-hbars">
				{#each xpSourceBars as s}
					<div class="m-hbar">
						<span class="m-hbar-label"><i class="fas {s.icon}" style="color: {s.color};"></i> {s.label}</span>
						<div class="m-hbar-track">
							<div class="m-hbar-fill" style="width: {s.pct * grow}%; background: {s.color};"></div>
						</div>
						<span class="m-hbar-val">{fmt(s.xp)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="m-stat-card m-overview-card m-ov-full">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-5"><i class="fas fa-microphone-alt"></i></div>
			<h2 class="m-stat-card-title">Activity</h2>
		</div>
		{#if voiceMix}
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Voice time split</span>
					<span class="m-bar-meta">{fmt(voiceMix.total)} min</span>
				</div>
				<div class="m-seg-bar m-seg-bar--3" title="Active · AFK · Video · Stream">
					<div class="m-seg m-seg--text" style="width: {voiceMix.active * grow}%"></div>
					<div class="m-seg m-seg--other" style="width: {voiceMix.afk * grow}%"></div>
					<div class="m-seg m-seg--voice" style="width: {voiceMix.video * grow}%"></div>
					<div class="m-seg m-seg--b" style="width: {voiceMix.stream * grow}%"></div>
				</div>
			</div>
		{/if}
		<div class="m-hbars">
			{#each activityBars as bar}
				<div class="m-hbar">
					<span class="m-hbar-label"><i class="fas {bar.icon}" style="color: {bar.color};"></i> {bar.label}</span>
					<div class="m-hbar-track">
						<div class="m-hbar-fill" style="width: {bar.pct * grow}%; background: {bar.color};"></div>
					</div>
					<span class="m-hbar-val">{fmt(bar.value)}</span>
				</div>
			{/each}
		</div>
	</div>

	{#if usagePie.total > 0}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-3"><i class="fas fa-chart-pie"></i></div>
				<h2 class="m-stat-card-title">How you play</h2>
			</div>
			<div class="m-chart-split">
				<div class="m-pie-wrap">
					<svg class="m-pie" viewBox="0 0 100 100" role="img" aria-label="Item usage by type">
						{#if usagePie.segments.length === 1}
							<circle cx="50" cy="50" r="48" fill={usagePie.segments[0].color} />
						{:else}
							{#each usagePie.segments as slice}
								<path d={slice.d} fill={slice.color} stroke="rgba(255,255,255,0.85)" stroke-width="0.8" />
							{/each}
						{/if}
						<circle cx="50" cy="50" r="26" fill="#fff" />
						<text x="50" y="47" text-anchor="middle" class="m-pie-total">{fmt(usagePie.total)}</text>
						<text x="50" y="58" text-anchor="middle" class="m-pie-cap">uses</text>
					</svg>
					<div class="m-donut-legend">
						{#each usagePie.segments as seg}
							<div class="m-donut-leg">
								<span class="m-donut-dot" style="background: {seg.color};"></span>
								<i class="fas {seg.icon}" style="color: {seg.color};"></i>
								<span class="m-donut-leg-name">{seg.label}</span>
								<span class="m-donut-leg-val">{fmt(seg.value)}× · {seg.pct.toFixed(0)}%</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="m-colchart">
					{#each usagePie.segments as seg}
						<div class="m-col">
							<span class="m-col-val">{fmt(seg.value)}</span>
							<div class="m-col-track">
								<div class="m-col-fill" style="height: {Math.max(6, seg.pct) * grow}%; background: {seg.color};"></div>
							</div>
							<i class="fas {seg.icon} m-col-ico" style="color: {seg.color};" title={seg.label}></i>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if hasPortfolio}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-2"><i class="fas fa-briefcase"></i></div>
				<h2 class="m-stat-card-title">Portfolio</h2>
			</div>
			<div class="m-portfolio">
				{#if allocationPie.total > 0}
					<div class="m-portfolio-alloc">
						<svg class="m-pie" viewBox="0 0 100 100" role="img" aria-label="Invested XP by asset">
							{#if allocationPie.segments.length === 1}
								<circle cx="50" cy="50" r="48" fill={allocationPie.segments[0].color} />
							{:else}
								{#each allocationPie.segments as slice}
									<path d={slice.d} fill={slice.color} stroke="rgba(255,255,255,0.85)" stroke-width="0.8" />
								{/each}
							{/if}
							<circle cx="50" cy="50" r="27" fill="#fff" />
							<text x="50" y="48" text-anchor="middle" class="m-pie-total">{fmtShort(allocationPie.total)}</text>
							<text x="50" y="58" text-anchor="middle" class="m-pie-cap">invested</text>
						</svg>
						<div class="m-donut-legend">
							{#each allocationPie.segments as seg}
								<div class="m-donut-leg">
									<span class="m-donut-dot" style="background: {seg.color};"></span>
									<span class="m-donut-leg-name">{seg.label}</span>
									<span class="m-donut-leg-val">{seg.pct.toFixed(0)}%</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				{#if positions.length > 0}
					<div class="m-hold-list">
						{#each positions as pos}
							<div class="m-hold">
								{#if pos.image}
									<img
										class="m-hold-ic"
										src={pos.image}
										alt=""
										loading="lazy"
										onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
									/>
								{:else}
									<span class="m-hold-ic m-hold-ic--ph"><i class="fas fa-coins"></i></span>
								{/if}
								<div class="m-hold-id">
									<span class="m-hold-sym">{pos.symbol}</span>
									<span class="m-hold-sub">{fmtShort(pos.value)} · from {fmtShort(pos.invested)}</span>
								</div>
								<div class="m-hold-pnl" data-dir={pos.pnl > 0 ? 'up' : pos.pnl < 0 ? 'down' : 'flat'}>
									<span class="m-hold-pnl-v"
										><i class="fas fa-caret-{pos.pnl >= 0 ? 'up' : 'down'}"></i>{pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%</span
									>
									<span class="m-hold-pnl-x">{pos.pnl >= 0 ? '+' : '−'}{fmtShort(Math.abs(pos.pnl))}</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
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
									) * grow}%;"
								></div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if hasHighlights}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-1"><i class="fas fa-fire-flame-curved"></i></div>
				<h2 class="m-stat-card-title">Highlights</h2>
			</div>
			<div class="m-ov-lists">
				{#if hasFavorites}
					{@const fav = ins.favorite_items[0]}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas fa-star"></i> Favorite item</span>
						<div class="m-fav" style="--fav: {fav.effect_type ? effectAccentHex(fav.effect_type) : 'var(--chili-hot)'};">
							<span class="m-fav-ic"><i class="fas {fav.effect_type ? effectIcon(fav.effect_type) : 'fa-cube'}"></i></span>
							<div class="m-fav-body">
								<span class="m-fav-name">{fav.name}</span>
								<span class="m-fav-sub">most used</span>
							</div>
							<span class="m-fav-count">{fmt(fav.uses)}×</span>
						</div>
					</div>
				{/if}
				{#each interactionLists as list}
					<div class="m-ov-list">
						<span class="m-ov-list-title"><i class="fas {list.icon}"></i> {list.title}</span>
						{#each list.rows as t}
							<div class="m-ov-bar-row">
								<div class="m-ov-bar-head">
									<span class="m-ov-list-name">{t.name}</span>
									<span class="m-ov-list-val">{t.xp > 0 ? `${fmt(t.xp)} XP` : `${fmt(t.hits)}×`}</span>
								</div>
								<div class="m-ov-bar-track">
									<div
										class="m-ov-bar-fill {list.fill}"
										style="width: {barPct(
											t.xp || t.hits,
											list.rows.map((r) => ({ xp: r.xp || r.hits }))
										) * grow}%;"
									></div>
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if hasMarket || hasItems || hasMinigames}
		<div class="m-econ3 m-ov-full">
			{#if hasMarket}
				<div class="m-stat-card m-overview-card">
					<div class="m-stat-card-head">
						<div class="m-stat-card-icon m-chili-stat-2"><i class="fas fa-chart-line"></i></div>
						<h2 class="m-stat-card-title">Market</h2>
					</div>
					<div class="m-hero">
						<span class="m-hero-val" use:countUp={d.assets_market_value}>{fmt(d.assets_market_value)}</span>
						<span class="m-hero-cap">assets value · XP</span>
						<span class="m-hero-chip" data-dir={assetsPnl >= 0 ? 'up' : 'down'}>
							<i class="fas fa-arrow-trend-{assetsPnl >= 0 ? 'up' : 'down'}"></i>{assetsPnl >= 0 ? '+' : '−'}{fmt(Math.abs(assetsPnl))} open P/L
						</span>
					</div>
					<div class="m-mini-grid">
						<div class="m-mini">
							<i class="fas fa-right-left"></i>
							<span class="m-mini-value">{fmt(d.assets_trade_count)}</span>
							<span class="m-mini-label">Trades</span>
						</div>
						<div class="m-mini">
							<i class="fas fa-briefcase"></i>
							<span class="m-mini-value">{fmt(d.assets_open_positions)}</span>
							<span class="m-mini-label">Open assets</span>
						</div>
					</div>
				</div>
			{/if}

			{#if hasItems}
				<div class="m-stat-card m-overview-card">
					<div class="m-stat-card-head">
						<div class="m-stat-card-icon m-chili-stat-4"><i class="fas fa-bag-shopping"></i></div>
						<h2 class="m-stat-card-title">Items</h2>
					</div>
					<div class="m-hero">
						<span class="m-hero-val" use:countUp={d.items_buys}>{fmt(d.items_buys)}</span>
						<span class="m-hero-cap">items bought</span>
					</div>
					<div class="m-mini-grid">
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
					</div>
				</div>
			{/if}

			{#if hasMinigames}
				<div class="m-stat-card m-overview-card">
					<div class="m-stat-card-head">
						<div class="m-stat-card-icon m-chili-stat-3"><i class="fas fa-dice"></i></div>
						<h2 class="m-stat-card-title">Minigames</h2>
					</div>
					<div class="m-ring-row">
						<div class="m-ring" style="--pct: {minigamesWinRate * grow}; --ring-color: {minigamesWinRate >= 50 ? '#1f8a4c' : '#c8911a'};">
							<span class="m-ring-val"><span use:countUp={minigamesWinRate}>{minigamesWinRate}</span>%</span>
							<span class="m-ring-cap">win rate</span>
						</div>
						<div class="m-ring-side">
							<div class="m-ring-stat"><span>{fmt(d.minigames_plays)}</span><small>plays</small></div>
							<div class="m-ring-stat" data-dir={minigamesNet >= 0 ? 'up' : 'down'}>
								<span>{minigamesNet >= 0 ? '+' : '−'}{fmt(Math.abs(minigamesNet))}</span><small>net winnings</small>
							</div>
						</div>
					</div>
					<div class="m-mini-grid">
						<div class="m-mini">
							<i class="fas fa-coins"></i>
							<span class="m-mini-value">{fmt(d.minigames_wagered)}</span>
							<span class="m-mini-label">XP wagered</span>
						</div>
						<div class="m-mini">
							<i class="fas fa-trophy"></i>
							<span class="m-mini-value">{fmt(d.minigames_biggest_win)}</span>
							<span class="m-mini-label">Biggest win</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if hasPvp}
		<div class="m-stat-card m-overview-card m-ov-full">
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
						<div
							class="m-duel-fill m-duel-fill--win"
							style="width: {barPct(d.items_stolen, [{ xp: d.items_stolen }, { xp: d.items_stolen_from }]) * grow}%;"
						></div>
						<div
							class="m-duel-fill m-duel-fill--lose"
							style="width: {barPct(d.items_stolen_from, [{ xp: d.items_stolen }, { xp: d.items_stolen_from }]) * grow}%;"
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
