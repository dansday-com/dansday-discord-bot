<script lang="ts">
	import { APP_NAME, APP_DOMAIN } from '$lib/frontend/panelServer.js';
	import { resolveEmbedFooterPlaceholders } from '$lib/utils/embedFooter.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import EmbedForm from '$lib/frontend/components/EmbedForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let embedTitle = $state('');
	let embedDescription = $state('');
	let embedFooter = $state(`Powered by bot.${APP_DOMAIN} {year}`);
	let embedColor = $state('#ff0000');
	let imageMode = $state<'url' | 'upload'>('url');
	let imageUrl = $state('');
	let uploadedImagePath = $state('');
	let imagePreview = $state('');
	let sendingGlobalEmbed = $state(false);

	const embedFooterPreview = $derived(resolveEmbedFooterPlaceholders(embedFooter, '{server}'));

	async function sendGlobalEmbed() {
		sendingGlobalEmbed = true;
		try {
			const body: Record<string, unknown> = {
				title: embedTitle,
				description: embedDescription,
				footer: embedFooter,
				color: embedColor
			};

			if (imageMode === 'url' && imageUrl) body.image_url = imageUrl;
			else if (imageMode === 'upload' && uploadedImagePath) body.uploaded_image_path = uploadedImagePath;

			const res = await fetch(`/api/admin/send-global-embed`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body)
			});
			let d: { success?: boolean; error?: string; successCount?: number; failCount?: number } = {};
			try {
				d = await res.json();
			} catch {
				showToast('Could not read the server response. Try again.', 'error');
				return;
			}
			if (d.success) {
				uploadedImagePath = '';
				imagePreview = '';
				embedTitle = '';
				embedDescription = '';
				imageUrl = '';
				showToast(`Global embed sent! Succeeded: ${d.successCount}, Failed: ${d.failCount}`, 'success');
			} else {
				showToast(d.error || 'Failed to send global embed', 'error');
			}
		} finally {
			sendingGlobalEmbed = false;
		}
	}
</script>

<svelte:head>
	<title>Global Embed | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="mb-4">
	<h2 class="text-ash-100 mb-1 text-xl font-bold sm:text-2xl">
		<i class="fas fa-bullhorn mr-2 text-rose-400"></i>Global Embed Builder
	</h2>
	<p class="text-ash-400 text-xs sm:text-sm">
		Send an announcement to all servers across ALL of your bots. It will be posted in each server's configured <strong>Bot Updates Channel</strong>.
	</p>
</div>

<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
	<EmbedForm
		bind:title={embedTitle}
		bind:description={embedDescription}
		bind:footer={embedFooter}
		bind:color={embedColor}
		bind:imageMode
		bind:imageUrl
		bind:uploadedImagePath
		bind:imagePreview
		defaultFooter={`Powered by bot.${APP_DOMAIN} {year}`}
		defaultColor="#ff0000"
		footerPreview={embedFooterPreview}
		uploadEndpoint="/api/admin/upload-embed-image"
		deleteEndpoint="/api/admin/delete-embed-image"
		sending={sendingGlobalEmbed}
		onsubmit={sendGlobalEmbed}
		submitLabel="Send Global Embed"
	/>
</div>
