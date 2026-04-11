<script lang="ts">
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		heading,
		intro,
		children
	}: {
		title: string;
		description: string;
		heading: string;
		intro?: string;
		children: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
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
					<h2>{heading}</h2>
					{#if intro}
						<p>{intro}</p>
					{/if}
				</div>
				<div class="m-legal-doc m-legal-doc--card">
					<p class="m-legal-doc-nav">
						<a href="/privacy-policy">Privacy Policy</a>
						<span class="m-legal-doc-nav-sep" aria-hidden="true">·</span>
						<a href="/terms-of-service">Terms of Service</a>
					</p>
					{@render children()}
				</div>
			</section>
		</div>
	</main>

	<MainFooter />
</div>
