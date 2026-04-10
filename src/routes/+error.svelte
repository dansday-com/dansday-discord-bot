<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

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

<div class="err-root">
	<!-- Animated ambient blobs matching public page -->
	<div class="err-blob err-blob-1"></div>
	<div class="err-blob err-blob-2"></div>
	<div class="err-blob err-blob-3"></div>

	<div class="err-inner">
		<!-- Chip strip -->
		<div class="err-strip" aria-hidden="true">
			{#each chips as chip}
				<div class="err-strip-item">
					<div class="err-strip-icon">
						<i class="fas {chip.icon}"></i>
					</div>
					<span class="err-strip-label">{chip.label}</span>
				</div>
			{/each}
		</div>

		<!-- Main card -->
		<div class="err-card">
			<!-- Icon badge -->
			<div class="err-icon-wrap {isServerError ? 'err-icon-wrap--server' : 'err-icon-wrap--client'}" aria-hidden="true">
				<i class="fas {isServerError ? 'fa-server' : 'fa-circle-exclamation'} err-icon"></i>
			</div>

			<p class="err-code">Error {status}</p>
			<h1 class="err-title">{title}</h1>
			<p class="err-subtitle">{subtitle}</p>

			<!-- Divider -->
			<div class="err-divider"></div>

			<!-- Actions -->
			<div class="err-actions">
				<button type="button" onclick={() => goto('/')} class="err-btn err-btn--primary">
					<i class="fas fa-house"></i>
					Panel home
				</button>
				{#if isServerError}
					<button type="button" onclick={() => window.location.reload()} class="err-btn err-btn--ghost">
						<i class="fas fa-rotate-right"></i>
						Try again
					</button>
				{/if}
			</div>

			{#if import.meta.env.DEV && page.error?.message}
				<p class="err-dev-msg">{page.error.message}</p>
			{/if}
		</div>

		<p class="err-footer">Dansday Discord Bot</p>
	</div>
</div>

<style>
	.err-root {
		--chili-bg: #f2f0ef;
		--chili-surface: #e8e6e3;
		--chili-elevated: #ffffff;
		--chili-hot: #245f73;
		--chili-peach: #3a6d82;
		--chili-brick: #733e24;
		--lb-text: #1a343f;
		--lb-text-muted: rgba(26, 52, 63, 0.58);
		--lb-text-subtle: rgba(26, 52, 63, 0.45);
		--lb-text-faint: rgba(26, 52, 63, 0.32);
		--lb-border: rgba(187, 189, 188, 0.55);
		--lb-shadow: rgba(26, 52, 63, 0.07);

		min-height: 100dvh;
		background: var(--chili-bg);
		font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		padding: 24px 16px;
	}

	/* Blobs */
	.err-blob {
		position: fixed;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.13;
		pointer-events: none;
		z-index: 0;
		animation: blob-drift 18s ease-in-out infinite alternate;
	}
	.err-blob-1 {
		width: 420px;
		height: 420px;
		background: var(--chili-hot);
		top: -100px;
		left: -100px;
		animation-delay: 0s;
	}
	.err-blob-2 {
		width: 320px;
		height: 320px;
		background: var(--chili-brick);
		bottom: 10%;
		right: -80px;
		animation-delay: -6s;
	}
	.err-blob-3 {
		width: 260px;
		height: 260px;
		background: #bbbdbc;
		top: 40%;
		left: 30%;
		animation-delay: -12s;
	}
	@keyframes blob-drift {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(30px, 20px) scale(1.08);
		}
	}

	/* Layout */
	.err-inner {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 440px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		animation: err-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	@keyframes err-fade-up {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Chip strip */
	.err-strip {
		display: flex;
		gap: 10px;
		justify-content: center;
		flex-wrap: wrap;
		width: 100%;
	}
	.err-strip-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid var(--lb-border);
		box-shadow: 0 4px 16px var(--lb-shadow);
		transition:
			transform 0.15s,
			border-color 0.2s;
	}
	.err-strip-item:hover {
		transform: translateY(-1px);
		border-color: rgba(36, 95, 115, 0.28);
	}
	.err-strip-icon {
		width: 30px;
		height: 30px;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--chili-brick), var(--chili-hot));
		color: #fff;
		font-size: 13px;
		flex-shrink: 0;
	}
	.err-strip-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--lb-text);
		white-space: nowrap;
	}

	/* Card */
	.err-card {
		width: 100%;
		background: var(--chili-elevated);
		border: 1px solid var(--lb-border);
		border-radius: 20px;
		padding: 32px 28px;
		text-align: center;
		box-shadow:
			0 4px 24px var(--lb-shadow),
			0 1px 0 rgba(255, 255, 255, 0.8) inset;
	}

	/* Icon badge */
	.err-icon-wrap {
		width: 68px;
		height: 68px;
		border-radius: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 20px;
		animation: err-icon-pop 0.5s 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}
	@keyframes err-icon-pop {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.err-icon-wrap--server {
		background: linear-gradient(135deg, rgba(36, 95, 115, 0.15), rgba(36, 95, 115, 0.08));
		box-shadow:
			0 0 0 1px rgba(36, 95, 115, 0.22),
			0 8px 24px rgba(36, 95, 115, 0.12);
	}
	.err-icon-wrap--client {
		background: linear-gradient(135deg, rgba(115, 62, 36, 0.13), rgba(115, 62, 36, 0.06));
		box-shadow:
			0 0 0 1px rgba(115, 62, 36, 0.2),
			0 8px 24px rgba(115, 62, 36, 0.1);
	}
	.err-icon {
		font-size: 28px;
	}
	.err-icon-wrap--server .err-icon {
		color: var(--chili-hot);
	}
	.err-icon-wrap--client .err-icon {
		color: var(--chili-brick);
	}

	.err-code {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--lb-text-subtle);
		margin: 0 0 6px;
	}
	.err-title {
		font-size: 22px;
		font-weight: 800;
		color: var(--lb-text);
		margin: 0 0 10px;
		letter-spacing: -0.3px;
		line-height: 1.2;
	}
	.err-subtitle {
		font-size: 14px;
		color: var(--lb-text-muted);
		line-height: 1.6;
		margin: 0;
	}

	.err-divider {
		height: 1px;
		background: var(--lb-border);
		margin: 24px 0;
		border-radius: 1px;
	}

	/* Buttons */
	.err-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	@media (min-width: 380px) {
		.err-actions {
			flex-direction: row;
			justify-content: center;
		}
	}
	.err-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 20px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition:
			transform 0.15s,
			box-shadow 0.15s,
			background 0.15s;
	}
	.err-btn:hover {
		transform: translateY(-1px);
	}
	.err-btn:active {
		transform: translateY(0);
	}
	.err-btn--primary {
		background: linear-gradient(135deg, var(--chili-peach), var(--chili-hot));
		color: #fff;
		box-shadow: 0 4px 14px rgba(36, 95, 115, 0.35);
	}
	.err-btn--primary:hover {
		box-shadow: 0 6px 20px rgba(36, 95, 115, 0.45);
	}
	.err-btn--ghost {
		background: var(--chili-surface);
		color: var(--lb-text);
		border: 1px solid var(--lb-border);
	}
	.err-btn--ghost:hover {
		background: var(--chili-surface-mid, #dedcd8);
	}

	/* Dev message */
	.err-dev-msg {
		margin: 20px 0 0;
		font-family: monospace;
		font-size: 11px;
		color: var(--lb-text-faint);
		text-align: left;
		word-break: break-all;
		line-height: 1.5;
	}

	/* Footer */
	.err-footer {
		font-size: 12px;
		color: var(--lb-text-faint);
		margin: 0;
	}
</style>
