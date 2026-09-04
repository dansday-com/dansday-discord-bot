<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
	const when = (v: string | null) => (v ? dateFmt.format(new Date(v)) : '');

	let query = $state('');
	let liveOnly = $state(false);
	let broken = $state<Record<string, boolean>>({});

	const filtered = $derived(
		data.quests.filter((q) => {
			if (liveOnly && !q.live) return false;
			const needle = query.trim().toLowerCase();
			if (!needle) return true;
			return `${q.quest_name} ${q.game_title} ${q.reward ?? ''}`.toLowerCase().includes(needle);
		})
	);
	const liveCount = $derived(data.quests.filter((q) => q.live).length);
</script>

<svelte:head>
	<title>Discord Quest directory | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Every Discord Quest {APP_NAME} Bot has tracked, with the game, the task, the reward and when it runs. Filter to the quests live right now."
	/>
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell trailing="home">
	<div class="@container">
		<section class="pb-8">
			<p class="text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">Directory</p>
			<h1 class="text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase">Discord Quests</h1>
			<p class="text-base-content/60 text-[13.5px] leading-[1.55] sm:max-w-[54ch]">
				Every quest the bot has tracked, with the game, the task and the reward. {liveCount} of {data.quests.length} are live right now.
			</p>
		</section>

		{#if data.quests.length > 0}
			<section class="border-base-300 border-t py-8">
				<div class="mb-5 flex flex-wrap items-center gap-2.5">
					<label class="input input-sm border-base-300 bg-base-100 w-full rounded-sm sm:max-w-xs">
						<i class="fas fa-magnifying-glass text-base-content/40 text-[12px]"></i>
						<input type="search" bind:value={query} placeholder="Filter quests" aria-label="Filter quests" />
					</label>
					<button
						type="button"
						class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {liveOnly ? 'btn-primary' : 'btn-outline btn-primary'}"
						onclick={() => (liveOnly = !liveOnly)}
						aria-pressed={liveOnly}
					>
						<span class="size-1.5 rounded-full bg-current motion-safe:animate-pulse"></span>
						Live only
					</button>
				</div>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each filtered as quest, i (quest.quest_id)}
						<article
							use:reveal
							class="{REVEAL_CLASS} border-base-300 bg-base-100 flex flex-col overflow-hidden rounded-sm border"
							style="transition-delay: {Math.min(i, 8) * 60}ms"
						>
							{#if (quest.banner_url || quest.thumbnail_url) && !broken[quest.quest_id]}
								<img
									src={quest.banner_url || quest.thumbnail_url}
									alt={quest.quest_name}
									loading="lazy"
									class="bg-base-200 aspect-[16/7] w-full object-cover"
									onerror={() => (broken[quest.quest_id] = true)}
								/>
							{/if}
							<div class="flex flex-1 flex-col p-4">
								<div class="mb-2 flex items-start justify-between gap-2">
									<p class="text-base-content/45 text-[10px] font-bold tracking-[0.14em] uppercase">{quest.game_title}</p>
									{#if quest.live}
										<span class="text-primary flex shrink-0 items-center gap-1.5 text-[10px] font-extrabold tracking-[0.12em] uppercase">
											<span class="bg-primary size-1.5 rounded-full motion-safe:animate-pulse"></span>
											Live
										</span>
									{:else}
										<span class="text-base-content/35 shrink-0 text-[10px] font-bold tracking-[0.12em] uppercase">Ended</span>
									{/if}
								</div>
								<h2 class="text-base-content mb-1.5 text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">{quest.quest_name}</h2>
								{#if quest.quest_task_label}
									<p class="text-base-content/70 text-[12.5px] leading-[1.5]">{quest.quest_task_label}</p>
								{/if}
								{#if quest.reward}
									<p class="text-primary mt-2 text-[12.5px] font-bold">{quest.reward}</p>
								{/if}
								<div class="border-base-300 mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-[11px]">
									{#if quest.expires_at}
										<span class="text-base-content/45">{quest.live ? 'Ends' : 'Ended'} {when(quest.expires_at)}</span>
									{/if}
									{#if quest.quest_url}
										<a
											href={quest.quest_url}
											target="_blank"
											rel="noopener noreferrer"
											class="text-primary hover:text-accent ml-auto font-extrabold tracking-[0.12em] uppercase underline underline-offset-4"
										>
											Open
										</a>
									{/if}
								</div>
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
				<p class="text-base-content/45 text-[12.5px]">No quests have been tracked yet.</p>
			</section>
		{/if}
	</div>
</PageShell>
