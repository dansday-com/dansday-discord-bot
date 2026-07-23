<script lang="ts">
	import { APP_DOMAIN, APP_URL } from '$lib/frontend/panelServer.js';
	type Palette = 'light' | 'dark';

	let { palette = 'light' as Palette }: { palette?: Palette } = $props();

	const copy = $derived(palette === 'dark' ? 'text-ash-400' : 'text-lb-text-soft');
	const copyLink = $derived(palette === 'dark' ? 'text-ash-400 hover:text-ash-200' : 'text-lb-text-muted hover:text-lb-text');
	const open = $derived(palette === 'dark' ? 'text-ash-500' : 'text-lb-text-muted');
	const openLink = $derived(palette === 'dark' ? 'text-ash-400 hover:text-ash-200' : 'text-lb-text-muted hover:text-chili-hot');
</script>

<footer class="m-footer relative z-1 shrink-0" class:m-footer--dark={palette === 'dark'}>
	<div class="m-footer-inner pr-8 pl-8">
		<p class="m-0 text-xs leading-normal lg:text-base {copy}">
			Copyright © {new Date().getFullYear()}
			<a class="no-underline transition-colors {copyLink}" href={APP_URL}>{APP_DOMAIN}</a>. All rights reserved.
		</p>
		<p class="m-0 text-xs leading-normal lg:text-base {open}">
			Free and open source on
			<a class="font-semibold no-underline transition-colors {openLink}" href="https://github.com/dansday/dansday-discord-bot">GitHub</a>.
		</p>
	</div>
</footer>
