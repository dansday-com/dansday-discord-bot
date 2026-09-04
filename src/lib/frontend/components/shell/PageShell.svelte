<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
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

	let lenis: { destroy: () => void; raf: (t: number) => void; scrollTo: (t: unknown) => void } | null = null;
	let frame = 0;

	onMount(async () => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const { default: Lenis } = await import('lenis');
		lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6, autoRaf: false });

		const tick = (time: number) => {
			lenis?.raf(time);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);

		const onAnchor = (e: MouseEvent) => {
			const link = (e.target as HTMLElement | null)?.closest('a[href^="#"]') as HTMLAnchorElement | null;
			if (!link) return;
			const target = document.querySelector(link.hash);
			if (!target) return;
			e.preventDefault();
			lenis?.scrollTo(target, { offset: -80 });
		};
		document.addEventListener('click', onAnchor);
		return () => document.removeEventListener('click', onAnchor);
	});

	onDestroy(() => {
		cancelAnimationFrame(frame);
		lenis?.destroy();
		lenis = null;
	});
</script>

<div class="bg-canvas text-base-content relative isolate flex min-h-dvh flex-col overflow-x-clip" data-theme="dansday">
	<div
		class="bg-primary animate-blob-drift pointer-events-none fixed -top-16 -left-16 -z-10 size-56 rounded-full opacity-10 blur-[60px] sm:-top-25 sm:-left-25 sm:size-80 sm:blur-[80px] lg:size-[420px]"
	></div>
	<div
		class="bg-secondary animate-blob-drift pointer-events-none fixed -right-14 bottom-[10%] -z-10 size-48 rounded-full opacity-10 blur-[60px] [animation-delay:-6s] sm:-right-20 sm:size-80 sm:blur-[80px]"
	></div>
	<div
		class="bg-neutral animate-blob-drift pointer-events-none fixed top-[40%] left-[30%] -z-10 size-40 rounded-full opacity-8 blur-[60px] [animation-delay:-12s] sm:size-65 sm:blur-[80px]"
	></div>

	<MainHeader {trailing} />

	<main class="flex min-h-0 flex-1 flex-col">
		<div
			class="relative z-1 mx-auto w-full max-w-7xl px-3 pt-4 pb-10 2xl:max-w-[100rem] 2xl:px-8 {width === 'flush' ? 'flex min-w-0 flex-1 flex-col' : ''} {center
				? 'flex flex-1 flex-col items-center justify-center'
				: ''}"
		>
			{@render children()}
		</div>
	</main>

	<MainFooter />
</div>
