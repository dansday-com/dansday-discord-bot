<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import Button from '$lib/frontend/components/Button.svelte';
	type Palette = 'light' | 'dark';
	type Trailing = 'login' | 'live' | 'home';

	let { palette = 'light' as Palette, trailing = 'login' as Trailing }: { palette?: Palette; trailing?: Trailing } = $props();

	const shell = $derived(
		palette === 'light' ? 'border-lb-border bg-[rgba(242,240,239,0.92)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]' : 'border-ash-700 bg-ash-800'
	);

	const brandText = $derived(palette === 'light' ? 'text-lb-text' : 'text-ash-100');
	const iconWrap = $derived(
		palette === 'light' ? 'bg-gradient-to-br from-chili-brick to-chili-hot text-white shadow-[0_2px_12px_rgba(26,52,63,0.07)]' : 'bg-ash-400 text-ash-100'
	);
</script>

<header class="sticky top-0 z-40 shrink-0 border-b {shell}">
	<div class="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 lg:h-16 lg:px-8">
		<a href="/" class="flex min-w-0 flex-1 items-center gap-2 lg:gap-3 {brandText} no-underline">
			<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base lg:h-10 lg:w-10 lg:text-base {iconWrap}">
				<i class="fas fa-bolt"></i>
			</div>
			<span class="truncate text-base font-bold lg:text-xl">{APP_NAME} Discord Bot</span>
		</a>
		<div class="flex shrink-0 items-center gap-2 lg:gap-2.5">
			{#if trailing === 'login'}
				<Button href="/login" variant="primary">
					<i class="fas fa-sign-in-alt"></i>
					Log in
				</Button>
			{:else if trailing === 'live'}
				<span class="m-nav-live text-chili-peach border-chili-hot/28 bg-chili-hot/10 inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-base">
					<span class="m-nav-live-dot h-2 w-2 rounded-full"></span>
					Live
				</span>
			{:else}
				<a
					href="/"
					class="m-btn border {palette === 'light'
						? 'border-lb-border bg-chili-surface text-lb-text hover:bg-chili-surface-mid'
						: 'border-ash-600 bg-ash-800/80 text-ash-200 hover:border-ash-500 hover:bg-ash-700 hover:text-ash-100'} inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-semibold no-underline"
				>
					<i class="fas fa-house"></i>
					Home
				</a>
			{/if}
		</div>
	</div>
</header>
