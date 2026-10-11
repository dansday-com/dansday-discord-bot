import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	computeIndexedSlugForItemId,
	formatIndexedSlug,
	listIndexedSlugsForItems,
	parseIndexedSlug,
	resolveIndexedSlugToItem,
	slugifyDisplayName
} from '../src/lib/utils/slug.ts';

const servers = [
	{ id: 3, name: 'Same', updated_at: 'c' },
	{ id: 1, name: 'same', updated_at: 'a' },
	{ id: 2, name: 'Other', updated_at: 'b' }
];
const byName = (row: { name: string }) => row.name;

test('slugifyDisplayName keeps letters and digits, lowercased and without accents', () => {
	assert.equal(slugifyDisplayName('Hello World'), 'helloworld');
	assert.equal(slugifyDisplayName('Café 24'), 'cafe24');
	assert.equal(slugifyDisplayName('Ünïcödé Sërver'), 'unicodeserver');
	assert.equal(slugifyDisplayName('A_B-C'), 'abc');
});

test('slugifyDisplayName keeps names written in other scripts', () => {
	assert.equal(slugifyDisplayName('日本語'), '日本語');
	assert.equal(slugifyDisplayName('Привет'), 'привет');
});

test('slugifyDisplayName falls back when nothing usable is left', () => {
	assert.equal(slugifyDisplayName('!!!'), 'item');
	assert.equal(slugifyDisplayName('  '), 'item');
	assert.equal(slugifyDisplayName('!!!', 'server'), 'server');
});

test('parseIndexedSlug reads a numeric suffix as the position after the first', () => {
	assert.deepEqual(parseIndexedSlug('name'), { base: 'name', index: 1 });
	assert.deepEqual(parseIndexedSlug('name_1'), { base: 'name', index: 2 });
	assert.deepEqual(parseIndexedSlug('  NAME_3 '), { base: 'name', index: 4 });
	assert.deepEqual(parseIndexedSlug('name_0'), { base: 'name_0', index: 1 });
	assert.deepEqual(parseIndexedSlug('_2'), { base: '_2', index: 1 });
	assert.deepEqual(parseIndexedSlug(''), { base: '', index: 1 });
});

test('formatIndexedSlug is the inverse of parseIndexedSlug', () => {
	assert.equal(formatIndexedSlug('name', 1), 'name');
	assert.equal(formatIndexedSlug('name', 2), 'name_1');
	for (const index of [1, 2, 7]) {
		assert.deepEqual(parseIndexedSlug(formatIndexedSlug('name', index)), { base: 'name', index });
	}
});

test('resolveIndexedSlugToItem orders same-named items by id', () => {
	assert.deepEqual(resolveIndexedSlugToItem('same', servers, byName), { item: servers[1], computedSlug: 'same' });
	assert.deepEqual(resolveIndexedSlugToItem('same_1', servers, byName), { item: servers[0], computedSlug: 'same_1' });
	assert.deepEqual(resolveIndexedSlugToItem('other', servers, byName), { item: servers[2], computedSlug: 'other' });
	assert.equal(resolveIndexedSlugToItem('same_5', servers, byName), null);
	assert.equal(resolveIndexedSlugToItem('missing', servers, byName), null);
	assert.equal(resolveIndexedSlugToItem('', servers, byName), null);
});

test('computeIndexedSlugForItemId gives each item the slug that resolves back to it', () => {
	assert.equal(computeIndexedSlugForItemId(1, servers, byName), 'same');
	assert.equal(computeIndexedSlugForItemId(3, servers, byName), 'same_1');
	assert.equal(computeIndexedSlugForItemId(2, servers, byName), 'other');
	assert.equal(computeIndexedSlugForItemId(99, servers, byName), null);
	for (const server of servers) {
		const slug = computeIndexedSlugForItemId(server.id, servers, byName);
		assert.equal(resolveIndexedSlugToItem(String(slug), servers, byName)?.item, server);
	}
});

test('listIndexedSlugsForItems lists every item once with its slug and timestamp', () => {
	const listed = listIndexedSlugsForItems([...servers], byName);
	assert.deepEqual(
		listed.map((entry) => [entry.slug, entry.item.id, entry.updated_at]),
		[
			['same', 1, 'a'],
			['same_1', 3, 'c'],
			['other', 2, 'b']
		]
	);
});
