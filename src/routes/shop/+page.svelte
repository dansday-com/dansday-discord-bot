<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';
	import { effectLabel, effectIcon, effectAccentHex, effectSummary, effectMeta, itemAvailability } from '$lib/items.js';
	import type { ItemEntry } from '$lib/frontend/public/catalog/index.js';

	let { data }: PageProps = $props();

	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));

	let now = $state(Date.now());
	let tz = $state(0);

	$effect(() => {
		tz = -new Date().getTimezoneOffset();
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});

	let query = $state('');
	let mode = $state<'all' | 'buy' | 'nobuy'>('all');

	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const STATE_LABEL: Record<string, string> = { active: 'In window', upcoming: 'Upcoming', ended: 'Ended', always: 'Always on' };

	const wallClock = (raw: string | null) => (raw ? String(raw).replace('T', ' ').slice(0, 16) : '');

	function windowLabel(item: ItemEntry): string {
		const schedule = item.recurring_schedule;
		if (schedule && Array.isArray(schedule.days) && schedule.days.length) {
			const days =
				schedule.days.length === 7
					? 'Every day'
					: schedule.days
							.map((d: any) => DAY_NAMES[Number(d)] ?? '')
							.filter(Boolean)
							.join(' ');
			return `${days} · ${schedule.from || '00:00'}–${schedule.to || '23:59'}`;
		}
		if (item.available_from && item.available_to) return `${wallClock(item.available_from)} → ${wallClock(item.available_to)}`;
		if (item.available_from) return `From ${wallClock(item.available_from)}`;
		if (item.available_to) return `Until ${wallClock(item.available_to)}`;
		return 'Always';
	}

	function statusLabel(item: ItemEntry): string {
		if (item.buyable) return 'Can buy';
		if (item.usable) return 'Use only';
		return 'Disabled';
	}

	const buyCount = $derived(data.items.filter((item) => item.buyable).length);

	const rows = $derived(data.items.map((item) => ({ item, window: itemAvailability(item, now, tz) })));

	const filtered = $derived(
		rows.filter(({ item }) => {
			if (mode === 'buy' && !item.buyable) return false;
			if (mode === 'nobuy' && item.buyable) return false;
			const needle = query.trim().toLowerCase();
			if (!needle) return true;
			return `${item.name} ${effectLabel(item.effect_type)} ${item.description ?? ''}`.toLowerCase().includes(needle);
		})
	);
</script>

<svelte:head>
	<title>Item directory | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Every item in the {APP_NAME} Bot shop catalog — what each one does, what it costs in XP, when it is on sale, and whether it can be bought right now."
	/>
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell trailing="home">
	<div class="@container">
		<section class="pb-8">
			<p class="text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">Directory</p>
			<h1 class="text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase">Items</h1>
			<p class="text-base-content/60 text-[13.5px] leading-[1.55] sm:max-w-[54ch]">
				The whole shop catalog — all {data.items.length} items, {buyCount} on sale right now and the rest usable but off the shelf. Windows shown in your own local
				time.
			</p>
		</section>

		{#if data.items.length > 0}
			<section class="border-base-300 border-t py-8">
				<div class="mb-5 flex flex-wrap items-center gap-2.5">
					<label class="input input-sm border-base-300 bg-base-100 w-full rounded-sm sm:max-w-xs">
						<i class="fas fa-magnifying-glass text-base-content/40 text-[12px]"></i>
						<input type="search" bind:value={query} placeholder="Filter items" aria-label="Filter items" />
					</label>
					<button
						type="button"
						class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {mode === 'all' ? 'btn-primary' : 'btn-outline btn-primary'}"
						onclick={() => (mode = 'all')}
						aria-pressed={mode === 'all'}
					>
						All {data.items.length}
					</button>
					<button
						type="button"
						class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {mode === 'buy' ? 'btn-primary' : 'btn-outline btn-primary'}"
						onclick={() => (mode = 'buy')}
						aria-pressed={mode === 'buy'}
					>
						Can buy {buyCount}
					</button>
					<button
						type="button"
						class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {mode === 'nobuy'
							? 'btn-primary'
							: 'btn-outline btn-primary'}"
						onclick={() => (mode = 'nobuy')}
						aria-pressed={mode === 'nobuy'}
					>
						Can't buy {data.items.length - buyCount}
					</button>
				</div>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each filtered as row, i (row.item.id)}
						<article
							use:reveal
							class="{REVEAL_CLASS} border-base-300 bg-base-100 flex flex-col rounded-sm border p-4"
							style="transition-delay: {Math.min(i, 8) * 60}ms"
						>
							<div class="mb-2.5 flex items-start gap-3">
								<span
									class="bg-base-200 grid size-8 shrink-0 place-items-center rounded-sm text-[13px] leading-none"
									style="color: {effectAccentHex(row.item.effect_type)}"
								>
									<i class="fas {effectIcon(row.item.effect_type)}"></i>
								</span>
								<div class="min-w-0 flex-1">
									<h2 class="text-base-content text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">{row.item.name}</h2>
									<p class="text-base-content/45 mt-1 text-[10px] font-bold tracking-[0.14em] uppercase">{effectLabel(row.item.effect_type)}</p>
								</div>
								<span class="shrink-0 text-[10px] font-extrabold tracking-[0.12em] uppercase {row.item.buyable ? 'text-primary' : 'text-base-content/35'}">
									{statusLabel(row.item)}
								</span>
							</div>

							<p class="text-base-content/70 text-[12.5px] leading-[1.5]">{effectSummary(row.item)}</p>
							{#if row.item.description}
								<p class="text-base-content/45 mt-1.5 text-[12px] leading-[1.5]">{row.item.description}</p>
							{/if}

							{#if effectMeta(row.item).length > 0}
								<div class="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
									{#each effectMeta(row.item) as chip}
										<span class="text-base-content/55 flex items-center gap-1.5 text-[11px] tabular-nums">
											<i class="fas {chip.icon} text-[10px] opacity-60"></i>
											{chip.label}
										</span>
									{/each}
								</div>
							{/if}

							<div class="border-base-300 mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t pt-3 text-[11px]">
								<span class="text-primary text-[12.5px] font-black tabular-nums">{fmt(row.item.cost)} XP</span>
								<span class="text-base-content/45">{windowLabel(row.item)}</span>
								{#if row.window.state !== 'always'}
									<span class="text-base-content/45 ml-auto font-bold tracking-[0.12em] uppercase">{STATE_LABEL[row.window.state]}</span>
								{/if}
							</div>
						</article>
					{/each}
				</div>

				{#if filtered.length === 0}
					<p class="text-base-content/45 py-8 text-[12.5px]">Nothing matches that filter.</p>
				{/if}
			</section>
		{:else}
			<section class="border-base-300 border-t py-10">
				<p class="text-base-content/45 text-[12.5px]">No items are published yet.</p>
			</section>
		{/if}
	</div>
</PageShell>
