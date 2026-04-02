<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Metric = typeof data.metric;
	type Range = typeof data.range;

	let metric = $state<Metric>(data.metric);
	let range = $state<Range>(data.range);
	let rows = $state(data.rows);
	let es: EventSource | null = null;

	const top3 = $derived(rows.slice(0, 3));
	const rest = $derived(rows.slice(3));
	const maxValue = $derived(Math.max(1, ...rows.map((r: any) => metricValueNumber(r, metric))));

	let anim = $state<Record<string, number>>({});
	let raf: number | null = null;

	function displayName(r: any) {
		return r.server_display_name || r.display_name || r.username || r.discord_member_id;
	}

	function metricLabel(m: string) {
		if (m === 'chat') return 'Messages';
		if (m === 'voice_total') return 'Voice (Total)';
		if (m === 'voice_active') return 'Voice (Active)';
		if (m === 'voice_afk') return 'Voice (AFK)';
		return 'XP';
	}

	function metricValue(r: any, m: string) {
		if (m === 'chat') return Number(r.chat_total || 0).toLocaleString();
		if (m === 'voice_total') return `${Number(r.voice_minutes_total || 0).toLocaleString()}m`;
		if (m === 'voice_active') return `${Number(r.voice_minutes_active || 0).toLocaleString()}m`;
		if (m === 'voice_afk') return `${Number(r.voice_minutes_afk || 0).toLocaleString()}m`;
		return Number(r.experience || 0).toLocaleString();
	}

	function metricValueNumber(r: any, m: string) {
		if (m === 'chat') return Number(r.chat_total || 0);
		if (m === 'voice_total') return Number(r.voice_minutes_total || 0);
		if (m === 'voice_active') return Number(r.voice_minutes_active || 0);
		if (m === 'voice_afk') return Number(r.voice_minutes_afk || 0);
		return Number(r.experience || 0);
	}

	function rangeLabel(r: string) {
		if (r === '1d') return '24h';
		if (r === '7d') return '7d';
		if (r === '30d') return '30d';
		return 'All';
	}

	function animateToCurrentValues(fromZero = false) {
		if (raf) cancelAnimationFrame(raf);
		const duration = 900;
		const start = performance.now();
		const targets: Record<string, number> = {};
		for (const r of rows as any[]) targets[r.discord_member_id] = metricValueNumber(r, metric);
		const initial: Record<string, number> = {};
		for (const [id, target] of Object.entries(targets)) initial[id] = fromZero ? 0 : (anim[id] ?? 0);

		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			// easeOutCubic
			const e = 1 - Math.pow(1 - t, 3);
			const next: Record<string, number> = {};
			for (const [id, target] of Object.entries(targets)) {
				const a = initial[id] ?? 0;
				next[id] = a + (target - a) * e;
			}
			anim = next;
			if (t < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
	}

	function metricValueAnimated(r: any, m: string) {
		const n = anim[r.discord_member_id] ?? metricValueNumber(r, m);
		if (m === 'chat') return Math.round(n).toLocaleString();
		if (m.startsWith('voice_')) return `${Math.round(n).toLocaleString()}m`;
		return Math.round(n).toLocaleString();
	}

	function connect() {
		es?.close();
		es = new EventSource(`/api/leaderboards/${data.server.slug}/stream?metric=${metric}&range=${range}&limit=${data.limit}`);
		es.onmessage = (e) => {
			try {
				const snap = JSON.parse(e.data);
				if (snap?.rows) {
					rows = snap.rows;
					animateToCurrentValues(false);
				}
			} catch (_) {}
		};
	}

	onMount(() => {
		connect();
		animateToCurrentValues(true);
	});

	onDestroy(() => {
		es?.close();
		if (raf) cancelAnimationFrame(raf);
	});

	function setMetric(m: Metric) {
		metric = m;
		connect();
		animateToCurrentValues(true);
	}

	function setRange(r: Range) {
		range = r;
		connect();
		animateToCurrentValues(true);
	}
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} Leaderboard</title>
	<meta name="description" content="Top members leaderboard for {data.server.name || data.server.slug}." />
</svelte:head>

<div class="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6">
	<div class="mb-4 flex items-center gap-3">
		<div class="bg-ash-700 h-12 w-12 overflow-hidden rounded-xl">
			{#if data.server.server_icon}
				<img src={data.server.server_icon} alt={data.server.name} class="h-full w-full object-cover" />
			{/if}
		</div>
		<div class="min-w-0">
			<h1 class="text-ash-100 truncate text-lg font-bold sm:text-xl">{data.server.name || data.server.slug}</h1>
			<p class="text-ash-400 text-xs sm:text-sm">Leaderboard • {metricLabel(metric)}</p>
		</div>
	</div>

	<div class="bg-ash-800 border-ash-700 mb-4 rounded-xl border p-2">
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
			<button
				class="rounded-lg px-3 py-2 text-xs sm:text-sm {metric === 'xp' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}"
				onclick={() => setMetric('xp')}
			>
				XP
			</button>
			<button
				class="rounded-lg px-3 py-2 text-xs sm:text-sm {metric === 'chat' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}"
				onclick={() => setMetric('chat')}
			>
				Chat
			</button>
			<button
				class="rounded-lg px-3 py-2 text-xs sm:text-sm {metric === 'voice_total' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}"
				onclick={() => setMetric('voice_total')}
			>
				Voice
			</button>
			<button
				class="rounded-lg px-3 py-2 text-xs sm:text-sm {metric === 'voice_active' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}"
				onclick={() => setMetric('voice_active')}
			>
				Active
			</button>
			<button
				class="rounded-lg px-3 py-2 text-xs sm:text-sm {metric === 'voice_afk' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}"
				onclick={() => setMetric('voice_afk')}
			>
				AFK
			</button>
		</div>
	</div>

	<div class="bg-ash-800 border-ash-700 mb-4 rounded-xl border p-2">
		<div class="grid grid-cols-4 gap-2">
			<button class="rounded-lg px-3 py-2 text-xs {range === 'all' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}" onclick={() => setRange('all')}>
				{rangeLabel('all')}
			</button>
			<button class="rounded-lg px-3 py-2 text-xs {range === '1d' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}" onclick={() => setRange('1d')}>
				{rangeLabel('1d')}
			</button>
			<button class="rounded-lg px-3 py-2 text-xs {range === '7d' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}" onclick={() => setRange('7d')}>
				{rangeLabel('7d')}
			</button>
			<button class="rounded-lg px-3 py-2 text-xs {range === '30d' ? 'bg-ash-600 text-ash-100' : 'bg-ash-900 text-ash-300'}" onclick={() => setRange('30d')}>
				{rangeLabel('30d')}
			</button>
		</div>
	</div>

	<div class="mb-4 grid grid-cols-3 gap-3">
		{#each top3 as r, idx (r.discord_member_id)}
			<div class="bg-ash-800 border-ash-700 rounded-xl border p-3 text-center">
				<div class="bg-ash-700 mx-auto mb-2 h-14 w-14 overflow-hidden rounded-full">
					{#if r.avatar}
						<img src={r.avatar} alt={displayName(r)} class="h-full w-full object-cover" />
					{/if}
				</div>
				<div class="text-ash-400 text-[10px] tracking-wide uppercase">#{idx + 1}</div>
				<div class="text-ash-100 truncate text-sm font-semibold" title={displayName(r)}>{displayName(r)}</div>
				<div class="mt-1 text-xs">
					<span class="text-ash-300 font-semibold tabular-nums">{metricValueAnimated(r, metric)}</span>
					{#if metric === 'xp'}
						<span class="text-ash-500"> • L{r.level ?? 1}</span>
					{/if}
				</div>
				<div class="bg-ash-700 mt-2 h-1.5 w-full overflow-hidden rounded-full">
					<div
						class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width] duration-300"
						style="width: {Math.max(6, Math.round((metricValueNumber(r, metric) / maxValue) * 100))}%"
					></div>
				</div>
			</div>
		{/each}
	</div>

	<div class="bg-ash-800 border-ash-700 rounded-xl border">
		<div class="border-ash-700 flex items-center justify-between border-b px-4 py-3">
			<h2 class="text-ash-100 text-sm font-semibold">Rankings</h2>
			<span class="text-ash-400 text-xs">{rows.length.toLocaleString()} members</span>
		</div>

		<div class="divide-ash-700 divide-y">
			{#each rest as r, i (r.discord_member_id)}
				<div class="flex items-center gap-3 px-4 py-3">
					<div class="text-ash-500 w-8 text-xs font-semibold">#{i + 4}</div>
					<div class="bg-ash-700 h-9 w-9 overflow-hidden rounded-full">
						{#if r.avatar}
							<img src={r.avatar} alt={displayName(r)} class="h-full w-full object-cover" />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="text-ash-100 truncate text-sm font-medium" title={displayName(r)}>{displayName(r)}</div>
						{#if metric === 'xp'}
							<div class="text-ash-500 text-xs">Level {r.level ?? 1}</div>
						{/if}
						<div class="bg-ash-700 mt-2 h-1.5 w-full overflow-hidden rounded-full">
							<div
								class="bg-ash-500/70 h-full rounded-full transition-[width] duration-300"
								style="width: {Math.max(3, Math.round((metricValueNumber(r, metric) / maxValue) * 100))}%"
							></div>
						</div>
					</div>
					<div class="text-ash-100 text-sm font-semibold tabular-nums">{metricValueAnimated(r, metric)}</div>
				</div>
			{/each}
		</div>
	</div>
</div>
