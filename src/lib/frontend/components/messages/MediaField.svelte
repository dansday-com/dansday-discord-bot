<script lang="ts">
	import { IMAGE_ACCEPT, imageSizeLabel } from '$lib/images.js';
	import { MESSAGE_VIDEO_ACCEPT, isMessageUploadKey, isMessageVideo, messageFilePreviewUrl } from '$lib/messages.js';
	import { messageEditor } from './editorContext.js';
	import { mediaKinds, uploadMedia } from './mediaUpload.js';
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

	async function pick(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const key = await uploadMedia(editor, file, video, (fraction) => (progress = fraction));
			if (key) value = key;
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
			<span class="text-ash-500 min-w-0 flex-1 text-xs">{mediaKinds(video)} · up to {imageSizeLabel(editor.uploadLimit)}</span>
		{/if}
		<label for="media-{uid}" class="{GHOST_BUTTON} shrink-0 cursor-pointer {progress !== null ? 'pointer-events-none opacity-60' : ''}">
			<i class="fas {progress !== null ? 'fa-spinner fa-spin' : 'fa-upload'}"></i>
			{progress !== null ? `${Math.round(progress * 100)}%` : value ? 'Replace' : 'Upload'}
		</label>
		{#if value && link}
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
