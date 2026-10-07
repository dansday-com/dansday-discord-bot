import { IMAGE_FORMATS_LABEL, imageExtension, imageSizeLabel } from '$lib/images.js';
import { MESSAGE_VIDEO_FORMATS_LABEL, MESSAGE_VIDEO_TYPES } from '$lib/messages.js';
import { uploadMessageFile } from '$lib/frontend/messageUpload.js';
import { showToast } from '$lib/frontend/toast.svelte';
import type { MessageEditorContext } from './editorContext.js';

export function mediaKinds(video: boolean): string {
	return video ? `${IMAGE_FORMATS_LABEL}, ${MESSAGE_VIDEO_FORMATS_LABEL}` : IMAGE_FORMATS_LABEL;
}

export async function uploadMedia(editor: MessageEditorContext, file: File, video: boolean, onProgress: (fraction: number) => void): Promise<string | null> {
	const supported = !!imageExtension(file.type) || (video && file.type in MESSAGE_VIDEO_TYPES);
	if (!supported) {
		showToast(`Use a ${mediaKinds(video)} file.`, 'error');
		return null;
	}
	if (file.size > editor.uploadLimit) {
		showToast(`That file is ${imageSizeLabel(file.size)}. The limit is ${imageSizeLabel(editor.uploadLimit)}. ${editor.uploadLimitNote}`, 'error', 7000);
		return null;
	}
	onProgress(0);
	const result = await uploadMessageFile(editor.uploadUrl, file, onProgress);
	if (!result.ok) {
		showToast(result.error, 'error', 7000);
		return null;
	}
	return result.key;
}
