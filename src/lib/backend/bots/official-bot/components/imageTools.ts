import { Type } from '@google/genai';
import { botAiImageEndpoint } from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { postJson, resolveToolUrl } from './aiToolHttp.js';

const IMAGE_PATH = '/images/generations';

const IMAGE_TIMEOUT_MS = 120_000;
const IMAGE_SIZE = '512x512';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_DESCRIPTION = `Draw a picture from a description and send it to the channel. Use this when a member asks you to draw, generate, make, create or render an image, picture, art, drawing, wallpaper, logo or edit of something.

Do not use this to look something up — search_web finds real photos and pages, while this invents a new picture. Do not use it when the user only wants a written answer or is talking about an image they already sent you.

One image per call. Write the prompt in English even when the user wrote another language, and describe subject, style and setting concretely.`;

export function imageConfigured(config) {
	const endpoint = botAiImageEndpoint(config);
	return Boolean(endpoint.api_url && endpoint.api_key && endpoint.model);
}

export async function runImageTool(config, args) {
	const endpoint = botAiImageEndpoint(config);
	if (!endpoint.api_url || !endpoint.api_key || !endpoint.model) return { ok: false, reason: 'image_generation_not_configured' };

	const prompt = String(args?.prompt ?? '').trim();
	if (!prompt) return { ok: false, reason: 'missing_prompt' };

	try {
		const payload = await postJson(
			resolveToolUrl(endpoint.api_url, IMAGE_PATH),
			endpoint.api_key,
			{ model: endpoint.model, prompt, size: IMAGE_SIZE, n: 1, response_format: 'b64_json' },
			IMAGE_TIMEOUT_MS
		);

		const entry = Array.isArray(payload?.data) ? payload.data[0] : null;
		if (!entry) return { ok: false, reason: 'no_image_returned' };

		if (entry.b64_json) {
			const buffer = Buffer.from(entry.b64_json, 'base64');
			if (!buffer.byteLength) return { ok: false, reason: 'no_image_returned' };
			if (buffer.byteLength > MAX_IMAGE_BYTES) return { ok: false, reason: 'image_too_large' };
			return { ok: true, prompt, buffer };
		}

		if (entry.url) return { ok: true, prompt, url: entry.url };

		return { ok: false, reason: 'no_image_returned' };
	} catch (error) {
		await logger.log(`❌ Image generation failed: ${error.message}`);
		return { ok: false, reason: error.name === 'AbortError' ? 'timeout' : 'image_generation_failed' };
	}
}

export function buildImageTool(config) {
	if (!imageConfigured(config)) return null;

	return {
		type: 'function',
		function: {
			name: 'generate_image',
			description: `${IMAGE_DESCRIPTION}

After it succeeds the picture is posted automatically, so just say one short line about it — never describe the image in detail, never claim you cannot send images, and never paste a URL.`,
			parameters: {
				type: 'object',
				properties: {
					prompt: {
						type: 'string',
						description: 'What to draw, in English. Describe the subject, style and setting concretely rather than repeating the user words verbatim.'
					}
				},
				required: ['prompt']
			}
		}
	};
}

export function buildImageDeclaration(config) {
	if (!imageConfigured(config)) return null;

	return {
		name: 'generate_image',
		description: `${IMAGE_DESCRIPTION}

Say one short line out loud like "drawing that now" before it runs, because it takes a while. When it succeeds the picture is posted into this voice channel's chat automatically — say one short spoken line telling them to look at the chat. If it comes back not ok, say plainly out loud that you could not send the picture. Never try to describe the picture in detail out loud, and never read a URL aloud.`,
		parameters: {
			type: Type.OBJECT,
			properties: {
				prompt: { type: Type.STRING, description: 'What to draw, in English, describing subject, style and setting concretely.' }
			},
			required: ['prompt']
		}
	};
}

export default { imageConfigured, buildImageTool, buildImageDeclaration, runImageTool };
