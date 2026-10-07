import { MESSAGE_UPLOAD_CHUNK_BYTES } from '$lib/messages.js';

export type MessageUploadResult = { ok: true; key: string } | { ok: false; error: string };

export async function uploadMessageFile(serverId: number | string, file: File, onProgress?: (fraction: number) => void): Promise<MessageUploadResult> {
	const total = Math.max(1, Math.ceil(file.size / MESSAGE_UPLOAD_CHUNK_BYTES));
	const uploadId = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('') + Date.now().toString(36);

	for (let index = 0; index < total; index++) {
		const chunk = file.slice(index * MESSAGE_UPLOAD_CHUNK_BYTES, (index + 1) * MESSAGE_UPLOAD_CHUNK_BYTES);
		let out: any = null;
		try {
			const res = await fetch(`/api/servers/${serverId}/messages/file`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					'x-upload-id': uploadId,
					'x-upload-index': String(index),
					'x-upload-total': String(total)
				},
				body: chunk
			});
			out = await res.json().catch(() => null);
		} catch {
			return { ok: false, error: 'The upload was interrupted. Check your connection and pick the file again.' };
		}
		if (!out?.ok) return { ok: false, error: out?.error || 'Could not upload the file. Try again.' };
		onProgress?.((index + 1) / total);
		if (out.done) return { ok: true, key: String(out.key) };
	}
	return { ok: false, error: 'Could not upload the file. Try again.' };
}
