import { IMAGE_FORMATS_LABEL, imageExtension, imageSizeLabel } from '$lib/images.js';
import { MESSAGE_VIDEO_FORMATS_LABEL, MESSAGE_VIDEO_TYPES } from '$lib/messages.js';
import { uploadMessageFile } from '$lib/frontend/messageUpload.js';
import { showToast, TOAST_MS } from '$lib/frontend/toast.svelte';
import type { MessageEditorContext } from './editorContext.js';

export function mediaKinds(isVideo: boolean): string {
	return isVideo ? `${IMAGE_FORMATS_LABEL}, ${MESSAGE_VIDEO_FORMATS_LABEL}` : IMAGE_FORMATS_LABEL;
}

type UploadOptions = { video: boolean; onProgress: (fraction: number) => void };

export async function uploadMedia(editor: MessageEditorContext, file: File, { video: isVideo, onProgress }: UploadOptions): Promise<string | null> {
	const isSupported = !!imageExtension(file.type) || (isVideo && file.type in MESSAGE_VIDEO_TYPES);
	if (!isSupported) {
		showToast(`Use a ${mediaKinds(isVideo)} file.`, 'error');
		return null;
	}
	if (file.size > editor.uploadLimit) {
		showToast(
			`That file is ${imageSizeLabel(file.size)}. The limit is ${imageSizeLabel(editor.uploadLimit)}. ${editor.uploadLimitNote}`,
			'error',
			TOAST_MS.long
		);
		return null;
	}
	onProgress(0);
	const result = await uploadMessageFile(editor.uploadUrl, file, onProgress);
	if (!result.ok) {
		showToast(result.error, 'error', TOAST_MS.long);
		return null;
	}
	return result.key;
}
