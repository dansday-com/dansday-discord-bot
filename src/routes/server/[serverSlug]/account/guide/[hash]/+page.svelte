<script lang="ts">
	import { getContext } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import {
		BASICS as basics,
		EARN_METHODS as earnMethods,
		FEATURES as features,
		FRIEND_BOOST as friendBoost,
		GUIDE_SECTIONS,
		GUIDE_SUBTITLE,
		GUIDE_TITLE,
		TIPS as tips,
		buildGuideItems
	} from '$lib/guide.js';
	import { AccentCard, Callout, DocHero, DocSection, StepGrid } from '$lib/frontend/components/shell';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;

	const guideItems = $derived.by(() => buildGuideItems((data.items ?? []) as any[]));

	function fmtCost(n: number | null): string {
		if (n == null) return '';
		return (ctx?.fmt ? ctx.fmt(n) : Number(n).toLocaleString()) + ' XP';
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Guide | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet cardGrid(cards: any[])}
	<div class="flex flex-wrap gap-3">
		{#each cards as c}
			<AccentCard icon={c.icon} accent={c.accent} title={c.title} text={c.desc} />
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-10 pt-2 pb-12">
	<DocHero icon="fa-book-open" title={GUIDE_TITLE} lead={GUIDE_SUBTITLE} />

	<DocSection icon={GUIDE_SECTIONS.earn.icon} heading={GUIDE_SECTIONS.earn.heading} lead={GUIDE_SECTIONS.earn.lead}>
		{@render cardGrid(earnMethods)}
		<Callout icon={friendBoost.icon} accent={friendBoost.accent} title={friendBoost.title} text={friendBoost.text} />
	</DocSection>

	<DocSection icon={GUIDE_SECTIONS.basics.icon} heading={GUIDE_SECTIONS.basics.heading} lead={GUIDE_SECTIONS.basics.lead}>
		{@render cardGrid(basics)}
	</DocSection>

	{#each features as f}
		<DocSection icon="fas {f.icon}" heading={f.title} lead={f.lead}>
			<StepGrid steps={f.steps} />
			{#if f.cards.length}
				<div class="mt-3">{@render cardGrid(f.cards)}</div>
			{/if}
			<Callout icon={f.note.icon} accent={f.note.accent} title={f.note.title} text={f.note.text} />

			{#if f.id === 'items'}
				<h3 class="text-base-content mt-5.5 mb-1 text-sm font-extrabold">{GUIDE_SECTIONS.items.subHeading}</h3>
				<div class="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3.5">
					{#each guideItems as it}
						<article
							class="border-base-300 bg-base-100 relative isolate overflow-hidden rounded-[18px] border border-t-[3px] p-4 shadow-sm {it.available
								? ''
								: 'opacity-70'}"
							style="--ac: {it.accent}; border-top-color: var(--ac);"
						>
							<div
								class="pointer-events-none absolute -top-[40%] -right-[30%] h-[120%] w-[60%]"
								style="background: radial-gradient(circle, color-mix(in srgb, var(--ac) 22%, transparent), transparent 70%);"
							></div>

							<div class="relative mb-2.5 flex items-center gap-3">
								<span
									class="grid size-11 shrink-0 place-items-center rounded-[13px] border text-[22px]"
									style="background: color-mix(in srgb, var(--ac) 16%, transparent); border-color: color-mix(in srgb, var(--ac) 32%, transparent);"
								>
									{it.emoji}
								</span>
								<div class="min-w-0">
									<h3 class="text-base-content text-[15px] font-extrabold">{it.label}</h3>
									{#if it.available && it.cost != null}
										<span class="mt-0.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-(--ac)">
											<i class="fas fa-coins"></i>{fmtCost(it.cost)}
										</span>
									{:else}
										<span class="text-base-content/40 mt-0.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold">
											{GUIDE_SECTIONS.items.notInShop}
										</span>
									{/if}
								</div>
							</div>

							{#if it.guide}
								<p class="text-base-content relative mb-2.5 text-[13px] leading-relaxed">{it.guide.what}</p>
								<div class="text-base-content/60 relative mb-2 flex gap-2 text-xs leading-relaxed">
									<i class="fas fa-circle-play mt-0.5 shrink-0"></i><span>{it.guide.how}</span>
								</div>
								<div class="text-base-content/60 relative flex gap-2 text-xs leading-relaxed">
									<i class="fas fa-lightbulb mt-0.5 shrink-0"></i><span>{it.guide.tip}</span>
								</div>
							{:else}
								<p class="text-base-content relative text-[13px] leading-relaxed">{it.summary}</p>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</DocSection>
	{/each}

	<DocSection icon={GUIDE_SECTIONS.tips.icon} heading={GUIDE_SECTIONS.tips.heading}>
		<div class="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3">
			{#each tips as t}
				<AccentCard icon={t.icon} accent={t.accent} text={t.text} size="tip" />
			{/each}
		</div>
	</DocSection>
</div>
