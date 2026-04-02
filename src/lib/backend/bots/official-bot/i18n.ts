import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db from '../../../database.js';
import { getBotConfig } from '../../config.js';

const translations = new Map<string, Record<string, any>>();
const defaultLang = 'en';

const _i18nDir = dirname(fileURLToPath(import.meta.url));
const _localesDir = join(_i18nDir, 'locales');

function loadTranslations() {
	const languages = ['en', 'id'];

	let localesDir = _localesDir;
	if (!existsSync(join(localesDir, 'en.json'))) localesDir = join(process.cwd(), 'locales');
	if (!existsSync(join(localesDir, 'en.json'))) return;

	for (const lang of languages) {
		try {
			const filePath = join(localesDir, `${lang}.json`);
			if (existsSync(filePath)) {
				const content = readFileSync(filePath, 'utf-8');
				translations.set(lang, JSON.parse(content));
			}
		} catch (_) {}
	}
}

loadTranslations();

export async function getUserLanguage(guildId: string, userId: string): Promise<string> {
	try {
		if (!guildId || !userId) return defaultLang;

		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) return defaultLang;

		const server = await db.getServerByDiscordId(botConfig.id, guildId);
		if (server) {
			const member = await db.getMemberByDiscordId(server.id, userId);
			if (member?.language) return member.language;
		}

		return defaultLang;
	} catch (_) {
		return defaultLang;
	}
}

export function t(key: string, lang = defaultLang, params: Record<string, any> = {}): any {
	if (!key) return '';

	const langTranslations = translations.get(lang) || translations.get(defaultLang);
	if (!langTranslations) return key;

	const keys = key.split('.');
	let value: any = langTranslations;

	for (const k of keys) {
		value = value?.[k];
		if (!value) {
			const enTranslations = translations.get(defaultLang);
			if (enTranslations) {
				let enValue: any = enTranslations;
				for (const enKey of keys) {
					enValue = enValue?.[enKey];
					if (!enValue) break;
				}
				if (enValue) {
					value = enValue;
					break;
				}
			}
			if (!value) return key;
		}
	}

	if (typeof value === 'string') {
		value = value.replace(/\\n/g, '\n');
		if (Object.keys(params).length > 0) {
			value = value.replace(/\{(\w+)\}/g, (_match: string, paramKey: string) => {
				return params[paramKey] !== undefined ? String(params[paramKey]) : _match;
			});
		}
	}

	return value || key;
}

export async function translate(key: string, guildId: string, userId: string, params: Record<string, any> = {}) {
	const lang = await getUserLanguage(guildId, userId);
	return t(key, lang, params);
}

export function getAvailableLanguages(): string[] {
	return Array.from(translations.keys());
}
