import { json } from '@sveltejs/kit';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '$lib/utils/index.js';
import { IMAGE_SIGNATURE_HEX, imageSizeLabel } from '$lib/images.js';
import { MESSAGE_UPLOAD_CHUNK_BYTES, type MessageOwner } from '$lib/messages.js';
import { messageFileContentType, messageFileKey, messageFileKeyFor, readMessageFile, saveMessageFile } from '$lib/backend/storage/messageFiles.js';
import { attemptSync } from '$lib/utils/attempt.js';
import { HTTP } from '$lib/http.js';
import { HOUR_MS } from '$lib/utils/time.js';

const TEMP_ROOT = join(process.cwd(), 'data', 'tmp', 'message-uploads');
const STALE_MS = HOUR_MS;
const UPLOAD_ID = /^[a-z0-9]{12,32}$/;
const INTERRUPTED = 'The upload was interrupted. Pick the file again.';
const SNIFF_HEADER_BYTES = 12;
const FOURCC_BYTES = 4;
const PNG_MAGIC = Buffer.from(IMAGE_SIGNATURE_HEX.png, 'hex');
const JPEG_MAGIC = Buffer.from(IMAGE_SIGNATURE_HEX.jpeg, 'hex');
const EBML_MAGIC = Buffer.from('1a45dfa3', 'hex');

function sniffExtension(data: Buffer): string | null {
	const fourcc = (slot: number) => data.subarray(slot * FOURCC_BYTES, (slot + 1) * FOURCC_BYTES).toString('latin1');
	const startsWith = (magic: Buffer) => data.subarray(0, magic.length).equals(magic);
	if (data.length < SNIFF_HEADER_BYTES) {
		return null;
	}
	if (startsWith(PNG_MAGIC)) {
		return 'png';
	}
	if (startsWith(JPEG_MAGIC)) {
		return 'jpg';
	}
	if (fourcc(0) === 'GIF8') {
		return 'gif';
	}
	if (fourcc(0) === 'RIFF' && fourcc(2) === 'WEBP') {
		return 'webp';
	}
	if (startsWith(EBML_MAGIC)) {
		return 'webm';
	}
	if (fourcc(1) === 'ftyp') {
		return fourcc(2) === 'qt  ' ? 'mov' : 'mp4';
	}
	if (['moov', 'mdat', 'wide', 'free'].includes(fourcc(1))) {
		return 'mov';
	}
	return null;
}

function pruneStale() {
	if (!existsSync(TEMP_ROOT)) {
		return;
	}
	for (const name of readdirSync(TEMP_ROOT)) {
		const dir = join(TEMP_ROOT, name);
		try {
			if (Date.now() - statSync(dir).mtimeMs > STALE_MS) {
				rmSync(dir, { recursive: true, force: true });
			}
		} catch {}
	}
}

type UploadLimits = { limit: number; tooLarge: string; pruneUnused: () => Promise<unknown> };

export async function receiveMessageUpload(request: Request, owner: MessageOwner, { limit, tooLarge, pruneUnused }: UploadLimits): Promise<Response> {
	const uploadId = request.headers.get('x-upload-id') ?? '';
	const index = Number(request.headers.get('x-upload-index'));
	const total = Number(request.headers.get('x-upload-total'));
	if (!UPLOAD_ID.test(uploadId) || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
		return json({ ok: false, error: INTERRUPTED }, { status: HTTP.BAD_REQUEST });
	}
	const oversized = `That file is over the ${imageSizeLabel(limit)} upload limit. ${tooLarge}`;
	if (total > Math.ceil(limit / MESSAGE_UPLOAD_CHUNK_BYTES)) {
		return json({ ok: false, error: oversized }, { status: HTTP.BAD_REQUEST });
	}

	const dir = join(TEMP_ROOT, `${owner.scope}-${owner.id}-${uploadId}`);
	try {
		const chunk = Buffer.from(await request.arrayBuffer());
		if (chunk.length === 0 || chunk.length > MESSAGE_UPLOAD_CHUNK_BYTES) {
			return json({ ok: false, error: INTERRUPTED }, { status: HTTP.BAD_REQUEST });
		}

		if (index === 0) {
			pruneStale();
			pruneUnused().catch(() => null);
			rmSync(dir, { recursive: true, force: true });
			mkdirSync(dir, { recursive: true });
		} else if (!existsSync(dir)) {
			return json({ ok: false, error: INTERRUPTED }, { status: HTTP.BAD_REQUEST });
		}
		writeFileSync(join(dir, String(index)), chunk);

		const parts = Array.from({ length: index + 1 }, (_, i) => join(dir, String(i)));
		if (parts.some((part) => !existsSync(part))) {
			rmSync(dir, { recursive: true, force: true });
			return json({ ok: false, error: INTERRUPTED }, { status: HTTP.BAD_REQUEST });
		}
		if (parts.reduce((sum, part) => sum + statSync(part).size, 0) > limit) {
			rmSync(dir, { recursive: true, force: true });
			return json({ ok: false, error: oversized }, { status: HTTP.BAD_REQUEST });
		}
		if (index < total - 1) {
			return json({ ok: true, done: false });
		}

		const data = Buffer.concat(parts.map((part) => readFileSync(part)));
		rmSync(dir, { recursive: true, force: true });
		const extension = sniffExtension(data);
		if (!extension) {
			return json({ ok: false, error: 'Use a PNG, JPG, GIF or WEBP image, or an MP4, WEBM or MOV video.' }, { status: HTTP.BAD_REQUEST });
		}

		const key = messageFileKey(owner, extension);
		await saveMessageFile(key, data);
		return json({ ok: true, done: true, key });
	} catch (error) {
		rmSync(dir, { recursive: true, force: true });
		logger.log(`❌ Error saving message file: ${(error as Error).message}`);
		return json({ ok: false, error: 'Could not save the file. Try again.' }, { status: HTTP.INTERNAL_ERROR });
	}
}

export async function serveMessageFile(request: Request, owner: MessageOwner, filename: string): Promise<Response> {
	const resolved = attemptSync(() => messageFileKeyFor(owner, filename));
	if (!resolved.ok) {
		return new Response(JSON.stringify({ error: 'Invalid path' }), { status: HTTP.BAD_REQUEST });
	}
	const key = resolved.value;

	const data = await readMessageFile(key);
	if (!data) {
		return new Response(JSON.stringify({ error: 'File not found' }), { status: HTTP.NOT_FOUND });
	}

	const headers = {
		'Content-Type': messageFileContentType(key),
		'Cache-Control': 'public, max-age=31536000, immutable',
		'Accept-Ranges': 'bytes',
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "default-src 'none'; sandbox"
	};

	const range = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
	if (range && (range[1] || range[2])) {
		const size = data.length;
		const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
		const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
		if (start >= size || start > end) {
			return new Response(null, { status: HTTP.RANGE_NOT_SATISFIABLE, headers: { 'Content-Range': `bytes */${size}` } });
		}
		return new Response(new Uint8Array(data.subarray(start, end + 1)), {
			status: HTTP.PARTIAL_CONTENT,
			headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) }
		});
	}

	return new Response(new Uint8Array(data), { headers: { ...headers, 'Content-Length': String(data.length) } });
}
