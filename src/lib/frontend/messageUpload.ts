import { MESSAGE_UPLOAD_CHUNK_BYTES } from '$lib/messages.js';
import { BASE36_RADIX } from '$lib/utils/numbers.js';

const UPLOAD_ID_RANDOM_CHARS = 12;

export type MessageUploadResult = { ok: true; key: string } | { ok: false; error: string };

export async function uploadMessageFile(url: string, file: File, onProgress?: (fraction: number) => void): Promise<MessageUploadResult> {
	const total = Math.max(1, Math.ceil(file.size / MESSAGE_UPLOAD_CHUNK_BYTES));
	const uploadId =
		Array.from(crypto.getRandomValues(new Uint8Array(UPLOAD_ID_RANDOM_CHARS)), (b) => (b % BASE36_RADIX).toString(BASE36_RADIX)).join('') +
		Date.now().toString(BASE36_RADIX);

	for (let index = 0; index < total; index++) {
		const chunk = file.slice(index * MESSAGE_UPLOAD_CHUNK_BYTES, (index + 1) * MESSAGE_UPLOAD_CHUNK_BYTES);
		let out: { ok?: boolean; done?: boolean; key?: string; error?: string } | null = null;
		try {
			const res = await fetch(url, {
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
		if (!out?.ok) {
			return { ok: false, error: out?.error || 'Could not upload the file. Try again.' };
		}
		onProgress?.((index + 1) / total);
		if (out.done) {
			return { ok: true, key: String(out.key) };
		}
	}
	return { ok: false, error: 'Could not upload the file. Try again.' };
}
