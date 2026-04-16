<script lang="ts">
	type Palette = 'light' | 'dark';
	type Trailing = 'login' | 'live' | 'home';

	let { palette = 'light' as Palette, trailing = 'login' as Trailing }: { palette?: Palette; trailing?: Trailing } = $props();

	const shell = $derived(
		palette === 'light'
			? 'border-[rgba(187,189,188,0.55)] bg-[rgba(242,240,239,0.92)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]'
			: 'border-ash-700 bg-ash-800'
	);

	const brandText = $derived(palette === 'light' ? 'text-[#1a343f]' : 'text-ash-100');
	const iconWrap = $derived(
		palette === 'light' ? 'bg-gradient-to-br from-[#733e24] to-[#245f73] text-white shadow-[0_2px_12px_rgba(26,52,63,0.07)]' : 'bg-ash-400 text-ash-100'
	);
</script>

<header class="sticky top-0 z-40 flex-shrink-0 border-b {shell}">
	<div class="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-4 lg:px-8">
		<a href="/" class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 {brandText} no-underline">
			<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm sm:h-10 sm:w-10 sm:text-base {iconWrap}">
				<i class="fas fa-bolt"></i>
			</div>
			<span class="truncate text-base font-bold sm:text-xl">&lt;/DANSDAY&gt; Discord Bot</span>
		</a>
		<div class="flex flex-shrink-0 items-center gap-2 sm:gap-2.5">
			{#if trailing === 'login'}
				<a href="/login" class="m-btn m-btn--primary">
					<i class="fas fa-sign-in-alt"></i>
					Log in
				</a>
			{:else if trailing === 'live'}
				<span class="m-nav-live">
					<span class="m-nav-live-dot"></span>
					Live
				</span>
			{:else}
				<a
					href="/"
					class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:py-2 sm:text-sm {palette ===
					'light'
						? 'border-[rgba(187,189,188,0.55)] bg-[#e8e6e3] text-[#1a343f] hover:bg-[#dedcd8]'
						: 'border-ash-600 bg-ash-800/80 text-ash-200 hover:border-ash-500 hover:bg-ash-700 hover:text-ash-100'}"
				>
					<i class="fas fa-house"></i>
					Home
				</a>
			{/if}
		</div>
	</div>
</header>
