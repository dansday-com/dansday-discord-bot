<script lang="ts">
	import { IMAGE_ACCEPT, IMAGE_FORMATS_LABEL, imageExtension, imageSizeLabel } from '$lib/images.js';
	import {
		MESSAGE_VIDEO_ACCEPT,
		MESSAGE_VIDEO_FORMATS_LABEL,
		MESSAGE_VIDEO_TYPES,
		isMessageUploadKey,
		isMessageVideo,
		messageFilePreviewUrl
	} from '$lib/messages.js';
	import { uploadMessageFile } from '$lib/frontend/messageUpload.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { messageEditor } from './editorContext.js';
	import { FIELD, GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let {
		value = $bindable(''),
		label = '',
		video = false,
		link = true
	}: {
		value: string;
		label?: string;
		video?: boolean;
		link?: boolean;
	} = $props();

	const editor = messageEditor();
	const uid = $props.id();
	let progress = $state<number | null>(null);

	const uploaded = $derived(isMessageUploadKey(value));
	const preview = $derived(value ? messageFilePreviewUrl(value) : '');
	const kinds = $derived(video ? `${IMAGE_FORMATS_LABEL}, ${MESSAGE_VIDEO_FORMATS_LABEL}` : IMAGE_FORMATS_LABEL);

	async function pick(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const supported = !!imageExtension(file.type) || (video && file.type in MESSAGE_VIDEO_TYPES);
		if (!supported) return showToast(`Use a ${kinds} file.`, 'error');
		if (file.size > editor.uploadLimit) {
			return showToast(
				`That file is ${imageSizeLabel(file.size)}. The limit is ${imageSizeLabel(editor.uploadLimit)}. ${editor.uploadLimitNote}`,
				'error',
				7000
			);
		}
		progress = 0;
		try {
			const result = await uploadMessageFile(editor.uploadUrl, file, (fraction) => (progress = fraction));
			if (!result.ok) return showToast(result.error, 'error', 7000);
			value = result.key;
		} finally {
			progress = null;
		}
	}
</script>

<div class="min-w-0">
	{#if label}<span class="{LABEL} mb-1 block">{label}</span>{/if}
	<div class="flex items-center gap-2">
		<span class="bg-ash-700 border-ash-600 text-ash-400 grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border">
			{#if !preview}
				<i class="fas {video ? 'fa-photo-film' : 'fa-image'} text-sm"></i>
			{:else if isMessageVideo(value)}
				<i class="fas fa-film text-sm text-sky-300"></i>
			{:else}
				<img src={preview} alt="" class="size-full object-cover" loading="lazy" />
			{/if}
		</span>
		{#if uploaded}
			<span class="bg-ash-700 border-ash-600 text-ash-200 min-w-0 flex-1 truncate rounded-lg border px-3 py-2 text-sm">
				Uploaded {isMessageVideo(value) ? 'video' : 'image'}
			</span>
		{:else if link}
			<input type="url" bind:value placeholder="Paste a link, or upload" aria-label={label || 'Link'} class="{FIELD} min-w-0 flex-1" />
		{:else}
			<span class="text-ash-500 min-w-0 flex-1 text-xs">{kinds} · up to {imageSizeLabel(editor.uploadLimit)}</span>
		{/if}
		<label for="media-{uid}" class="{GHOST_BUTTON} shrink-0 cursor-pointer {progress !== null ? 'pointer-events-none opacity-60' : ''}">
			<i class="fas {progress !== null ? 'fa-spinner fa-spin' : 'fa-upload'}"></i>
			{progress !== null ? `${Math.round(progress * 100)}%` : value ? 'Replace' : 'Upload'}
		</label>
		{#if value}
			<button type="button" class={ICON_BUTTON} aria-label="Remove {label || 'file'}" onclick={() => (value = '')}><i class="fas fa-xmark"></i></button>
		{/if}
		<input
			id="media-{uid}"
			type="file"
			accept={video ? `${IMAGE_ACCEPT},${MESSAGE_VIDEO_ACCEPT}` : IMAGE_ACCEPT}
			class="hidden"
			disabled={progress !== null}
			onchange={(e) => pick(e.currentTarget)}
		/>
	</div>
</div>
