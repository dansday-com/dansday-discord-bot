<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const status = $derived(page.status);
	const isServerError = $derived(status >= 500 && status < 600);
	const title = $derived(isServerError ? 'Something went wrong' : status === 404 ? 'Not found' : `Error ${status}`);
	const subtitle = $derived(
		isServerError ? 'Our side hit a problem. You can go back to the panel home or try again.' : 'This page does not exist or you do not have access.'
	);
</script>

<svelte:head>
	<title>{title} | Dansday</title>
</svelte:head>

<div class="bg-ash-950 text-ash-100 flex min-h-screen flex-col items-center justify-center px-4 py-16">
	<div class="bg-ash-900 border-ash-700 w-full max-w-md rounded-2xl border p-8 text-center shadow-xl">
		{#if isServerError}
			<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-500/30" aria-hidden="true">
				<i class="fas fa-server text-3xl text-rose-400"></i>
			</div>
			<p class="text-ash-500 mb-1 text-xs font-medium tracking-wide uppercase">Error {status}</p>
			<h1 class="text-ash-50 mb-3 text-xl font-bold sm:text-2xl">{title}</h1>
			<p class="text-ash-400 mb-8 text-sm leading-relaxed">{subtitle}</p>
		{:else}
			<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/30" aria-hidden="true">
				<i class="fas fa-circle-exclamation text-3xl text-amber-400"></i>
			</div>
			<p class="text-ash-500 mb-1 text-xs font-medium tracking-wide uppercase">{status}</p>
			<h1 class="text-ash-50 mb-3 text-xl font-bold sm:text-2xl">{title}</h1>
			<p class="text-ash-400 mb-8 text-sm leading-relaxed">{subtitle}</p>
		{/if}

		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			<button
				type="button"
				onclick={() => goto('/')}
				class="bg-ash-400 hover:bg-ash-500 text-ash-100 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
			>
				<i class="fas fa-house text-xs"></i>
				Panel home
			</button>
			{#if isServerError}
				<button
					type="button"
					onclick={() => window.location.reload()}
					class="border-ash-600 text-ash-200 hover:bg-ash-800 inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
				>
					<i class="fas fa-rotate-right text-xs"></i>
					Reload
				</button>
			{/if}
		</div>

		{#if import.meta.env.DEV && page.error?.message}
			<p class="text-ash-600 mt-8 text-left font-mono text-xs break-all">{page.error.message}</p>
		{/if}
	</div>
</div>
