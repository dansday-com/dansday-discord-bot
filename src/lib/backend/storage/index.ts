import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { S3Client } from '@aws-sdk/client-s3';

export type StorageMode = 'local' | 's3';

type S3Settings = {
	bucket: string;
	region: string;
	endpoint: string | null;
	accessKeyId: string;
	secretAccessKey: string;
	forcePathStyle: boolean;
	prefix: string;
	publicUrl: string | null;
};

const localRoot = join(process.cwd(), 'data');

let cachedSettings: S3Settings | null | undefined;
let cachedClient: Promise<S3Client> | null = null;

function env(name: string): string {
	return (process.env[name] ?? '').trim();
}

function s3Settings(): S3Settings | null {
	if (cachedSettings !== undefined) return cachedSettings;

	const driver = env('STORAGE_DRIVER').toLowerCase();
	const bucket = env('S3_BUCKET');
	const accessKeyId = env('S3_ACCESS_KEY_ID');
	const secretAccessKey = env('S3_SECRET_ACCESS_KEY');

	if (driver === 'local' || !bucket || !accessKeyId || !secretAccessKey) {
		cachedSettings = null;
		return cachedSettings;
	}

	const endpoint = env('S3_ENDPOINT') || null;
	const pathStyle = env('S3_FORCE_PATH_STYLE').toLowerCase();

	cachedSettings = {
		bucket,
		region: env('S3_REGION') || 'auto',
		endpoint,
		accessKeyId,
		secretAccessKey,
		forcePathStyle: pathStyle ? pathStyle === 'true' : endpoint != null,
		prefix: env('S3_PREFIX').replace(/^\/+|\/+$/g, ''),
		publicUrl: env('S3_PUBLIC_URL').replace(/\/+$/, '') || null
	};
	return cachedSettings;
}

export function storageMode(): StorageMode {
	return s3Settings() ? 's3' : 'local';
}

export function publicUrl(key: string): string {
	const settings = s3Settings();
	if (!settings?.publicUrl) return `/api/uploads/${safeKey(key)}`;
	return `${settings.publicUrl}/${remoteKey(settings, key)}`;
}

async function s3(settings: S3Settings): Promise<S3Client> {
	if (!cachedClient) {
		cachedClient = import('@aws-sdk/client-s3').then(
			(mod) =>
				new mod.S3Client({
					region: settings.region,
					endpoint: settings.endpoint ?? undefined,
					forcePathStyle: settings.forcePathStyle,
					credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey }
				})
		);
	}
	return cachedClient;
}

function safeKey(key: string): string {
	const cleaned = key.replace(/\\/g, '/').replace(/^\/+/, '');
	const segments = cleaned.split('/');
	if (!cleaned || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
		throw new Error(`Invalid storage key: ${key}`);
	}
	return cleaned;
}

function localPath(key: string): string {
	return join(localRoot, ...safeKey(key).split('/'));
}

function remoteKey(settings: S3Settings, key: string): string {
	const cleaned = safeKey(key);
	return settings.prefix ? `${settings.prefix}/${cleaned}` : cleaned;
}

function isMissing(error: any): boolean {
	const status = error?.$metadata?.httpStatusCode;
	return status === 404 || error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.Code === 'NoSuchKey';
}

export async function putObject(key: string, data: Buffer, contentType: string): Promise<void> {
	const settings = s3Settings();

	if (!settings) {
		const path = localPath(key);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, data);
		return;
	}

	const { PutObjectCommand } = await import('@aws-sdk/client-s3');
	const client = await s3(settings);
	await client.send(
		new PutObjectCommand({
			Bucket: settings.bucket,
			Key: remoteKey(settings, key),
			Body: data,
			ContentType: contentType,
			ContentLength: data.length
		})
	);
}

export async function getObject(key: string): Promise<Buffer | null> {
	const settings = s3Settings();

	if (!settings) {
		const path = localPath(key);
		if (!existsSync(path)) return null;
		try {
			return readFileSync(path);
		} catch {
			return null;
		}
	}

	const { GetObjectCommand } = await import('@aws-sdk/client-s3');
	const client = await s3(settings);
	try {
		const result = await client.send(new GetObjectCommand({ Bucket: settings.bucket, Key: remoteKey(settings, key) }));
		if (!result.Body) return null;
		return Buffer.from(await result.Body.transformToByteArray());
	} catch (error) {
		if (isMissing(error)) return null;
		throw error;
	}
}

export async function deleteObject(key: string): Promise<void> {
	const settings = s3Settings();

	if (!settings) {
		const path = localPath(key);
		try {
			if (existsSync(path)) unlinkSync(path);
		} catch {}
		return;
	}

	const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
	const client = await s3(settings);
	try {
		await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: remoteKey(settings, key) }));
	} catch (error) {
		if (!isMissing(error)) throw error;
	}
}

export async function listObjectKeys(folder: string): Promise<string[]> {
	const settings = s3Settings();
	const cleaned = safeKey(folder);

	if (!settings) {
		const dir = localPath(cleaned);
		if (!existsSync(dir)) return [];
		try {
			return readdirSync(dir)
				.filter((name) => {
					try {
						return statSync(join(dir, name)).isFile();
					} catch {
						return false;
					}
				})
				.map((name) => `${cleaned}/${name}`);
		} catch {
			return [];
		}
	}

	const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
	const client = await s3(settings);
	const scope = remoteKey(settings, cleaned);
	const strip = settings.prefix ? settings.prefix.length + 1 : 0;
	const keys: string[] = [];
	let token: string | undefined;

	do {
		const result = await client.send(new ListObjectsV2Command({ Bucket: settings.bucket, Prefix: `${scope}/`, ContinuationToken: token }));
		for (const item of result.Contents ?? []) {
			if (!item.Key || item.Key.endsWith('/')) continue;
			keys.push(item.Key.slice(strip));
		}
		token = result.IsTruncated ? result.NextContinuationToken : undefined;
	} while (token);

	return keys;
}
