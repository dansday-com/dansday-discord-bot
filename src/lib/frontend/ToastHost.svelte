<script lang="ts">
	import { flip } from 'svelte/animate';
	import { backOut, cubicOut } from 'svelte/easing';
	import { getToasts, dismissToast, pauseToast, resumeToast } from '$lib/frontend/toast.svelte';

	const toasts = getToasts();

	const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const META = {
		success: { icon: 'fa-circle-check', tint: 'bg-success/12 text-success', bar: 'bg-success' },
		error: { icon: 'fa-triangle-exclamation', tint: 'bg-error/12 text-error', bar: 'bg-error' },
		info: { icon: 'fa-circle-info', tint: 'bg-primary/12 text-primary', bar: 'bg-primary' }
	} as const;

	function enter() {
		return {
			duration: reduced ? 0 : 460,
			easing: backOut,
			css: (t: number, u: number) => `opacity: ${t}; transform: translate3d(0, ${u * -22}px, 0) scale(${0.9 + 0.1 * t})`
		};
	}

	function exit() {
		return {
			duration: reduced ? 0 : 240,
			easing: cubicOut,
			css: (t: number, u: number) => `opacity: ${t}; transform: translate3d(${u * 28}px, 0, 0) scale(${0.94 + 0.06 * t})`
		};
	}
</script>

<div
	class="pointer-events-none fixed top-3 left-1/2 z-50 flex w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col gap-2 sm:top-4 sm:right-4 sm:left-auto sm:w-auto sm:max-w-sm sm:translate-x-0"
	aria-live="polite"
	aria-atomic="false"
>
	{#each toasts as toast (toast.id)}
		{@const meta = META[toast.type] ?? META.info}
		<div
			animate:flip={{ duration: reduced ? 0 : 280 }}
			in:enter
			out:exit
			role="status"
			class="group border-base-300 bg-base-100/95 pointer-events-auto overflow-hidden rounded-xl border shadow-[0_12px_32px_-14px_rgba(46,33,27,0.5)] backdrop-blur-md"
			onmouseenter={() => pauseToast(toast.id)}
			onmouseleave={() => resumeToast(toast.id)}
			onfocusin={() => pauseToast(toast.id)}
			onfocusout={() => resumeToast(toast.id)}
		>
			<div class="flex items-start gap-2.5 p-3 pr-2">
				<span class="grid size-8 shrink-0 place-items-center rounded-lg text-[15px] {meta.tint}">
					<i class="fas {meta.icon} motion-safe:animate-pop-in"></i>
				</span>
				<p class="text-base-content min-w-0 flex-1 pt-1.5 text-[13px] leading-snug font-semibold [overflow-wrap:anywhere]">
					{toast.message}
				</p>
				<button
					type="button"
					class="text-base-content/35 hover:bg-base-200 hover:text-base-content grid size-6 shrink-0 place-items-center rounded-md text-[11px] transition-colors"
					aria-label="Dismiss notification"
					onclick={() => dismissToast(toast.id)}
				>
					<i class="fas fa-xmark"></i>
				</button>
			</div>
			<div class="bg-base-300/50 h-[3px] w-full">
				<div
					class="h-full origin-left {meta.bar} group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]"
					style={reduced ? 'transform: scaleX(1)' : `animation: toast-progress ${toast.duration}ms linear forwards`}
				></div>
			</div>
		</div>
	{/each}
</div>
