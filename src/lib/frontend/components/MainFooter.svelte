<script lang="ts">
	/**
	 * Shared chrome: same layout/spacing everywhere; `palette` only swaps colors.
	 */
	type Palette = 'light' | 'dark';

	let { palette = 'light' as Palette }: { palette?: Palette } = $props();

	const shell = $derived(palette === 'light' ? 'border-[rgba(187,189,188,0.38)] bg-[rgba(232,230,227,0.5)]' : 'border-ash-700 bg-ash-800');

	const copy = $derived(palette === 'light' ? 'text-[var(--lb-text-soft)]' : 'text-ash-400');
	const link = $derived(palette === 'light' ? 'text-[var(--lb-text-muted)] hover:text-[var(--lb-text)]' : 'text-ash-400 hover:text-ash-200');
	const oss = $derived(palette === 'light' ? 'text-[var(--lb-text-muted)]' : 'text-ash-500');
	const ossLink = $derived(palette === 'light' ? 'text-[var(--lb-text-muted)] hover:text-[var(--lb-text)]' : 'text-ash-400 hover:text-ash-200');
</script>

<footer class="flex-shrink-0 border-t {shell}">
	<div class="mx-auto max-w-7xl px-3 py-5 text-center sm:px-4 sm:py-5 lg:px-8">
		<p class="m-0 text-sm {copy}">
			© {new Date().getFullYear()}
			<a href="https://dansday.com" class={link}>Dansday</a>. All rights reserved.
		</p>
		<p class="m-0 mt-3 text-sm sm:mt-4 {oss}">
			Free and open source on
			<a href="https://github.com/dansday/dansday-discord-bot" class={ossLink}>GitHub</a>.
		</p>
	</div>
</footer>
