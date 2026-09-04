<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	type Palette = 'light' | 'dark';
	type Trailing = 'login' | 'live' | 'home';

	let { palette = 'light' as Palette, trailing = 'login' as Trailing }: { palette?: Palette; trailing?: Trailing } = $props();

	const shell = $derived(
		palette === 'light' ? 'border-base-300 bg-canvas/92 backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]' : 'border-ash-700 bg-ash-800'
	);

	const brandText = $derived(palette === 'light' ? 'text-base-content' : 'text-ash-100');
	const iconWrap = $derived(palette === 'light' ? 'from-secondary to-primary bg-linear-to-br text-white shadow-sm' : 'bg-ash-400 text-ash-100');
</script>

<header class="sticky top-0 z-40 shrink-0 border-b {shell}">
	<div class="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-4 lg:px-8">
		<a href="/" class="flex min-w-0 flex-1 items-center gap-2 no-underline sm:gap-3 {brandText}">
			<div class="flex size-8 shrink-0 items-center justify-center rounded-full text-sm sm:size-10 sm:text-base {iconWrap}">
				<i class="fas fa-bolt"></i>
			</div>
			<span class="truncate text-base font-bold sm:text-xl">{APP_NAME} Discord Bot</span>
		</a>
		<div class="flex shrink-0 items-center gap-2 sm:gap-2.5">
			{#if trailing === 'login'}
				<a href="/login" class="btn btn-sm btn-primary">
					<i class="fas fa-sign-in-alt"></i>
					Log in
				</a>
			{:else if trailing === 'live'}
				<span class="badge badge-sm border-primary/35 bg-primary/20 text-primary gap-1.5 font-semibold">
					<span class="bg-primary size-1.5 animate-pulse rounded-full" aria-hidden="true"></span>
					Live
				</span>
			{:else}
				<a href="/" class="btn btn-sm {palette === 'dark' ? 'border-ash-600 bg-ash-800/80 text-ash-200 hover:bg-ash-700' : ''}">
					<i class="fas fa-house"></i>
					Home
				</a>
			{/if}
		</div>
	</div>
</header>
