<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const stats = $derived(
		data.stats ?? {
			total_bots: 0,
			running_bots: 0,
			stopped_bots: 0,
			total_servers: 0,
			total_selfbots: 0,
			running_selfbots: 0,
			stopped_selfbots: 0,
			total_uptime_ms: 0
		}
	);

	function fmt(val: number | null | undefined): string {
		if (val == null) return '0';
		return val.toLocaleString();
	}

	function formatUptime(ms: number): string {
		if (!ms || ms <= 0) return '0s';
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const d = Math.floor(h / 24);
		if (d > 0) return `${d}d ${h % 24}h`;
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	}

	const avgUptimeMs = $derived(
		stats.running_bots + stats.running_selfbots > 0 ? Math.floor(stats.total_uptime_ms / (stats.running_bots + stats.running_selfbots)) : 0
	);
</script>

<svelte:head>
	<title>Overview | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="mb-4">
	<h2 class="text-ash-100 mb-1 text-xl font-bold sm:text-2xl">
		<i class="fas fa-chart-pie mr-2 text-sky-400"></i>Panel Overview
	</h2>
	<p class="text-ash-400 text-xs sm:text-sm">High-level statistics across all your bots and servers.</p>
</div>

<div class="space-y-4 sm:space-y-6">
	<div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
					<i class="fas fa-robot text-lg text-violet-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Official Bots</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-layer-group', label: 'Total Bots', value: fmt(stats.total_bots) }, { icon: 'fa-play', label: 'Running', value: fmt(stats.running_bots) }, { icon: 'fa-stop', label: 'Stopped', value: fmt(stats.stopped_bots) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-sm">
							<i class="fas {row.icon} text-xs text-violet-400/90"></i>{row.label}
						</span>
						<span class="text-ash-100 text-lg font-bold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
					<i class="fas fa-server text-lg text-emerald-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Servers & Selfbots</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-globe', label: 'Total Servers', value: fmt(stats.total_servers) }, { icon: 'fa-user-ninja', label: 'Total Selfbots', value: fmt(stats.total_selfbots) }, { icon: 'fa-play-circle', label: 'Active Selfbots', value: fmt(stats.running_selfbots) }, { icon: 'fa-pause-circle', label: 'Inactive Selfbots', value: fmt(stats.stopped_selfbots) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-sm">
							<i class="fas {row.icon} text-xs text-emerald-400/90"></i>{row.label}
						</span>
						<span class="text-ash-100 text-lg font-bold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
					<i class="fas fa-clock text-lg text-amber-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Uptime Performance</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-tachometer-alt', label: 'Total Uptime', value: formatUptime(stats.total_uptime_ms) }, { icon: 'fa-balance-scale', label: 'Average Uptime', value: formatUptime(avgUptimeMs) }, { icon: 'fa-network-wired', label: 'Total Running', value: fmt(stats.running_bots + stats.running_selfbots) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-sm">
							<i class="fas {row.icon} text-xs text-amber-400/90"></i>{row.label}
						</span>
						<span class="text-ash-100 text-lg font-bold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
