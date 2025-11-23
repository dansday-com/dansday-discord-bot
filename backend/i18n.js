import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../database/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const translations = new Map();
const defaultLang = 'en';

function loadTranslations() {
    const localesDir = join(__dirname, 'locales');

    const languages = ['en', 'id', 'es', 'fr', 'de', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi', 'tr', 'pl', 'nl', 'it'];

    for (const lang of languages) {
        try {
            const filePath = join(localesDir, `${lang}.json`);
            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                translations.set(lang, JSON.parse(content));
            }
        } catch (error) {
        }
    }

    if (!translations.has(defaultLang)) {
        const enPath = join(localesDir, `${defaultLang}.json`);
        if (existsSync(enPath)) {
            try {
                const content = readFileSync(enPath, 'utf-8');
                translations.set(defaultLang, JSON.parse(content));
            } catch (error) {
                console.error(`Failed to load default language (${defaultLang}):`, error);
            }
        }
    }
}

loadTranslations();

/**
 * Get user's preferred language from database
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @returns {Promise<string>} Language code (default: 'en')
 */
export async function getUserLanguage(guildId, userId) {
    try {
        if (!guildId || !userId) {
            return defaultLang;
        }

        const { getBotConfig } = await import('./config.js');
        const botConfig = getBotConfig();
        if (!botConfig || !botConfig.id) {
            return defaultLang;
        }

        const server = await db.getServerByDiscordId(botConfig.id, guildId);
        if (server) {
            const member = await db.getMemberByDiscordId(server.id, userId);
            if (member?.language) {
                return member.language;
            }
        }

        return defaultLang;
    } catch (error) {
        return defaultLang;
    }
}

/**
 * Translate a key to the specified language
 * @param {string} key - Translation key (supports nested keys like "leveling.profile.title")
 * @param {string} lang - Language code (default: 'en')
 * @param {object} params - Parameters to replace in the translation (e.g., {member: "John", level: 5})
 * @returns {string} Translated text or key if not found
 */
export function t(key, lang = defaultLang, params = {}) {
    if (!key) return '';

    const langTranslations = translations.get(lang) || translations.get(defaultLang);

    if (!langTranslations) {
        return key;
    }

    const keys = key.split('.');
    let value = langTranslations;

    for (const k of keys) {
        value = value?.[k];
        if (!value) {
            const enTranslations = translations.get(defaultLang);
            if (enTranslations) {
                let enValue = enTranslations;
                for (const enKey of keys) {
                    enValue = enValue?.[enKey];
                    if (!enValue) break;
                }
                if (enValue) {
                    value = enValue;
                    break;
                }
            }
            if (!value) {
                return key;
            }
        }
    }

    if (typeof value === 'string' && Object.keys(params).length > 0) {
        return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
            return params[paramKey] !== undefined ? String(params[paramKey]) : match;
        });
    }

    return value || key;
}

/**
 * Translate a key for a specific user (uses their language preference)
 * @param {string} key - Translation key
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @param {object} params - Parameters to replace in the translation
 * @returns {Promise<string>} Translated text
 */
export async function translate(key, guildId, userId, params = {}) {
    const lang = await getUserLanguage(guildId, userId);
    return t(key, lang, params);
}

/**
 * Get all available languages
 * @returns {string[]} Array of language codes
 */
export function getAvailableLanguages() {
    return Array.from(translations.keys());
}

/**
 * Check if a language is available
 * @param {string} lang - Language code
 * @returns {boolean} True if language is available
 */
export function isLanguageAvailable(lang) {
    return translations.has(lang);
}
