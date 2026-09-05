<script lang="ts">
	import { legalNav, type LegalDoc } from '$lib/legal.js';
	import { PageShell } from '$lib/frontend/components/shell';

	let { doc }: { doc: LegalDoc } = $props();
</script>

<svelte:head>
	<title>{doc.title}</title>
	<meta name="description" content={doc.description} />
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell width="flush">
	<section class="py-9 sm:py-11 lg:py-14">
		<div class="mb-6 text-center sm:mb-7">
			<h2 class="text-base-content text-[22px] font-extrabold tracking-tight sm:text-[26px]">{doc.heading}</h2>
			<p class="text-base-content/60 mx-auto mt-2 max-w-2xl text-sm leading-relaxed">{doc.intro}</p>
		</div>

		<div class="border-base-300 from-primary/6 to-secondary/4 mx-auto max-w-2xl rounded-[20px] border bg-linear-to-br px-5 pt-5.5 pb-7 text-left shadow-sm">
			<p class="text-base-content/60 mb-5 text-center text-[13px]">
				{#each legalNav as link, i (link.href)}
					{#if i > 0}
						<span class="text-base-content/40 mx-1.5" aria-hidden="true">·</span>
					{/if}
					<a class="text-primary font-semibold hover:underline" href={link.href}>{link.label}</a>
				{/each}
			</p>

			<p class="text-base-content/45 mb-4 text-[13px]">Last updated: {doc.lastUpdated}</p>

			{#each doc.sections as section, si (section.id)}
				<h3 id={section.id} class="text-base-content mb-1.5 text-[15px] font-bold tracking-tight {si === 0 ? '' : 'mt-5.5'}">
					{section.heading}
				</h3>
				{#each section.blocks as block}
					{#if block.kind === 'text'}
						<p class="text-base-content/60 mb-3 text-sm leading-relaxed">{block.text}</p>
					{:else if block.kind === 'list'}
						<ul class="text-base-content/60 mt-1.5 mb-3.5 list-disc pl-5 text-sm leading-relaxed">
							{#each block.items as item}
								<li class="mb-1.5">{item}</li>
							{/each}
						</ul>
					{:else if block.kind === 'defs'}
						<ul class="text-base-content/60 mt-1.5 mb-3.5 list-disc pl-5 text-sm leading-relaxed">
							{#each block.items as item}
								<li class="mb-1.5"><strong class="text-base-content font-semibold">{item.term}</strong> — {item.desc}</li>
							{/each}
						</ul>
					{:else if block.kind === 'links'}
						<p class="text-base-content/60 mb-3 text-sm leading-relaxed">
							{block.text}{#each block.links as link, i}{#if i > 0}{i === block.links.length - 1
										? block.links.length === 2
											? ' and '
											: ', and '
										: ', '}{/if}<a class="text-primary font-semibold hover:underline" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a
								>{/each}.{#if block.tail}&nbsp;{block.tail}{/if}
						</p>
					{/if}
				{/each}
			{/each}
		</div>
	</section>
</PageShell>
