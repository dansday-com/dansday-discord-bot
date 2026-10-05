<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { BRAND_PRIMARY } from '$lib/brand.js';
	import { type MemberTheme, themeVars } from '$lib/themes.js';
	import MainHeader from '../MainHeader.svelte';
	import MainFooter from '../MainFooter.svelte';
	import { registerScroller } from '../../scrollLock.js';
	import { onFirstInteraction } from '../../firstInteraction.js';

	const memberTheme = $derived(((page.data as any)?.memberTheme ?? null) as MemberTheme | null);
	const themeBackdrop = $derived(memberTheme?.image ?? null);

	let {
		trailing = 'invite',
		width = 'default',
		center = false,
		children
	}: {
		trailing?: 'invite' | 'live' | 'home';
		width?: 'default' | 'flush';
		center?: boolean;
		children: Snippet;
	} = $props();

	$effect(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		let lenis: {
			destroy: () => void;
			raf: (t: number) => void;
			scrollTo: (t: unknown, o?: unknown) => void;
			on: (event: 'virtual-scroll', cb: () => void) => () => void;
			isScrolling: 'smooth' | 'native' | false;
		} | null = null;
		let unregister: (() => void) | null = null;
		let frame = 0;
		let stopped = false;
		let clock = 0;
		let last = -1;

		const tick = (time: number) => {
			frame = 0;
			clock += last < 0 ? 16 : Math.min(34, time - last);
			last = time;
			lenis?.raf(clock);
			if (lenis?.isScrolling === 'smooth') frame = requestAnimationFrame(tick);
			else last = -1;
		};
		const run = () => {
			if (!frame && !stopped) frame = requestAnimationFrame(tick);
		};

		const onAnchor = (e: MouseEvent) => {
			const link = (e.target as HTMLElement | null)?.closest('a[href^="#"]') as HTMLAnchorElement | null;
			if (!link || !link.hash || link.hash === '#') return;
			const target = document.querySelector(link.hash);
			if (!target) return;
			e.preventDefault();
			lenis?.scrollTo(target, { offset: -80 });
			run();
		};

		const stopWaiting = onFirstInteraction(() =>
			import('lenis').then(({ default: Lenis }) => {
				if (stopped) return;
				lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6, autoRaf: false }) as unknown as NonNullable<typeof lenis>;
				unregister = registerScroller(lenis as unknown as { stop: () => void; start: () => void });
				lenis.on('virtual-scroll', run);
				document.addEventListener('click', onAnchor);
			})
		);

		return () => {
			stopped = true;
			stopWaiting();
			if (frame) cancelAnimationFrame(frame);
			document.removeEventListener('click', onAnchor);
			unregister?.();
			unregister = null;
			lenis?.destroy();
			lenis = null;
		};
	});
</script>

<svelte:head>
	<meta name="theme-color" content={BRAND_PRIMARY} />
</svelte:head>

<div
	class="bg-canvas text-base-content relative isolate flex min-h-dvh flex-col overflow-x-clip max-sm:has-[[data-nav-wheel]]:pb-22"
	data-theme="dansday"
	style={themeVars(memberTheme)}
>
	{#if themeBackdrop}
		<div
			class="pointer-events-none fixed top-0 left-0 -z-20 h-lvh w-full bg-cover bg-scroll bg-center bg-no-repeat sm:bg-fixed"
			style="background-image: url('{themeBackdrop}')"
			aria-hidden="true"
		></div>
		<div class="bg-canvas/55 pointer-events-none fixed top-0 left-0 -z-10 h-lvh w-full backdrop-blur-[2px]" aria-hidden="true"></div>
	{:else}
		<div
			class="bg-primary animate-blob-drift pointer-events-none fixed -top-16 -left-16 -z-10 size-56 rounded-full opacity-10 blur-[60px] sm:-top-25 sm:-left-25 sm:size-80 sm:blur-[80px] lg:size-[420px]"
		></div>
		<div
			class="bg-secondary animate-blob-drift pointer-events-none fixed -right-14 bottom-[10%] -z-10 size-48 rounded-full opacity-10 blur-[60px] [animation-delay:-6s] sm:-right-20 sm:size-80 sm:blur-[80px]"
		></div>
		<div
			class="bg-neutral animate-blob-drift pointer-events-none fixed top-[40%] left-[30%] -z-10 size-40 rounded-full opacity-8 blur-[60px] [animation-delay:-12s] sm:size-65 sm:blur-[80px]"
		></div>
	{/if}

	<MainHeader {trailing} />

	<main class="flex min-h-0 flex-1 flex-col">
		<div
			class="relative mx-auto w-full max-w-7xl px-3 pt-4 pb-10 sm:px-4 lg:px-8 {width === 'flush' ? 'flex min-w-0 flex-1 flex-col' : ''} {center
				? 'flex flex-1 flex-col items-center justify-center'
				: ''}"
		>
			{@render children()}
		</div>
	</main>

	<MainFooter />
</div>
