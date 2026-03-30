import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './db.js';
import { getBotConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const translations = new Map<string, Record<string, any>>();
const defaultLang = 'en';

function loadTranslations() {
	const localesDir = join(__dirname, 'locales');
	const languages = ['en', 'id'];

	for (const lang of languages) {
		try {
			const filePath = join(localesDir, `${lang}.json`);
			if (existsSync(filePath)) {
				const content = readFileSync(filePath, 'utf-8');
				translations.set(lang, JSON.parse(content));
			}
		} catch {}
	}

	if (!translations.has(defaultLang)) {
		const enPath = join(localesDir, `${defaultLang}.json`);
		if (existsSync(enPath)) {
			try {
				const content = readFileSync(enPath, 'utf-8');
				translations.set(defaultLang, JSON.parse(content));
			} catch {}
		}
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
	} catch {
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
