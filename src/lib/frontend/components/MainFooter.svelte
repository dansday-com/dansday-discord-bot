<script lang="ts">
	/**
	 * `landing`: light marketing footer (`m-footer` styles).
	 * `panel`: ash app shell (login, panel, etc.) — same content: copyright + GitHub line.
	 */
	type Variant = 'landing' | 'panel';

	let { variant = 'landing' as Variant }: { variant?: Variant } = $props();
</script>

<footer class={variant === 'landing' ? 'm-footer' : 'bg-ash-800 border-ash-700 flex-shrink-0 border-t'}>
	<div class={variant === 'landing' ? 'm-footer-inner' : 'mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-8'}>
		<p class={variant === 'landing' ? 'm-footer-copy' : 'text-ash-500 m-0 text-center text-xs sm:text-sm'}>
			Copyright &copy; {new Date().getFullYear()}
			<a
				href="https://dansday.com"
				target="_blank"
				rel="noopener noreferrer"
				class={variant === 'panel' ? 'text-ash-200 hover:text-ash-300 transition-colors' : undefined}>dansday.com</a
			>. All rights reserved.
		</p>
		{#if variant === 'landing'}
			<p class="m-footer-open">
				<a href="https://github.com/dansday-com/dansday-discord-bot" target="_blank" rel="noopener noreferrer"> Free and open source on GitHub </a>
			</p>
		{:else}
			<p class="text-ash-500 mt-3 text-center text-xs sm:mt-4 sm:text-sm">
				<a
					href="https://github.com/dansday-com/dansday-discord-bot"
					target="_blank"
					rel="noopener noreferrer"
					class="text-ash-300 hover:text-ash-100 font-semibold transition-colors"
				>
					Free and open source on GitHub
				</a>
			</p>
		{/if}
	</div>
</footer>
