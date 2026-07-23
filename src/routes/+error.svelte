<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import Button from '$lib/frontend/components/Button.svelte';

	const status = $derived(page.status);
	const isServerError = $derived(status >= 500 && status < 600);
	const title = $derived(isServerError ? 'Something went wrong' : status === 404 ? 'Page not found' : `Error ${status}`);
	const subtitle = $derived(
		isServerError ? 'Our side hit a problem. You can go back to the panel home or try again.' : 'This page does not exist or you do not have access.'
	);
</script>

<svelte:head>
	<title>{title} | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="m-root text-lb-text relative flex flex-col overflow-x-hidden">
	<div class="m-blob m-blob-1 pointer-events-none fixed z-0 h-[420px] w-[420px] rounded-full opacity-14"></div>
	<div class="m-blob m-blob-2 pointer-events-none fixed z-0 h-[320px] w-[320px] rounded-full opacity-14"></div>
	<div class="m-blob m-blob-3 pointer-events-none fixed z-0 h-[260px] w-[260px] rounded-full opacity-14"></div>

	<MainHeader />

	<main class="m-main m-main--error flex min-h-0 flex-1 flex-col overflow-y-auto">
		<div
			class="m-inner m-err-wrap relative z-1 mx-auto my-0 box-border flex max-w-[1280px] flex-1 flex-col items-center justify-center px-0 px-8 pt-7 pt-8 pb-10 pb-16"
		>
			<div class="m-err-inner relative z-1 flex w-full max-w-[440px] flex-col items-center">
				<div class="m-err-card w-full rounded-[20px] px-7 py-8 text-center">
					<div
						class="m-err-icon-wrap {isServerError
							? 'm-err-icon-wrap--server'
							: 'm-err-icon-wrap--client'} mx-auto mt-0 mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-[20px]"
						aria-hidden="true"
					>
						<i class="fas {isServerError ? 'fa-server' : 'fa-circle-exclamation'} m-err-icon text-2xl"></i>
					</div>

					<p class="m-err-code text-lb-text-subtle mx-0 mt-0 mb-2 text-xs font-semibold uppercase">Error {status}</p>
					<h1 class="m-err-title text-lb-text mx-0 mt-0 mb-2 text-xl font-extrabold">{title}</h1>
					<p class="m-err-subtitle text-lb-text-muted m-0 text-base">{subtitle}</p>

					<div class="m-err-divider mx-0 my-6 h-1 rounded-[1px]"></div>

					<div class="m-err-actions flex-row justify-center">
						<Button onclick={() => goto(DASHBOARD_PATH)} variant="primary">
							<i class="fas fa-house"></i>
							Panel home
						</Button>
						{#if isServerError}
							<Button onclick={() => window.location.reload()} variant="ghost">
								<i class="fas fa-rotate-right"></i>
								Try again
							</Button>
						{/if}
					</div>

					{#if import.meta.env.DEV && page.error?.message}
						<p class="m-err-dev-msg text-lb-text-faint mx-0 mt-5 mb-0 text-left text-xs">{page.error.message}</p>
					{/if}
				</div>
			</div>
		</div>
	</main>

	<MainFooter />
</div>
