import db from '../../../database.js';
import { getBotConfig, SERVER_SETTINGS } from '../../config.js';
import { loadedLocales, t } from '../../../localeStore.js';
import { DEFAULT_SERVER_LANGUAGE, isServerLanguage, normalizeServerLanguage, serverLanguageEnglishName, type ServerLanguage } from '../../../languages.js';

export { t };

const defaultLang = DEFAULT_SERVER_LANGUAGE;

const SERVER_LANGUAGE_TTL_MS = 60_000;
const serverLanguageCache = new Map<string, { lang: ServerLanguage; at: number }>();

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

const API_ERROR_REASONS: Record<number, string> = {
	10003: 'unknownChannel',
	10007: 'unknownMember',
	10011: 'unknownRole',
	30005: 'maxRoles',
	50001: 'missingAccess',
	50013: 'missingPermissions',
	50035: 'invalidInput'
};

export function errorReasonFor(tr: Translator, error: any): string {
	return tr(`common.errors.reasons.${API_ERROR_REASONS[error?.code] ?? 'unexpected'}`);
}

export async function errorReason(error: any, guildId: string, userId: string): Promise<string> {
	return errorReasonFor(await memberTranslator(guildId, userId), error);
}

export async function aiLanguageInstruction(guildId: string, medium: 'chat' | 'voice'): Promise<string> {
	const name = serverLanguageEnglishName(await getServerLanguage(guildId));
	return medium === 'voice'
		? `This server's language is ${name}. Speak ${name} by default, including greetings and short acknowledgements. If the person talking to you clearly speaks another language, answer in theirs.`
		: `This server's language is ${name}. Reply in ${name} by default. If the person clearly writes to you in another language, reply in the language they wrote in.`;
}

export function getAvailableLanguages(): string[] {
	return loadedLocales();
}
