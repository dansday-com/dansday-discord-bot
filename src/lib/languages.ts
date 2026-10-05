export const SERVER_LANGUAGES = [
	{ code: 'en', name: 'English', englishName: 'English', discordLocales: ['en-US', 'en-GB'] },
	{ code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', discordLocales: ['id'] },
	{ code: 'de', name: 'Deutsch', englishName: 'German', discordLocales: ['de'] },
	{ code: 'es', name: 'Español', englishName: 'Spanish', discordLocales: ['es-ES', 'es-419'] },
	{ code: 'fr', name: 'Français', englishName: 'French', discordLocales: ['fr'] },
	{ code: 'it', name: 'Italiano', englishName: 'Italian', discordLocales: ['it'] },
	{ code: 'nl', name: 'Nederlands', englishName: 'Dutch', discordLocales: ['nl'] },
	{ code: 'ar', name: 'العربية', englishName: 'Arabic', discordLocales: [] },
	{ code: 'ms', name: 'Bahasa Melayu', englishName: 'Malay', discordLocales: [] },
	{ code: 'zh', name: '简体中文', englishName: 'Simplified Chinese', discordLocales: ['zh-CN', 'zh-TW'] },
	{ code: 'ja', name: '日本語', englishName: 'Japanese', discordLocales: ['ja'] }
] as const;

export type ServerLanguage = (typeof SERVER_LANGUAGES)[number]['code'];

export const DEFAULT_SERVER_LANGUAGE: ServerLanguage = 'en';

export const SERVER_LANGUAGE_CODES: ServerLanguage[] = SERVER_LANGUAGES.map((l) => l.code);

export function isServerLanguage(value: unknown): value is ServerLanguage {
	return typeof value === 'string' && (SERVER_LANGUAGE_CODES as string[]).includes(value);
}

export function normalizeServerLanguage(value: unknown): ServerLanguage {
	return isServerLanguage(value) ? value : DEFAULT_SERVER_LANGUAGE;
}

export function serverLanguageName(code: unknown): string {
	return SERVER_LANGUAGES.find((l) => l.code === code)?.name ?? String(code ?? '');
}

export function serverLanguageEnglishName(code: unknown): string {
	return SERVER_LANGUAGES.find((l) => l.code === code)?.englishName ?? 'English';
}

export function serverLanguageFromDiscordLocale(locale: unknown): ServerLanguage | null {
	if (typeof locale !== 'string') return null;
	return SERVER_LANGUAGES.find((l) => (l.discordLocales as readonly string[]).includes(locale))?.code ?? null;
}

export function serverLanguageList(conjunction: 'and' | 'or'): string {
	const names = SERVER_LANGUAGES.map((l) => l.englishName);
	return `${names.slice(0, -1).join(', ')} ${conjunction} ${names[names.length - 1]}`;
}
