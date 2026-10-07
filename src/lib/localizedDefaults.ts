import { APP_DOMAIN } from './frontend/panelServer.js';
import { localeValue, t } from './localeStore.js';
import { DEFAULT_SERVER_LANGUAGE, SERVER_LANGUAGE_CODES, normalizeServerLanguage, type ServerLanguage } from './languages.js';

export type GreetingKind = 'welcomer' | 'leaver' | 'booster';

export function defaultGreetingMessages(kind: GreetingKind, lang: unknown = DEFAULT_SERVER_LANGUAGE): string[] {
	const messages = localeValue(`${kind}.defaultMessages`, normalizeServerLanguage(lang));
	return Array.isArray(messages) ? messages : [];
}

const allGreetingDefaults = new Map<GreetingKind, Set<string>>();

function greetingDefaultsInAnyLanguage(kind: GreetingKind): Set<string> {
	let set = allGreetingDefaults.get(kind);
	if (!set) {
		set = new Set(SERVER_LANGUAGE_CODES.flatMap((lang) => defaultGreetingMessages(kind, lang)));
		allGreetingDefaults.set(kind, set);
	}
	return set;
}

export function isDefaultGreetingSet(kind: GreetingKind, messages: unknown): boolean {
	if (!Array.isArray(messages) || messages.length === 0) return true;
	const defaults = greetingDefaultsInAnyLanguage(kind);
	return messages.every((m) => typeof m === 'string' && defaults.has(m));
}

export function greetingMessagesFor(kind: GreetingKind, messages: unknown, lang: unknown): string[] {
	return isDefaultGreetingSet(kind, messages) ? defaultGreetingMessages(kind, lang) : (messages as string[]);
}

export function defaultMainEmbedFooter(lang: unknown): string {
	return t('common.defaultFooter', normalizeServerLanguage(lang), { domain: APP_DOMAIN });
}

export function defaultMainEmbedFooters(): Record<ServerLanguage, string> {
	return Object.fromEntries(SERVER_LANGUAGE_CODES.map((lang) => [lang, defaultMainEmbedFooter(lang)])) as Record<ServerLanguage, string>;
}

export function isDefaultMainEmbedFooter(footer: string): boolean {
	return Object.values(defaultMainEmbedFooters()).includes(footer);
}
