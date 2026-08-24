<script lang="ts">
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import { legalNav, type LegalDoc } from '$lib/legal.js';

	let { doc }: { doc: LegalDoc } = $props();
</script>

<svelte:head>
	<title>{doc.title}</title>
	<meta name="description" content={doc.description} />
	<meta name="theme-color" content="#245f73" />
</svelte:head>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader />

	<main class="m-main">
		<div class="m-inner m-landing-inner">
			<section class="m-section">
				<div class="m-section-header">
					<h2>{doc.heading}</h2>
					<p>{doc.intro}</p>
				</div>
				<div class="m-legal-doc m-legal-doc--card">
					<p class="m-legal-doc-nav">
						{#each legalNav as link, i (link.href)}
							{#if i > 0}
								<span class="m-legal-doc-nav-sep" aria-hidden="true">·</span>
							{/if}
							<a href={link.href}>{link.label}</a>
						{/each}
					</p>

					<p class="m-legal-meta">Last updated: {doc.lastUpdated}</p>

					{#each doc.sections as section (section.id)}
						<h3 id={section.id}>{section.heading}</h3>
						{#each section.blocks as block}
							{#if block.kind === 'text'}
								<p>{block.text}</p>
							{:else if block.kind === 'list'}
								<ul>
									{#each block.items as item}
										<li>{item}</li>
									{/each}
								</ul>
							{:else if block.kind === 'defs'}
								<ul>
									{#each block.items as item}
										<li><strong>{item.term}</strong> — {item.desc}</li>
									{/each}
								</ul>
							{:else if block.kind === 'links'}
								<p>
									{block.text}{#each block.links as link, i}{#if i > 0}{i === block.links.length - 1
												? block.links.length === 2
													? ' and '
													: ', and '
												: ', '}{/if}<a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a
										>{/each}.{#if block.tail}&nbsp;{block.tail}{/if}
								</p>
							{/if}
						{/each}
					{/each}
				</div>
			</section>
		</div>
	</main>

	<MainFooter />
</div>
