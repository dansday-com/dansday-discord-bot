import { deleteObject, getObject, listObjectKeys, publicUrl, putObject } from './index.js';
import { imageContentType, imageFilenamePattern } from '../../images.js';

export const UPLOAD_FILENAME_PATTERN = imageFilenamePattern('\\d+-[a-z0-9]+');

export const NUMERIC_SCOPE = /[1-9]\d*/;

export function uploadFilename(extension: string): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}

export function uploadTimestampMs(key: string): number | null {
	const filename = String(key ?? '').slice(String(key ?? '').lastIndexOf('/') + 1);
	const value = Number(filename.replace(/\.[^.]+$/, '').split('-')[0]);
	return Number.isFinite(value) && value > 0 ? value : null;
}

export type UploadStore = {
	root: string;
	key(scopes: (string | number)[], filename: string): string;
	assertKey(key: string): string;
	isKey(key: unknown): boolean;
	scopesOf(key: unknown): string[] | null;
	belongsTo(key: unknown, ...scopes: (string | number)[]): boolean;
	url(key: string): string;
	contentType(key: string): string;
	save(key: string, data: Buffer): Promise<void>;
	read(key: string): Promise<Buffer | null>;
	remove(key: string): Promise<void>;
	list(): Promise<string[]>;
};

export function createUploadStore(root: string, scopePatterns: RegExp[]): UploadStore {
	const scopeBody = scopePatterns.map((pattern) => `(${pattern.source})`).join('/');
	const keyPattern = new RegExp(`^${root}/${scopeBody}/[^/]+$`);
	const exactScopes = scopePatterns.map((pattern) => new RegExp(`^(?:${pattern.source})$`));

	function assertKey(key: string): string {
		const value = String(key ?? '');
		if (!keyPattern.test(value) || value.includes('..') || value.includes('\\')) {
			throw new Error(`Invalid ${root} key: ${key}`);
		}
		return value;
	}

	function scopesOf(key: unknown): string[] | null {
		const match = String(key ?? '').match(keyPattern);
		return match ? match.slice(1, scopePatterns.length + 1) : null;
	}

	return {
		root,
		key(scopes, filename) {
			if (scopes.length !== scopePatterns.length) {
				throw new Error(`Expected ${scopePatterns.length} scope segment(s) for ${root}`);
			}
			const parts = scopes.map((scope, index) => {
				const value = String(scope);
				if (!exactScopes[index].test(value)) throw new Error(`Invalid ${root} scope: ${value}`);
				return value;
			});
			if (!UPLOAD_FILENAME_PATTERN.test(filename)) {
				throw new Error(`Invalid ${root} filename: ${filename}`);
			}
			return `${root}/${parts.join('/')}/${filename}`;
		},
		assertKey,
		isKey(key) {
			try {
				assertKey(key as string);
				return true;
			} catch {
				return false;
			}
		},
		scopesOf,
		belongsTo(key, ...scopes) {
			const owner = scopesOf(key);
			if (!owner || owner.length !== scopes.length) return false;
			return owner.every((value, index) => value === String(scopes[index]));
		},
		url(key) {
			return publicUrl(assertKey(key));
		},
		contentType(key) {
			return imageContentType(key);
		},
		async save(key, data) {
			await putObject(assertKey(key), data, imageContentType(key));
		},
		async read(key) {
			try {
				return await getObject(assertKey(key));
			} catch {
				return null;
			}
		},
		async remove(key) {
			try {
				await deleteObject(assertKey(key));
			} catch {}
		},
		async list() {
			try {
				return (await listObjectKeys(root)).filter((key) => keyPattern.test(key));
			} catch {
				return [];
			}
		}
	};
}
