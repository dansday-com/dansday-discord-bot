<script lang="ts">
	import { BRAND_TAGLINE } from '$lib/brand.js';
	import { APP_NAME, APP_NAME_PLAIN } from '$lib/frontend/panelServer.js';
	import { publicSiteOrigin } from '$lib/url.js';
	import { ldJson, siteNodes, webPageNode, type LdNode } from '$lib/structuredData.js';

	let { title, description, path, jsonLd = [] }: { title: string; description: string; path: string; jsonLd?: LdNode[] } = $props();

	const url = $derived(publicSiteOrigin() + path);
	const image = `${publicSiteOrigin()}/og.png?v=3`;
	const graph = $derived(ldJson([...siteNodes(), webPageNode(url, title, description), ...jsonLd]));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={APP_NAME_PLAIN} />
	<meta property="og:url" content={url} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="{APP_NAME} — {BRAND_TAGLINE}. Free, open-source Discord bot" />
	<meta name="twitter:card" content="summary_large_image" />
	{@html `<script type="application/ld+json">${graph}<\/script>`}
</svelte:head>
