<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import './main.css';

	const status = $derived(page.status);
	const isServerError = $derived(status >= 500 && status < 600);
	const title = $derived(isServerError ? 'Something went wrong' : status === 404 ? 'Page not found' : `Error ${status}`);
	const subtitle = $derived(
		isServerError ? 'Our side hit a problem. You can go back to the panel home or try again.' : 'This page does not exist or you do not have access.'
	);

	const chips = $derived(
		isServerError
			? [
					{ icon: 'fa-server', label: 'Server error' },
					{ icon: 'fa-triangle-exclamation', label: 'Unexpected' },
					{ icon: 'fa-rotate-right', label: 'Retryable' }
				]
			: [
					{ icon: 'fa-map', label: 'Not found' },
					{ icon: 'fa-lock', label: 'No access' },
					{ icon: 'fa-house', label: 'Go home' }
				]
	);
</script>

<svelte:head>
	<title>{title} | Dansday Discord Bot</title>
</svelte:head>

<div class="m-root m-root--error">
	<!-- Animated ambient blobs matching public page -->
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<div class="m-err-inner">
		<!-- Chip strip -->
		<div class="m-err-strip" aria-hidden="true">
			{#each chips as chip}
				<div class="m-err-strip-item">
					<div class="m-err-strip-icon">
						<i class="fas {chip.icon}"></i>
					</div>
					<span class="m-err-strip-label">{chip.label}</span>
				</div>
			{/each}
		</div>

		<!-- Main card -->
		<div class="m-err-card">
			<!-- Icon badge -->
			<div class="m-err-icon-wrap {isServerError ? 'm-err-icon-wrap--server' : 'm-err-icon-wrap--client'}" aria-hidden="true">
				<i class="fas {isServerError ? 'fa-server' : 'fa-circle-exclamation'} m-err-icon"></i>
			</div>

			<p class="m-err-code">Error {status}</p>
			<h1 class="m-err-title">{title}</h1>
			<p class="m-err-subtitle">{subtitle}</p>

			<!-- Divider -->
			<div class="m-err-divider"></div>

			<!-- Actions -->
			<div class="m-err-actions">
				<button type="button" onclick={() => goto('/dashboard')} class="m-btn m-btn--primary">
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

		<p class="m-err-footer">Dansday Discord Bot</p>
	</div>
</div>
