import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SERVER_LANGUAGE, SERVER_LANGUAGE_CODES } from '../src/lib/languages.ts';
import { loadedLocales, t } from '../src/lib/localeStore.ts';

type Flat = Record<string, unknown>;

const LOCALES_DIR = fileURLToPath(new URL('../src/lib/backend/bots/official-bot/locales/', import.meta.url));
const SINGULAR_WITHOUT_COUNT = ['ar:tasks.streak.day'];

function flatten(value: unknown, prefix = '', out: Flat = {}): Flat {
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (child && typeof child === 'object' && !Array.isArray(child)) {
			flatten(child, path, out);
		} else {
			out[path] = child;
		}
	}
	return out;
}

const kindOf = (value: unknown) => (Array.isArray(value) ? 'array' : typeof value);
const placeholders = (value: unknown) => (typeof value === 'string' ? [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]) : []);

const locales = new Map<string, Flat>();
for (const file of readdirSync(LOCALES_DIR).filter((name) => name.endsWith('.json'))) {
	locales.set(file.replace(/\.json$/, ''), flatten(JSON.parse(readFileSync(`${LOCALES_DIR}${file}`, 'utf8'))));
}
const english = locales.get(DEFAULT_SERVER_LANGUAGE) ?? {};
const englishKeys = Object.keys(english);

test('there is one locale file per server language', () => {
	assert.deepEqual([...locales.keys()].sort(), [...SERVER_LANGUAGE_CODES].sort());
	assert.ok(englishKeys.length > 0);
});

test('every locale has exactly the English keys', () => {
	for (const [language, strings] of locales) {
		assert.deepEqual(
			englishKeys.filter((key) => !(key in strings)),
			[],
			`${language} is missing keys`
		);
		assert.deepEqual(
			Object.keys(strings).filter((key) => !(key in english)),
			[],
			`${language} has keys English does not`
		);
	}
});

test('every translation has the same kind of value as English and is not blank', () => {
	for (const [language, strings] of locales) {
		const wrongKind = englishKeys.filter((key) => kindOf(strings[key]) !== kindOf(english[key]));
		assert.deepEqual(wrongKind, [], `${language} has values of a different kind`);
		const blank = englishKeys.filter((key) => typeof strings[key] === 'string' && !String(strings[key]).trim() && String(english[key]).trim());
		assert.deepEqual(blank, [], `${language} has blank strings`);
	}
});

test('translations only use placeholders that English defines', () => {
	for (const [language, strings] of locales) {
		const unknown = englishKeys.filter((key) => placeholders(strings[key]).some((name) => !placeholders(english[key]).includes(name)));
		assert.deepEqual(unknown, [], `${language} uses placeholders English does not have`);
	}
});

test('translations keep every English placeholder, apart from the known singular form', () => {
	const dropped: string[] = [];
	for (const [language, strings] of locales) {
		for (const key of englishKeys) {
			if (placeholders(english[key]).some((name) => !placeholders(strings[key]).includes(name))) {
				dropped.push(`${language}:${key}`);
			}
		}
	}
	assert.deepEqual(dropped, SINGULAR_WITHOUT_COUNT);
});

test('every translation key the code asks for exists in English', () => {
	const sourceDir = fileURLToPath(new URL('../src/', import.meta.url));
	const used = new Set<string>();
	for (const entry of readdirSync(sourceDir, { recursive: true, encoding: 'utf8' })) {
		if (!/\.(ts|svelte)$/.test(entry)) {
			continue;
		}
		const source = readFileSync(`${sourceDir}${entry}`, 'utf8');
		for (const match of source.matchAll(/\b(?:translate|tr|t)\(\s*['"]([a-zA-Z]\w*(?:\.\w+)+)['"]/g)) {
			used.add(match[1]);
		}
	}
	assert.ok(used.size > 100);
	const missing = [...used].filter((key) => !(key in english) && !englishKeys.some((known) => known.startsWith(`${key}.`)));
	assert.deepEqual(missing, []);
});

test('the locale store loads every language and fills in parameters', () => {
	assert.equal(t('tasks.streak.days', 'en', { count: 3 }), '3 days');
	assert.deepEqual([...loadedLocales()].sort(), [...SERVER_LANGUAGE_CODES].sort());
});

test('the locale store falls back to English, then to the key itself', () => {
	assert.equal(t('tasks.streak.days', 'xx', { count: 3 }), '3 days');
	assert.equal(t('no.such.key'), 'no.such.key');
	assert.equal(t(''), '');
});
