<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';

	const status = $derived(page.status);
	const isServerError = $derived(status >= 500 && status < 600);
	const title = $derived(isServerError ? 'Something went wrong' : status === 404 ? 'Page not found' : `Error ${status}`);
	const subtitle = $derived(
		isServerError ? 'Our side hit a problem. You can go back to the panel home or try again.' : 'This page does not exist or you do not have access.'
	);
</script>

<svelte:head>
	<title>{title} | &lt;/DANSDAY&gt; Discord Bot</title>
</svelte:head>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader />

	<main class="m-main m-main--error">
		<div class="m-inner m-err-wrap">
			<div class="m-err-inner">
				<div class="m-err-card">
					<div class="m-err-icon-wrap {isServerError ? 'm-err-icon-wrap--server' : 'm-err-icon-wrap--client'}" aria-hidden="true">
						<i class="fas {isServerError ? 'fa-server' : 'fa-circle-exclamation'} m-err-icon"></i>
					</div>

					<p class="m-err-code">Error {status}</p>
					<h1 class="m-err-title">{title}</h1>
					<p class="m-err-subtitle">{subtitle}</p>

					<div class="m-err-divider"></div>

					<div class="m-err-actions">
						<button type="button" onclick={() => goto(DASHBOARD_PATH)} class="m-btn m-btn--primary">
							<i class="fas fa-house"></i>
							Panel home
						</button>
						{#if isServerError}
							<button type="button" onclick={() => window.location.reload()} class="m-btn m-btn--ghost">
								<i class="fas fa-rotate-right"></i>
								Try again
							</button>
						{/if}
					</div>

					{#if import.meta.env.DEV && page.error?.message}
						<p class="m-err-dev-msg">{page.error.message}</p>
					{/if}
				</div>
			</div>
		</div>
	</main>

	<MainFooter />
</div>
