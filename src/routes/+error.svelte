<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
	import { PageShell } from '$lib/frontend/components/shell';

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

<PageShell center>
	<div class="animate-fade-up flex w-full max-w-[440px] flex-col items-center">
		<div class="card border-base-300 bg-base-100 w-full border text-center shadow-sm">
			<div class="card-body items-center p-7 sm:p-8">
				<div
					class="animate-icon-pop mx-auto mb-5 grid size-17 place-items-center rounded-[20px] {isServerError
						? 'from-primary/15 to-primary/8 ring-primary/22 bg-linear-to-br ring-1'
						: 'from-secondary/13 to-secondary/6 ring-secondary/20 bg-linear-to-br ring-1'}"
					aria-hidden="true"
				>
					<i class="fas {isServerError ? 'fa-server text-primary' : 'fa-circle-exclamation text-secondary'} text-[28px]"></i>
				</div>

				<p class="text-base-content/45 mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">Error {status}</p>
				<h1 class="text-base-content mb-2.5 text-[22px] leading-tight font-extrabold tracking-tight">{title}</h1>
				<p class="text-base-content/60 text-sm leading-relaxed">{subtitle}</p>

				<div class="divider my-5"></div>

				<div class="flex w-full flex-col gap-2.5">
					<button type="button" onclick={() => goto(DASHBOARD_PATH)} class="btn btn-primary btn-block">
						<i class="fas fa-house"></i>
						Panel home
					</button>
					{#if isServerError}
						<button type="button" onclick={() => window.location.reload()} class="btn btn-block">
							<i class="fas fa-rotate-right"></i>
							Try again
						</button>
					{/if}
				</div>

				{#if import.meta.env.DEV && page.error?.message}
					<p class="text-base-content/40 mt-5 w-full text-left font-mono text-[11px] leading-relaxed break-all">{page.error.message}</p>
				{/if}
			</div>
		</div>
	</div>
</PageShell>
