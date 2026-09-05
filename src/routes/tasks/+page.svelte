<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';

	let { data }: PageProps = $props();

	let query = $state('');
	let module = $state('all');

	const modules = $derived.by(() => {
		const seen = new Map<string, { key: string; label: string; count: number }>();
		for (const task of data.tasks) {
			const row = seen.get(task.requires) ?? { key: task.requires, label: task.requires_label, count: 0 };
			row.count++;
			seen.set(task.requires, row);
		}
		return [...seen.values()];
	});

	const filtered = $derived(
		data.tasks.filter((task) => {
			if (module !== 'all' && task.requires !== module) return false;
			const needle = query.trim().toLowerCase();
			if (!needle) return true;
			return `${task.label} ${task.example} ${task.unit}`.toLowerCase().includes(needle);
		})
	);
</script>

<svelte:head>
	<title>Task directory | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Every daily and weekly task {APP_NAME} Bot can hand out, with what each one asks for and the module it needs. {data.tasks
			.length} tasks in the pool."
	/>
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell trailing="home">
	<div class="@container">
		<section class="pb-8">
			<p class="text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">Directory</p>
			<h1 class="text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase">Tasks</h1>
			<p class="text-base-content/60 text-[13.5px] leading-[1.55] sm:max-w-[54ch]">
				All {data.tasks.length} tasks that can come out on a daily or weekly card. Goals scale to each member, so the numbers below are examples.
			</p>
		</section>

		{#if data.tasks.length > 0}
			<section class="border-base-300 border-t py-8">
				<div class="mb-5 flex flex-wrap items-center gap-2.5">
					<label class="input input-sm border-base-300 bg-base-100 w-full rounded-sm sm:max-w-xs">
						<i class="fas fa-magnifying-glass text-base-content/40 text-[12px]"></i>
						<input type="search" bind:value={query} placeholder="Filter tasks" aria-label="Filter tasks" />
					</label>
					<button
						type="button"
						class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {module === 'all'
							? 'btn-primary'
							: 'btn-outline btn-primary'}"
						onclick={() => (module = 'all')}
						aria-pressed={module === 'all'}
					>
						All {data.tasks.length}
					</button>
					{#each modules as entry (entry.key)}
						<button
							type="button"
							class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {module === entry.key
								? 'btn-primary'
								: 'btn-outline btn-primary'}"
							onclick={() => (module = entry.key)}
							aria-pressed={module === entry.key}
						>
							{entry.label}
							{entry.count}
						</button>
					{/each}
				</div>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each filtered as task, i (task.id)}
						<article
							use:reveal
							class="{REVEAL_CLASS} border-base-300 bg-base-100 flex flex-col rounded-sm border p-4"
							style="transition-delay: {Math.min(i, 8) * 60}ms"
						>
							<div class="mb-2.5 flex items-start gap-3">
								<span class="bg-base-200 grid size-8 shrink-0 place-items-center rounded-sm text-[13px] leading-none" style="color: {task.accent}">
									<i class="fas {task.icon}"></i>
								</span>
								<div class="min-w-0 flex-1">
									<h2 class="text-base-content text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">{task.label}</h2>
									<p class="text-base-content/45 mt-1 text-[10px] font-bold tracking-[0.14em] uppercase">{task.requires_label}</p>
								</div>
							</div>
							<p class="text-base-content/70 text-[12.5px] leading-[1.5]">{task.example}</p>
							<div class="border-base-300 mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-[11px]">
								<span class="text-base-content/45">Counts {task.unit}</span>
								{#if task.success_chance !== null}
									<span class="text-base-content/45">{task.success_chance}% success</span>
								{/if}
								{#if task.targets_item}
									<span class="text-primary ml-auto font-extrabold tracking-[0.12em] uppercase">Named item</span>
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
				<p class="text-base-content/45 text-[12.5px]">No tasks are defined yet.</p>
			</section>
		{/if}
	</div>
</PageShell>
