<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
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
	const defense = $derived((ins.defense ?? {}) as Record<string, number>);
	const relationships = $derived((ins.relationships ?? {}) as Record<string, { name: string; hits: number; xp: number } | null>);
	const relationCards = $derived(
		[
			{ key: 'nemesis', title: 'Nemesis', sub: 'attacks you most', icon: 'fa-skull-crossbones', accent: '#b23b3b', row: relationships.nemesis },
			{
				key: 'favorite_target',
				title: 'Favorite target',
				sub: 'you attack most',
				icon: 'fa-crosshairs',
				accent: '#733e24',
				row: relationships.favorite_target
			},
			{ key: 'best_ally', title: 'Best ally', sub: 'gifts exchanged', icon: 'fa-handshake', accent: '#1f8a4c', row: relationships.best_ally }
		].filter((r) => r.row && r.row.name)
	);

	const INTERACTION_LISTS = [
		{ key: 'steal', dir: 'out', group: 'offense', title: 'Robbed most', icon: 'fa-hand', fill: 'm-ov-bar-fill--steal' },
		{ key: 'bomb', dir: 'out', group: 'offense', title: 'Bombed most', icon: 'fa-bomb', fill: 'm-ov-bar-fill--steal' },
		{ key: 'leech', dir: 'out', group: 'offense', title: 'Leeched most', icon: 'fa-droplet', fill: 'm-ov-bar-fill--steal' },
		{ key: 'spy', dir: 'out', group: 'offense', title: 'Spied on most', icon: 'fa-magnifying-glass', fill: 'm-ov-bar-fill--steal' },
		{ key: 'gift', dir: 'out', group: 'offense', title: 'Gifted to most', icon: 'fa-gift', fill: 'm-ov-bar-fill--gift' },
		{ key: 'bounty', dir: 'out', group: 'offense', title: 'Bounties placed on', icon: 'fa-crown', fill: 'm-ov-bar-fill--steal' },
		{ key: 'steal', dir: 'in', group: 'defense', title: 'Robbed by', icon: 'fa-skull-crossbones', fill: 'm-ov-bar-fill--danger' },
		{ key: 'bomb', dir: 'in', group: 'defense', title: 'Bombed by', icon: 'fa-burst', fill: 'm-ov-bar-fill--danger' },
		{ key: 'leech', dir: 'in', group: 'defense', title: 'Leeched by', icon: 'fa-droplet', fill: 'm-ov-bar-fill--danger' },
		{ key: 'gift', dir: 'in', group: 'defense', title: 'Gifted from', icon: 'fa-hand-holding-heart', fill: 'm-ov-bar-fill--gift' },
		{ key: 'bounty', dir: 'in', group: 'defense', title: 'Bounties on you from', icon: 'fa-skull', fill: 'm-ov-bar-fill--danger' },
		{ key: 'spy_caught', dir: 'out', group: 'defense', title: 'Caught spying on you', icon: 'fa-user-secret', fill: 'm-ov-bar-fill--gift' },
		{ key: 'blocked', dir: 'out', group: 'defense', title: 'Blocked their attack', icon: 'fa-shield-halved', fill: 'm-ov-bar-fill--gift' },
		{ key: 'reflected', dir: 'out', group: 'defense', title: 'Reflected back at', icon: 'fa-arrows-rotate', fill: 'm-ov-bar-fill--gift' }
	];
	const interactionLists = $derived(
		INTERACTION_LISTS.map((l) => ({ ...l, rows: (interactions[l.key]?.[l.dir as 'out' | 'in'] ?? []) as any[] })).filter((l) => l.rows.length > 0)
	);
	const offenseLists = $derived(interactionLists.filter((l) => l.group === 'offense'));
	const defenseLists = $derived(interactionLists.filter((l) => l.group === 'defense'));
	const hasFavorites = $derived((ins.favorite_items ?? []).length > 0);

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

<div class="m-ov grid items-start gap-4" class:m-ov--in={mounted}>
	<div class="m-stat-card m-overview-card m-ov-full rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"><i class="fas fa-star"></i></div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Total XP</h2>
		</div>
		<div class="m-stat-hero mt-2 rounded-[14px] p-3 text-center">
			<span class="m-stat-hero-val text-lb-text block font-extrabold tabular-nums" use:countUp={p.totalXp}>{fmt(p.totalXp)}</span>
			<span class="m-stat-hero-cap text-lb-text-muted mt-0 block text-base font-semibold uppercase">lifetime experience</span>
		</div>
		{#if xpSourceBars.length > 0}
			<div class="m-bar-block mt-4">
				<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
					<span>Where your XP came from</span>
					<span class="m-bar-meta text-base font-bold text-[rgba(36,95,115,0.88)] tabular-nums">{fmt(xpSourceTotal)} tracked</span>
				</div>
				<div class="m-seg-bar flex h-2 overflow-hidden rounded-[99px]" title="XP by source">
					{#each xpSourceBars as s}
						<div class="m-seg h-full min-w-0" style="width: {s.share * grow}%; background: {s.color};"></div>
					{/each}
				</div>
			</div>
			<div class="m-hbars mt-4 flex flex-col gap-2">
				{#each xpSourceBars as s}
					<div class="m-hbar gap-2">
						<span class="m-hbar-label text-lb-text inline-flex min-w-0 items-center gap-2 text-base font-semibold"
							><i class="fas {s.icon}" style="color: {s.color};"></i> {s.label}</span
						>
						<div class="m-hbar-track h-2 overflow-hidden rounded-[99px]">
							<div class="m-hbar-fill h-full rounded-[99px]" style="width: {s.pct * grow}%; background: {s.color};"></div>
						</div>
						<span class="m-hbar-val text-lb-text-muted text-right text-base font-bold whitespace-nowrap tabular-nums">{fmt(s.xp)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if flowChart}
		<div class="m-stat-card m-overview-card m-ov-full rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-chart-line"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">XP flow · last 14 days</h2>
			</div>
			<div class="m-line-meta mx-0 mt-4 mb-2 flex items-baseline justify-between gap-2">
				<span class="m-line-cap text-lb-text-muted text-base font-semibold">Cumulative net XP</span>
				<span class="m-line-val inline-flex items-center gap-1 text-base font-extrabold tabular-nums" data-dir={flowChart.up ? 'up' : 'down'}>
					<i class="fas fa-arrow-trend-{flowChart.up ? 'up' : 'down'}"></i>{flowChart.up ? '+' : '−'}{fmt(Math.abs(flowChart.last))}
				</span>
			</div>
			<svg class="m-line block h-22 w-full" viewBox="0 0 {flowChart.W} {flowChart.H}" preserveAspectRatio="none" role="img" aria-label="XP flow over time">
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

	<div class="m-stat-card m-overview-card m-ov-full rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-microphone-alt"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Activity</h2>
		</div>
		{#if voiceMix}
			<div class="m-bar-block mt-4">
				<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
					<span>Voice time split</span>
					<span class="m-bar-meta text-base font-bold text-[rgba(36,95,115,0.88)] tabular-nums">{fmt(voiceMix.total)} min</span>
				</div>
				<div class="m-seg-bar flex h-2 overflow-hidden rounded-[99px]" title="Active · AFK · Video · Stream">
					<div class="m-seg h-full min-w-0" style="width: {voiceMix.active * grow}%; background: #1f8a4c;"></div>
					<div class="m-seg h-full min-w-0" style="width: {voiceMix.afk * grow}%; background: #b23b3b;"></div>
					<div class="m-seg h-full min-w-0" style="width: {voiceMix.video * grow}%; background: #6d5bd0;"></div>
					<div class="m-seg h-full min-w-0" style="width: {voiceMix.stream * grow}%; background: #c8911a;"></div>
				</div>
			</div>
		{/if}
		<div class="m-hbars mt-4 flex flex-col gap-2">
			{#each activityBars as bar}
				<div class="m-hbar gap-2">
					<span class="m-hbar-label text-lb-text inline-flex min-w-0 items-center gap-2 text-base font-semibold"
						><i class="fas {bar.icon}" style="color: {bar.color};"></i> {bar.label}</span
					>
					<div class="m-hbar-track h-2 overflow-hidden rounded-[99px]">
						<div class="m-hbar-fill h-full rounded-[99px]" style="width: {bar.pct * grow}%; background: {bar.color};"></div>
					</div>
					<span class="m-hbar-val text-lb-text-muted text-right text-base font-bold whitespace-nowrap tabular-nums">{fmt(bar.value)}</span>
				</div>
			{/each}
		</div>
	</div>

	{#if buddies.length > 0}
		<div class="m-stat-card m-overview-card m-ov-full rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-people-group"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">Voice buddies</h2>
			</div>
			<p class="m-buddy-cap text-lb-text-muted mx-0 mt-1 mb-0 text-base">Members you level up with most in voice</p>
			<div class="m-buddy-list mt-4 flex flex-col gap-3">
				{#each buddies as b, i}
					<div class="m-buddy flex items-center gap-2">
						<span class="m-buddy-rank inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-base font-extrabold text-[rgba(36,95,115,0.9)]"
							>{i + 1}</span
						>
						{#if b.avatar}
							<img
								class="m-buddy-av h-8 w-8 shrink-0 rounded-full object-cover"
								src={b.avatar}
								alt=""
								loading="lazy"
								onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
							/>
						{:else}
							<span
								class="m-buddy-av m-buddy-av--ph text-lb-text-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full object-cover text-base"
								><i class="fas fa-user"></i></span
							>
						{/if}
						<div class="m-buddy-body flex min-w-0 flex-1 flex-col gap-1">
							<div class="m-buddy-head text-lb-text flex items-center gap-2 text-base font-semibold">
								<span class="m-ov-list-name min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{b.name}</span>
								<span class="m-ov-list-val text-lb-text-muted font-bold tabular-nums">{fmt(b.xp)} XP together</span>
							</div>
							<div class="m-ov-bar-track h-2 overflow-hidden rounded-[99px]">
								<div
									class="m-ov-bar-fill m-ov-bar-fill--steal h-full rounded-[99px]"
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

	{#if hasPortfolio}
		<div class="m-stat-card m-overview-card m-ov-full rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-briefcase"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">Portfolio</h2>
			</div>
			<div class="m-portfolio gap-6">
				{#if allocationPie.total > 0}
					<div class="m-portfolio-alloc flex min-w-0 items-center gap-4">
						<svg class="m-pie h-32 w-32 max-w-[40vw] shrink-0" viewBox="0 0 100 100" role="img" aria-label="Invested XP by asset">
							{#if allocationPie.segments.length === 1}
								<circle cx="50" cy="50" r="48" fill={allocationPie.segments[0].color} />
							{:else}
								{#each allocationPie.segments as slice}
									<path d={slice.d} fill={slice.color} stroke="rgba(255,255,255,0.85)" stroke-width="0.8" />
								{/each}
							{/if}
							<circle cx="50" cy="50" r="27" fill="#fff" />
							<text x="50" y="48" text-anchor="middle" class="m-pie-total text-base font-extrabold">{fmtShort(allocationPie.total)}</text>
							<text x="50" y="58" text-anchor="middle" class="m-pie-cap text-base font-semibold uppercase">invested</text>
						</svg>
						<div class="m-donut-legend flex min-w-38 flex-1 flex-col gap-2">
							{#each allocationPie.segments as seg}
								<div class="m-donut-leg m-donut-leg--tight text-lb-text flex items-center gap-2 text-base font-semibold">
									<span class="m-donut-dot h-2 w-2 shrink-0 rounded" style="background: {seg.color};"></span>
									<span class="m-donut-leg-name min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{seg.label}</span>
									<span class="m-donut-leg-pct text-lb-text-muted text-base font-bold tabular-nums">{seg.pct.toFixed(0)}%</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				{#if positions.length > 0}
					<div class="m-hold-list mt-4 flex flex-col gap-2">
						{#each positions as pos}
							<div class="m-hold flex items-center gap-3 rounded-xl px-3 py-2">
								{#if pos.image}
									<img
										class="m-hold-ic h-8 w-8 shrink-0 rounded-full object-cover"
										src={pos.image}
										alt=""
										loading="lazy"
										onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
									/>
								{:else}
									<span
										class="m-hold-ic m-hold-ic--ph text-lb-text-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full object-cover text-base"
										><i class="fas fa-coins"></i></span
									>
								{/if}
								<div class="m-hold-id min-w-0 flex-1">
									<span class="m-hold-sym text-lb-text block overflow-hidden text-base font-extrabold text-ellipsis whitespace-nowrap">{pos.symbol}</span>
									<span class="m-hold-sub text-lb-text-muted block overflow-hidden text-base font-semibold text-ellipsis whitespace-nowrap tabular-nums"
										>{fmtShort(pos.value)} · from {fmtShort(pos.invested)}</span
									>
								</div>
								<div class="m-hold-pnl max-w-[45%] shrink-0 text-right" data-dir={pos.pnl > 0 ? 'up' : pos.pnl < 0 ? 'down' : 'flat'}>
									<span class="m-hold-pnl-v block text-base font-extrabold whitespace-nowrap tabular-nums"
										><i class="fas fa-caret-{pos.pnl >= 0 ? 'up' : 'down'}"></i>{pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%</span
									>
									<span class="m-hold-pnl-x text-lb-text-muted block text-base font-semibold whitespace-nowrap tabular-nums"
										>{pos.pnl >= 0 ? '+' : '−'}{fmtShort(Math.abs(pos.pnl))}</span
									>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="m-econ3 m-ov-full items-stretch">
		<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-chart-line"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">Market</h2>
			</div>
			<div class="m-stat-hero mt-2 rounded-[14px] p-3 text-center">
				<span class="m-stat-hero-val text-lb-text block font-extrabold tabular-nums" use:countUp={d.assets_market_value}>{fmt(d.assets_market_value)}</span>
				<span class="m-stat-hero-cap text-lb-text-muted mt-0 block text-base font-semibold uppercase">assets value · XP</span>
				<span
					class="m-stat-hero-chip mt-2 inline-flex items-center gap-1 rounded-[99px] px-2 py-1 text-base font-bold"
					data-dir={assetsPnl >= 0 ? 'up' : 'down'}
				>
					<i class="fas fa-arrow-trend-{assetsPnl >= 0 ? 'up' : 'down'}"></i>{assetsPnl >= 0 ? '+' : '−'}{fmt(Math.abs(assetsPnl))} open P/L
				</span>
			</div>
			<div class="m-mini-grid mt-4 gap-2">
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-right-left"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.assets_trade_count)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Trades</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-briefcase"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.assets_open_positions)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Open assets</span>
				</div>
			</div>
		</div>

		<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-dice"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">Minigames</h2>
			</div>
			<div class="m-ring-row mt-3 flex items-center gap-4">
				<div
					class="m-ring flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full"
					style="--pct: {minigamesWinRate * grow}; --ring-color: {minigamesWinRate >= 50 ? '#1f8a4c' : '#c8911a'};"
				>
					<span class="m-ring-val text-lb-text text-lg font-extrabold tabular-nums"><span use:countUp={minigamesWinRate}>{minigamesWinRate}</span>%</span>
					<span class="m-ring-cap text-lb-text-muted text-base font-semibold uppercase">win rate</span>
				</div>
				<div class="m-ring-side flex min-w-0 flex-1 flex-col gap-2">
					<div class="m-ring-stat min-w-0"><span>{fmt(d.minigames_plays)}</span><small>plays</small></div>
					<div class="m-ring-stat min-w-0" data-dir={minigamesNet >= 0 ? 'up' : 'down'}>
						<span>{minigamesNet >= 0 ? '+' : '−'}{fmt(Math.abs(minigamesNet))}</span><small>net winnings</small>
					</div>
				</div>
			</div>
			<div class="m-mini-grid mt-4 gap-2">
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-coins"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.minigames_wagered)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">XP wagered</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-trophy"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.minigames_biggest_win)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Biggest win</span>
				</div>
			</div>
		</div>

		<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-bag-shopping"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">Items</h2>
			</div>
			<div class="m-stat-hero mt-2 rounded-[14px] p-3 text-center">
				<span class="m-stat-hero-val text-lb-text block font-extrabold tabular-nums" use:countUp={d.items_buys}>{fmt(d.items_buys)}</span>
				<span class="m-stat-hero-cap text-lb-text-muted mt-0 block text-base font-semibold uppercase">items bought</span>
			</div>
			<div class="m-mini-grid mt-4 gap-2">
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-coins"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_buy_spend)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">XP spent</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-wand-magic-sparkles"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_activations)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Activations</span>
				</div>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card m-ov-full rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-fire-flame-curved"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Highlights</h2>
		</div>
		{#if relationCards.length > 0}
			<div class="m-rel-row mt-4 gap-2">
				{#each relationCards as r}
					<div class="m-rel flex min-w-0 items-center gap-3 rounded-[14px] p-3" style="--rel: {r.accent};">
						<span class="m-rel-ic inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base text-white"><i class="fas {r.icon}"></i></span
						>
						<div class="m-rel-body flex min-w-0 flex-col">
							<span class="m-rel-title text-base font-bold uppercase">{r.title}</span>
							<span class="m-rel-name text-lb-text overflow-hidden text-base font-extrabold text-ellipsis whitespace-nowrap">{r.row?.name}</span>
							<span class="m-rel-sub text-lb-text-muted overflow-hidden text-base font-semibold text-ellipsis whitespace-nowrap tabular-nums"
								>{r.sub} · {r.row && r.row.xp > 0 ? `${fmtShort(r.row.xp)} XP` : `${fmt(r.row?.hits ?? 0)}×`}</span
							>
						</div>
					</div>
				{/each}
			</div>
		{/if}
		{#snippet listGroup(lists: any[])}
			<div class="m-ov-lists mt-4 grid gap-4">
				{#each lists as list}
					<div class="m-ov-list flex flex-col gap-2">
						<span class="m-ov-list-title text-lb-text-muted text-base font-bold uppercase"><i class="fas {list.icon}"></i> {list.title}</span>
						{#each list.rows as t}
							<div class="m-ov-bar-row flex flex-col gap-1">
								<div class="m-ov-bar-head text-lb-text flex items-center gap-2 text-base font-semibold">
									<span class="m-ov-list-name min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{t.name}</span>
									<span class="m-ov-list-val text-lb-text-muted font-bold tabular-nums">{t.xp > 0 ? `${fmt(t.xp)} XP` : `${fmt(t.hits)}×`}</span>
								</div>
								<div class="m-ov-bar-track h-2 overflow-hidden rounded-[99px]">
									<div
										class="m-ov-bar-fill {list.fill} h-full rounded-[99px]"
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
		{/snippet}

		{#if hasFavorites}
			{@const fav = ins.favorite_items[0]}
			<div class="m-ov-fav-wrap mt-4 flex flex-col gap-2">
				<span class="m-ov-group-title text-lb-text mx-0 mt-4 mb-1 flex items-center gap-2 text-base font-extrabold uppercase"
					><i class="fas fa-star"></i> Favorite item</span
				>
				<div class="m-fav flex items-center gap-3 rounded-[14px] p-3" style="--fav: {fav.effect_type ? effectAccentHex(fav.effect_type) : 'var(--chili-hot)'};">
					<span class="m-fav-ic inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base text-white"
						><i class="fas {fav.effect_type ? effectIcon(fav.effect_type) : 'fa-cube'}"></i></span
					>
					<div class="m-fav-body min-w-0 flex-1">
						<span class="m-fav-name text-lb-text block overflow-hidden text-base font-extrabold text-ellipsis whitespace-nowrap">{fav.name}</span>
						<span class="m-fav-sub text-lb-text-muted block text-base font-semibold uppercase"
							>most used{fav.effect_type ? ` · ${effectLabel(fav.effect_type)}` : ''}</span
						>
					</div>
					<span class="m-fav-count shrink-0 text-lg font-extrabold tabular-nums">{fmt(fav.uses)}×</span>
				</div>
			</div>
		{/if}

		{#if offenseLists.length > 0}
			<span class="m-ov-group-title m-ov-group-title--off text-lb-text mx-0 mt-4 mb-1 flex items-center gap-2 text-base font-extrabold uppercase"
				><i class="fas fa-crosshairs"></i> Offense · who you hit</span
			>
			{@render listGroup(offenseLists)}
		{/if}

		{#if defenseLists.length > 0}
			<span class="m-ov-group-title m-ov-group-title--def text-lb-text mx-0 mt-4 mb-1 flex items-center gap-2 text-base font-extrabold uppercase"
				><i class="fas fa-shield-halved"></i> Defense · done to you &amp; blocked</span
			>
			{@render listGroup(defenseLists)}
		{/if}
	</div>

	{#if usagePie.total > 0}
		<div class="m-stat-card m-overview-card m-ov-full rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-chart-pie"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">Item usage by type</h2>
			</div>
			<p class="m-card-note text-lb-text-muted mx-0 mt-2 mb-0 text-base">How often you've used each item effect — attacks, buffs and utility combined.</p>
			<div class="m-chart-split items-center">
				<div class="m-pie-wrap flex flex-wrap items-center gap-4">
					<svg class="m-pie h-32 w-32 max-w-[40vw] shrink-0" viewBox="0 0 100 100" role="img" aria-label="Item usage by type">
						{#if usagePie.segments.length === 1}
							<circle cx="50" cy="50" r="48" fill={usagePie.segments[0].color} />
						{:else}
							{#each usagePie.segments as slice}
								<path d={slice.d} fill={slice.color} stroke="rgba(255,255,255,0.85)" stroke-width="0.8" />
							{/each}
						{/if}
						<circle cx="50" cy="50" r="26" fill="#fff" />
						<text x="50" y="47" text-anchor="middle" class="m-pie-total text-base font-extrabold">{fmt(usagePie.total)}</text>
						<text x="50" y="58" text-anchor="middle" class="m-pie-cap text-base font-semibold uppercase">uses</text>
					</svg>
					<div class="m-donut-legend flex min-w-38 flex-1 flex-col gap-2">
						{#each usagePie.segments as seg}
							<div class="m-donut-leg text-lb-text flex items-center gap-2 text-base font-semibold">
								<span class="m-donut-dot h-2 w-2 shrink-0 rounded" style="background: {seg.color};"></span>
								<i class="fas {seg.icon}" style="color: {seg.color};"></i>
								<span class="m-donut-leg-name min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{seg.label}</span>
								<span class="m-donut-leg-val text-lb-text-muted text-base font-bold tabular-nums">{fmt(seg.value)}× · {seg.pct.toFixed(0)}%</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="m-colchart flex h-38 items-end justify-around gap-2 pt-2">
					{#each usagePie.segments as seg}
						<div class="m-col flex h-full min-w-0 flex-1 flex-col items-center gap-2">
							<span class="m-col-val text-lb-text text-base font-bold tabular-nums">{fmt(seg.value)}</span>
							<div class="m-col-track flex w-[60%] max-w-6 flex-1 items-end overflow-hidden rounded-t-lg">
								<div class="m-col-fill w-full rounded-t-lg" style="height: {Math.max(6, seg.pct) * grow}%; background: {seg.color};"></div>
							</div>
							<i class="fas {seg.icon} m-col-ico text-base" style="color: {seg.color};" title={seg.label}></i>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<div class="m-econ2 m-ov-full items-stretch">
		<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-crosshairs"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">Your PvP record</h2>
			</div>
			<div class="m-duel mt-4">
				<div class="m-duel-head mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-base font-bold">
					<span class="m-duel-l whitespace-nowrap text-[rgba(36,95,115,0.9)]">You stole {fmt(d.items_stolen)}</span>
					<span class="m-duel-net text-lb-text-muted rounded-[99px] px-2 py-0 text-center text-base" data-dir={stealNet >= 0 ? 'up' : 'down'}
						>{stealNet >= 0 ? 'net +' : 'net −'}{fmt(Math.abs(stealNet))}</span
					>
					<span class="m-duel-r text-danger-soft whitespace-nowrap">{fmt(d.items_stolen_from)} lost</span>
				</div>
				<div class="m-duel-bar flex h-2 gap-0 overflow-hidden rounded-[99px]">
					<div
						class="m-duel-fill m-duel-fill--win h-full rounded-[99px]"
						style="width: {barPct(d.items_stolen, [{ xp: d.items_stolen }, { xp: d.items_stolen_from }]) * grow}%;"
					></div>
					<div
						class="m-duel-fill m-duel-fill--lose h-full rounded-[99px]"
						style="width: {barPct(d.items_stolen_from, [{ xp: d.items_stolen }, { xp: d.items_stolen_from }]) * grow}%;"
					></div>
				</div>
			</div>
			<div class="m-mini-grid mt-4 gap-2">
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-hand"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_stolen)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">XP stolen</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-shield-halved"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_stolen_from)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Stolen from you</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-bomb"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_bombed)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">XP bombed</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-burst"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_bombed_by)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Bombed you</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-gift"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_gifted)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Gifted out</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-hand-holding-heart"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_gifts_received)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Received</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-magnifying-glass"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_spies)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Spy reports</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-crown"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.items_bounties_placed)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Bounties set</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center" data-dir="down">
					<i class="fas fa-skull"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.bounty_on_me)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Bounty on you</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center" data-dir="up">
					<i class="fas fa-user-secret"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(defense.spies_caught)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Spies caught</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center" data-dir="up">
					<i class="fas fa-shield-halved"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(defense.blocked)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Attacks blocked</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center" data-dir="up">
					<i class="fas fa-arrows-rotate"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(defense.reflected)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Attacks reflected</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center" data-dir="down">
					<i class="fas fa-handcuffs"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(defense.my_steals_caught)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Caught stealing</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center" data-dir="up">
					<i class="fas fa-umbrella"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(defense.insurance_covers)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Insurance covers</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center" data-dir="up">
					<i class="fas fa-hand-holding-dollar"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(defense.insurance_xp)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">XP recovered</span>
				</div>
			</div>
		</div>

		<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
			<div class="m-stat-card-head mb-4 flex items-center gap-3">
				<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
					<i class="fas fa-fire"></i>
				</div>
				<h2 class="m-stat-card-title text-lb-text text-base font-bold">Your engagement</h2>
			</div>
			<div class="m-mini-grid mt-4 gap-2">
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-ticket"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.giveaways_entered)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Giveaways entered</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-medal"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.giveaways_won)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Giveaways won</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-gift"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.giveaways_hosted)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Hosted</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-scroll"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.quests_enrolled)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Quests</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-award"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.quests_claimed)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Rewards claimed</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-tower-broadcast"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.streams_total)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Streams</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-eye"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.streams_peak_viewers)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Peak viewers</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-heart"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.streams_likes)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Likes</span>
				</div>
				<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
					<i class="fas fa-comment-dots"></i>
					<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(d.feedback_submitted)}</span>
					<span class="m-mini-label text-lb-text-subtle text-base font-semibold uppercase">Feedback given</span>
				</div>
			</div>
		</div>
	</div>
</div>
