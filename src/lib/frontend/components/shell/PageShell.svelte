<script lang="ts">
	import type { Snippet } from 'svelte';
	import MainHeader from '../MainHeader.svelte';
	import MainFooter from '../MainFooter.svelte';

	let {
		trailing = 'login',
		width = 'default',
		center = false,
		children
	}: {
		trailing?: 'login' | 'live' | 'home';
		width?: 'default' | 'flush';
		center?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="bg-canvas text-base-content relative isolate flex min-h-dvh flex-col overflow-x-hidden" data-theme="dansday">
	<div class="bg-primary animate-blob-drift pointer-events-none fixed -top-25 -left-25 -z-10 size-[420px] rounded-full opacity-14 blur-[80px]"></div>
	<div
		class="bg-secondary animate-blob-drift pointer-events-none fixed -right-20 bottom-[10%] -z-10 size-80 rounded-full opacity-14 blur-[80px] [animation-delay:-6s]"
	></div>
	<div
		class="bg-neutral animate-blob-drift pointer-events-none fixed top-[40%] left-[30%] -z-10 size-65 rounded-full opacity-14 blur-[80px] [animation-delay:-12s]"
	></div>

	<MainHeader {trailing} />

	<main class="flex min-h-0 flex-1 flex-col">
		<div
			class="relative z-1 mx-auto w-full max-w-7xl px-3 pt-4 pb-10 {width === 'flush' ? 'flex min-w-0 flex-1 flex-col' : ''} {center
				? 'flex flex-1 flex-col items-center justify-center'
				: ''}"
		>
			{@render children()}
		</div>
	</main>

	<MainFooter />
</div>
