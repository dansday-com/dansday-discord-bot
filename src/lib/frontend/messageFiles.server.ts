import { json } from '@sveltejs/kit';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '$lib/utils/index.js';
import { imageSizeLabel } from '$lib/images.js';
import { MESSAGE_UPLOAD_CHUNK_BYTES, type MessageOwner } from '$lib/messages.js';
import { messageFileContentType, messageFileKey, messageFileKeyFor, readMessageFile, saveMessageFile } from '$lib/backend/storage/messageFiles.js';

const TEMP_ROOT = join(process.cwd(), 'data', 'tmp', 'message-uploads');
const STALE_MS = 60 * 60 * 1000;
const UPLOAD_ID = /^[a-z0-9]{12,32}$/;
const INTERRUPTED = 'The upload was interrupted. Pick the file again.';

function sniffExtension(data: Buffer): string | null {
	const ascii = (start: number, end: number) => data.subarray(start, end).toString('latin1');
	if (data.length < 12) return null;
	if (data[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
	if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg';
	if (ascii(0, 4) === 'GIF8') return 'gif';
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
	if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return 'webm';
	if (ascii(4, 8) === 'ftyp') return ascii(8, 12) === 'qt  ' ? 'mov' : 'mp4';
	if (['moov', 'mdat', 'wide', 'free'].includes(ascii(4, 8))) return 'mov';
	return null;
}

function pruneStale() {
	if (!existsSync(TEMP_ROOT)) return;
	for (const name of readdirSync(TEMP_ROOT)) {
		const dir = join(TEMP_ROOT, name);
		try {
			if (Date.now() - statSync(dir).mtimeMs > STALE_MS) rmSync(dir, { recursive: true, force: true });
		} catch {}
	}
}

export async function receiveMessageUpload(request: Request, owner: MessageOwner, limit: number, tooLarge: string): Promise<Response> {
	const uploadId = request.headers.get('x-upload-id') ?? '';
	const index = Number(request.headers.get('x-upload-index'));
	const total = Number(request.headers.get('x-upload-total'));
	if (!UPLOAD_ID.test(uploadId) || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
		return json({ ok: false, error: INTERRUPTED }, { status: 400 });
	}
	const oversized = `That file is over the ${imageSizeLabel(limit)} upload limit. ${tooLarge}`;
	if (total > Math.ceil(limit / MESSAGE_UPLOAD_CHUNK_BYTES)) return json({ ok: false, error: oversized }, { status: 400 });

	const dir = join(TEMP_ROOT, `${owner.scope}-${owner.id}-${uploadId}`);
	try {
		const chunk = Buffer.from(await request.arrayBuffer());
		if (chunk.length === 0 || chunk.length > MESSAGE_UPLOAD_CHUNK_BYTES) return json({ ok: false, error: INTERRUPTED }, { status: 400 });

		if (index === 0) {
			pruneStale();
			rmSync(dir, { recursive: true, force: true });
			mkdirSync(dir, { recursive: true });
		} else if (!existsSync(dir)) {
			return json({ ok: false, error: INTERRUPTED }, { status: 400 });
		}
		writeFileSync(join(dir, String(index)), chunk);

		const parts = Array.from({ length: index + 1 }, (_, i) => join(dir, String(i)));
		if (parts.some((part) => !existsSync(part))) {
			rmSync(dir, { recursive: true, force: true });
			return json({ ok: false, error: INTERRUPTED }, { status: 400 });
		}
		if (parts.reduce((sum, part) => sum + statSync(part).size, 0) > limit) {
			rmSync(dir, { recursive: true, force: true });
			return json({ ok: false, error: oversized }, { status: 400 });
		}
		if (index < total - 1) return json({ ok: true, done: false });

		const data = Buffer.concat(parts.map((part) => readFileSync(part)));
		rmSync(dir, { recursive: true, force: true });
		const extension = sniffExtension(data);
		if (!extension) return json({ ok: false, error: 'Use a PNG, JPG, GIF or WEBP image, or an MP4, WEBM or MOV video.' }, { status: 400 });

		const key = messageFileKey(owner, extension);
		await saveMessageFile(key, data);
		return json({ ok: true, done: true, key });
	} catch (error: any) {
		rmSync(dir, { recursive: true, force: true });
		logger.log(`❌ Error saving message file: ${error.message}`);
		return json({ ok: false, error: 'Could not save the file. Try again.' }, { status: 500 });
	}
}

export async function serveMessageFile(request: Request, owner: MessageOwner, filename: string): Promise<Response> {
	let key: string;
	try {
		key = messageFileKeyFor(owner, filename);
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400 });
	}

	const data = await readMessageFile(key);
	if (!data) return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });

	const headers = {
		'Content-Type': messageFileContentType(key),
		'Cache-Control': 'public, max-age=31536000, immutable',
		'Accept-Ranges': 'bytes',
		'X-Content-Type-Options': 'nosniff'
	};

	const range = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
	if (range && (range[1] || range[2])) {
		const size = data.length;
		const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
		const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
		if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
		return new Response(new Uint8Array(data.subarray(start, end + 1)), {
			status: 206,
			headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) }
		});
	}

	return new Response(new Uint8Array(data), { headers: { ...headers, 'Content-Length': String(data.length) } });
}
