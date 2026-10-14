import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	imageContentType,
	imageExtension,
	imageFilenamePattern,
	imageSizeLabel,
	sniffBotProfileImage,
	tooLargeMessage,
	unsupportedFormatMessage
} from '../src/lib/images.ts';

test('imageContentType maps known extensions and falls back to a download type', () => {
	assert.equal(imageContentType('a.png'), 'image/png');
	assert.equal(imageContentType('a.JPG'), 'image/jpeg');
	assert.equal(imageContentType('a.b.jpeg'), 'image/jpeg');
	assert.equal(imageContentType('a.gif'), 'image/gif');
	assert.equal(imageContentType('a.webp'), 'image/webp');
	assert.equal(imageContentType('a.svg'), 'application/octet-stream');
	assert.equal(imageContentType('noextension'), 'application/octet-stream');
});

test('imageExtension accepts extensions and MIME types for the supported formats only', () => {
	assert.equal(imageExtension('png'), 'png');
	assert.equal(imageExtension(' JPEG '), 'jpg');
	assert.equal(imageExtension('image/jpeg'), 'jpg');
	assert.equal(imageExtension('image/webp'), 'webp');
	assert.equal(imageExtension('image/svg+xml'), null);
	assert.equal(imageExtension('exe'), null);
	assert.equal(imageExtension(null), null);
});

test('imageFilenamePattern matches the whole name and nothing around it', () => {
	const pattern = imageFilenamePattern('\\d+-[a-z0-9]+');
	assert.equal(pattern.test('1700000000-abc123.png'), true);
	assert.equal(pattern.test('1700000000-abc123.JPEG'), true);
	assert.equal(pattern.test('1700000000-abc123.svg'), false);
	assert.equal(pattern.test('../1700000000-abc123.png'), false);
	assert.equal(pattern.test('1700000000-abc123.png.exe'), false);
});

test('imageSizeLabel prints megabytes without a trailing zero and rounds kilobytes', () => {
	assert.equal(imageSizeLabel(2 * 1024 * 1024), '2MB');
	assert.equal(imageSizeLabel(1.5 * 1024 * 1024), '1.5MB');
	assert.equal(imageSizeLabel(512 * 1024), '512KB');
	assert.equal(imageSizeLabel(1500), '1KB');
});

test('upload error messages name the limit and the supported formats', () => {
	assert.equal(tooLargeMessage(4 * 1024 * 1024), 'Image file is too large. Maximum size is 4MB');
	assert.equal(unsupportedFormatMessage(), 'Unsupported image format. Supported: PNG, JPG, GIF, WEBP');
});

test('sniffBotProfileImage trusts the leading bytes, not the filename', () => {
	assert.equal(sniffBotProfileImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), 'image/png');
	assert.equal(sniffBotProfileImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
	assert.equal(sniffBotProfileImage(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), 'image/gif');
	assert.equal(sniffBotProfileImage(new Uint8Array([0x52, 0x49, 0x46, 0x46])), null);
	assert.equal(sniffBotProfileImage(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null);
	assert.equal(sniffBotProfileImage(new Uint8Array([])), null);
});
