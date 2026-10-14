import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTO_ENABLED_COMPONENTS, PUBLIC_STATISTICS_SUBFEATURES, SERVER_SETTINGS, publicSubfeatureEnabled } from '../src/lib/backend/panelServer.ts';
import {
	DEFAULT_SERVER_LANGUAGE,
	SERVER_LANGUAGES,
	SERVER_LANGUAGE_CODES,
	isServerLanguage,
	normalizeServerLanguage,
	serverLanguageEnglishName,
	serverLanguageFromDiscordLocale,
	serverLanguageLabel,
	serverLanguageList
} from '../src/lib/languages.ts';

test('language codes are unique and include the default', () => {
	assert.equal(new Set(SERVER_LANGUAGE_CODES).size, SERVER_LANGUAGE_CODES.length);
	assert.ok(SERVER_LANGUAGE_CODES.includes(DEFAULT_SERVER_LANGUAGE));
});

test('no Discord locale is claimed by two languages', () => {
	const locales = SERVER_LANGUAGES.flatMap((language) => [...language.discordLocales]);
	assert.equal(new Set(locales).size, locales.length);
});

test('unknown language codes fall back to the default', () => {
	assert.equal(isServerLanguage('id'), true);
	assert.equal(isServerLanguage('xx'), false);
	assert.equal(isServerLanguage(null), false);
	assert.equal(normalizeServerLanguage('zh-TW'), 'zh-TW');
	assert.equal(normalizeServerLanguage('xx'), DEFAULT_SERVER_LANGUAGE);
	assert.equal(normalizeServerLanguage(undefined), DEFAULT_SERVER_LANGUAGE);
});

test('labels show the native name with the English name when they differ', () => {
	assert.equal(serverLanguageLabel('en'), 'English');
	assert.equal(serverLanguageLabel('id'), 'Bahasa Indonesia (Indonesian)');
	assert.equal(serverLanguageLabel('xx'), 'xx');
	assert.equal(serverLanguageEnglishName('ja'), 'Japanese');
	assert.equal(serverLanguageEnglishName('xx'), 'English');
});

test('a Discord locale maps to its server language', () => {
	assert.equal(serverLanguageFromDiscordLocale('en-GB'), 'en');
	assert.equal(serverLanguageFromDiscordLocale('es-419'), 'es');
	assert.equal(serverLanguageFromDiscordLocale('zh-TW'), 'zh-TW');
	assert.equal(serverLanguageFromDiscordLocale('ko'), null);
	assert.equal(serverLanguageFromDiscordLocale(null), null);
});

test('the language list reads as a sentence', () => {
	const list = serverLanguageList('and');
	assert.ok(list.startsWith('English, Indonesian, '));
	assert.ok(list.endsWith(' and Japanese'));
	assert.ok(serverLanguageList('or').endsWith(' or Japanese'));
});

test('every settings component is keyed by its own id', () => {
	for (const [key, value] of Object.entries(SERVER_SETTINGS.component)) {
		assert.equal(key, value);
	}
	for (const id of SERVER_SETTINGS.withFeatureSwitch) {
		assert.ok(id in SERVER_SETTINGS.component, id);
	}
	for (const id of AUTO_ENABLED_COMPONENTS) {
		assert.ok(id in SERVER_SETTINGS.component, id);
	}
});

test('the settings tabs start with Main and Moderation, and labels fall back to the id', () => {
	assert.equal(SERVER_SETTINGS.configNavTabs[0].label, 'Main');
	assert.equal(SERVER_SETTINGS.configNavTabs[1].label, 'Moderation');
	assert.equal(new Set(SERVER_SETTINGS.configNavTabs.map((tab) => tab.href)).size, SERVER_SETTINGS.configNavTabs.length);
	assert.equal(SERVER_SETTINGS.featureLabel('leveling'), 'Leveling');
	assert.equal(SERVER_SETTINGS.featureLabel('nope'), 'nope');
});

test('public sub-features are on unless stored as false', () => {
	for (const feature of PUBLIC_STATISTICS_SUBFEATURES) {
		assert.equal(publicSubfeatureEnabled({}, feature), true);
		assert.equal(publicSubfeatureEnabled(null, feature), true);
		assert.equal(publicSubfeatureEnabled({ [`${feature}_enabled`]: false }, feature), false);
		assert.equal(publicSubfeatureEnabled({ [`${feature}_enabled`]: true }, feature), true);
	}
});
