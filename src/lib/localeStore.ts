import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_SERVER_LANGUAGE, SERVER_LANGUAGE_CODES } from './languages.js';

const LOCALES_PATH = 'src/lib/backend/bots/official-bot/locales';
const moduleDir = dirname(fileURLToPath(import.meta.url));
const translations = new Map<string, Record<string, any>>();

function resolveLocalesDir(): string | null {
	const candidates = [join(moduleDir, 'backend/bots/official-bot/locales')];
	let dir = moduleDir;
	for (let i = 0; i < 24; i++) {
		candidates.push(join(dir, LOCALES_PATH));
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	candidates.push(join(process.cwd(), LOCALES_PATH), join(process.cwd(), 'locales'));
	return candidates.find((candidate) => existsSync(join(candidate, 'en.json'))) ?? null;
}

function loadTranslations() {
	const localesDir = resolveLocalesDir();
	if (!localesDir) return;

	for (const lang of SERVER_LANGUAGE_CODES) {
		try {
			const filePath = join(localesDir, `${lang}.json`);
			if (existsSync(filePath)) translations.set(lang, JSON.parse(readFileSync(filePath, 'utf-8')));
		} catch (_) {}
	}
}

loadTranslations();

function lookup(lang: string, keys: string[]): any {
	let value: any = translations.get(lang);
	for (const k of keys) {
		value = value?.[k];
		if (value == null || value === '') return undefined;
	}
	return value;
}

export function localeValue(key: string, lang: string = DEFAULT_SERVER_LANGUAGE): any {
	if (!key) return undefined;
	const keys = key.split('.');
	return lookup(lang, keys) ?? lookup(DEFAULT_SERVER_LANGUAGE, keys);
}

export function t(key: string, lang: string = DEFAULT_SERVER_LANGUAGE, params: Record<string, any> = {}): any {
	if (!key) return '';
	let value = localeValue(key, lang);
	if (value === undefined) return key;

	if (typeof value === 'string') {
		value = value.replace(/\\n/g, '\n');
		if (Object.keys(params).length > 0) {
			value = value.replace(/\{(\w+)\}/g, (_match: string, paramKey: string) => {
				return params[paramKey] !== undefined ? String(params[paramKey]) : _match;
			});
		}
	}

	return value;
}

export function loadedLocales(): string[] {
	return Array.from(translations.keys());
}
