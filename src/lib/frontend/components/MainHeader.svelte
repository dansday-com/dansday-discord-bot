<script lang="ts">
	/**
	 * `landing`: light marketing nav + Log in.
	 * `stats`: light nav + Live pill.
	 * `auth`: ash shell (matches login/register gradient + panel), Home link — not the light `m-nav` bar.
	 */
	type Mode = 'landing' | 'stats' | 'auth';

	let { mode = 'landing' as Mode }: { mode?: Mode } = $props();
</script>

{#if mode === 'auth'}
	<header class="bg-ash-800 border-ash-700 sticky top-0 z-40 flex-shrink-0 border-b">
		<div class="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8">
			<div class="flex h-14 items-center justify-between py-2 sm:h-16">
				<a href="/" class="text-ash-100 flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
					<div class="bg-ash-400 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10">
						<i class="fas fa-bolt text-ash-100 text-sm sm:text-base"></i>
					</div>
					<span class="truncate text-base font-bold sm:text-xl">Dansday Discord Bot</span>
				</a>
				<div class="flex flex-shrink-0 items-center">
					<a
						href="/"
						class="border-ash-600 bg-ash-800/80 text-ash-200 hover:bg-ash-700 hover:text-ash-100 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors sm:px-4 sm:py-2 sm:text-sm"
					>
						<i class="fas fa-house"></i>
						Home
					</a>
				</div>
			</div>
		</div>
	</header>
{:else}
	<nav class="m-nav">
		<div class="m-nav-inner">
			<a href="/" class="m-nav-brand">
				<div class="m-nav-icon">
					<i class="fas fa-bolt"></i>
				</div>
				<span>Dansday Discord Bot</span>
			</a>
			<div class="m-nav-right">
				{#if mode === 'landing'}
					<a href="/login" class="m-btn m-btn--primary">
						<i class="fas fa-sign-in-alt"></i>
						Log in
					</a>
				{:else}
					<span class="m-nav-live">
						<span class="m-nav-live-dot"></span>
						Live
					</span>
				{/if}
			</div>
		</div>
	</nav>
{/if}
