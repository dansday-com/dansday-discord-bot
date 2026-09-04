<script lang="ts">
	import { APP_DOMAIN, APP_URL } from '$lib/frontend/panelServer.js';
	import { legalNav } from '$lib/legal.js';
	type Palette = 'light' | 'dark';

	let { palette = 'light' as Palette }: { palette?: Palette } = $props();
</script>

<footer class="relative z-1 shrink-0 border-t {palette === 'dark' ? 'border-ash-700 bg-ash-900/50' : 'border-base-300 bg-base-200/50'}">
	<div class="mx-auto flex max-w-7xl flex-col items-center gap-2.5 px-3 py-5 text-center">
		<p class="text-base-content/45 text-xs">
			Copyright © {new Date().getFullYear()}
			<a class="link link-hover" href={APP_URL}>{APP_DOMAIN}</a>. All rights reserved.
		</p>
		<p class="text-base-content/45 text-xs">
			{#each legalNav as link, i (link.href)}
				{#if i > 0}
					<span class="mx-1.5 opacity-45" aria-hidden="true">·</span>
				{/if}
				<a class="link link-hover" href={link.href}>{link.label}</a>
			{/each}
		</p>
		<p class="text-base-content/45 text-xs leading-relaxed">
			Free and open source on
			<a class="link link-hover" href="https://github.com/dansday-com/dansday-discord-bot">GitHub</a>.
		</p>
	</div>
</footer>
