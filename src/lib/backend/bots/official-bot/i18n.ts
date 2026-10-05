import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db from '../../../database.js';
import { getBotConfig, SERVER_SETTINGS } from '../../config.js';
import {
	DEFAULT_SERVER_LANGUAGE,
	SERVER_LANGUAGE_CODES,
	isServerLanguage,
	normalizeServerLanguage,
	serverLanguageEnglishName,
	type ServerLanguage
} from '../../../languages.js';

const translations = new Map<string, Record<string, any>>();
const defaultLang = DEFAULT_SERVER_LANGUAGE;

const SERVER_LANGUAGE_TTL_MS = 60_000;
const serverLanguageCache = new Map<string, { lang: ServerLanguage; at: number }>();

const _i18nDir = dirname(fileURLToPath(import.meta.url));
const _localesDir = join(_i18nDir, 'locales');

function resolveLocalesDir(): string | null {
	if (existsSync(join(_localesDir, 'en.json'))) return _localesDir;

	let dir = _i18nDir;
	for (let i = 0; i < 24; i++) {
		const candidate = join(dir, 'src/lib/backend/bots/official-bot/locales');
		if (existsSync(join(candidate, 'en.json'))) return candidate;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	const fromCwd = join(process.cwd(), 'src/lib/backend/bots/official-bot/locales');
	if (existsSync(join(fromCwd, 'en.json'))) return fromCwd;
	const cwdLocales = join(process.cwd(), 'locales');
	if (existsSync(join(cwdLocales, 'en.json'))) return cwdLocales;
	return null;
}

function loadTranslations() {
	const languages = SERVER_LANGUAGE_CODES;

	const localesDir = resolveLocalesDir();
	if (!localesDir) return;

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

export function rememberServerLanguage(guildId: string, lang: unknown) {
	if (!guildId) return;
	serverLanguageCache.set(guildId, { lang: normalizeServerLanguage(lang), at: Date.now() });
}

export async function getServerLanguage(guildId: string): Promise<ServerLanguage> {
	if (!guildId) return defaultLang;
	const cached = serverLanguageCache.get(guildId);
	if (cached && Date.now() - cached.at < SERVER_LANGUAGE_TTL_MS) return cached.lang;

	try {
		const botConfig = getBotConfig();
		if (!botConfig?.id) return defaultLang;
		const server = await db.getServerByDiscordId(botConfig.id, guildId);
		const row = server ? await db.getServerSettings(server.id, SERVER_SETTINGS.component.main) : null;
		const settings = row?.settings && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};
		rememberServerLanguage(guildId, settings.language);
		return normalizeServerLanguage(settings.language);
	} catch (_) {
		return cached?.lang ?? defaultLang;
	}
}

export async function getUserLanguage(guildId: string, userId: string): Promise<string> {
	try {
		if (!guildId) return defaultLang;
		if (!userId || userId === '0') return getServerLanguage(guildId);

		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) return defaultLang;

		const server = await db.getServerByDiscordId(botConfig.id, guildId);
		if (server) {
			const member = await db.getMemberByDiscordId(server.id, userId);
			if (isServerLanguage(member?.language)) return member.language;
		}

		return getServerLanguage(guildId);
	} catch (_) {
		return defaultLang;
	}
}

export function t(key: string, lang: string = defaultLang, params: Record<string, any> = {}): any {
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

export async function translateServer(key: string, guildId: string, params: Record<string, any> = {}) {
	return t(key, await getServerLanguage(guildId), params);
}

export type Translator = ((key: string, params?: Record<string, any>) => string) & { lang: string };

export function translatorFor(lang: string): Translator {
	const tr = ((key: string, params: Record<string, any> = {}) => t(key, lang, params)) as Translator;
	tr.lang = lang;
	return tr;
}

export async function serverTranslator(guildId: string): Promise<Translator> {
	return translatorFor(await getServerLanguage(guildId));
}

export async function memberTranslator(guildId: string, userId: string): Promise<Translator> {
	return translatorFor(await getUserLanguage(guildId, userId));
}

export async function aiLanguageInstruction(guildId: string, medium: 'chat' | 'voice'): Promise<string> {
	const name = serverLanguageEnglishName(await getServerLanguage(guildId));
	return medium === 'voice'
		? `This server's language is ${name}. Speak ${name} by default, including greetings and short acknowledgements. If the person talking to you clearly speaks another language, answer in theirs.`
		: `This server's language is ${name}. Reply in ${name} by default. If the person clearly writes to you in another language, reply in the language they wrote in.`;
}

export function getAvailableLanguages(): string[] {
	return Array.from(translations.keys());
}
