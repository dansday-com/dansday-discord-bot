import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	EFFECTS,
	EFFECT_FAMILIES,
	SEED_RANGE,
	SPINNABLE_EFFECTS,
	effectMeta,
	effectPalette,
	effectVariant,
	familySalt,
	mulberry32,
	normalizeEffect,
	normalizeSeed,
	rollEffect
} from '../src/lib/effects.ts';
import { BLEND, PROGRAMS } from '../src/lib/frontend/fx/programs.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const SEEDS = [0, 1, 2, 3, 500, SEED_RANGE - 1];

test('family ids and effect entries are unique and match each other', () => {
	assert.equal(new Set(EFFECT_FAMILIES).size, EFFECT_FAMILIES.length);
	assert.equal(new Set(EFFECTS.map((effect) => effect.id)).size, EFFECTS.length);
	assert.deepEqual(
		EFFECTS.map((effect) => effect.id).filter((id) => !EFFECT_FAMILIES.includes(id)),
		[]
	);
	assert.deepEqual(
		SPINNABLE_EFFECTS.filter((id) => !effectMeta(id)),
		[]
	);
	assert.equal(SPINNABLE_EFFECTS.includes('none' as never), false);
});

test('every family has its own program', () => {
	assert.deepEqual(
		SPINNABLE_EFFECTS.filter((id) => typeof PROGRAMS[id]?.init !== 'function' || typeof PROGRAMS[id]?.frame !== 'function'),
		[]
	);
	assert.equal(new Set(SPINNABLE_EFFECTS.map((id) => PROGRAMS[id])).size, SPINNABLE_EFFECTS.length);
	assert.equal(new Set(SPINNABLE_EFFECTS.map((id) => PROGRAMS[id].frame)).size, SPINNABLE_EFFECTS.length);
});

test('every family has a derived blend mode', () => {
	assert.deepEqual(
		SPINNABLE_EFFECTS.filter((id) => BLEND[id] !== 'screen' && BLEND[id] !== 'normal'),
		[]
	);
});

test('every family has a two-colour palette', () => {
	for (const id of SPINNABLE_EFFECTS) {
		const palette = effectPalette(id, '#336699');
		assert.equal(palette.length, 2, id);
		assert.ok(
			palette.every((colour) => HEX.test(colour)),
			id
		);
	}
});

test('every family gives a different card for different seeds', () => {
	const repeating = SPINNABLE_EFFECTS.filter((id) => new Set(SEEDS.map((seed) => effectVariant(id, seed, '#336699').style)).size < SEEDS.length);
	assert.deepEqual(repeating, []);
});

test('the same family and seed always give the same card', () => {
	for (const id of SPINNABLE_EFFECTS) {
		assert.deepEqual(effectVariant(id, 4242, '#336699'), effectVariant(id, 4242, '#336699'), id);
	}
	assert.deepEqual(effectVariant('none', 5, '#336699'), { family: 'none', seed: 5, style: '' });
});

test('each family seeds its own random stream', () => {
	assert.equal(new Set(SPINNABLE_EFFECTS.map((id) => familySalt(id))).size, SPINNABLE_EFFECTS.length);
	const first = mulberry32(42);
	const second = mulberry32(42);
	const drawn = [first(), first(), first()];
	assert.deepEqual(drawn, [second(), second(), second()]);
	assert.ok(drawn.every((value) => value >= 0 && value < 1));
	assert.notDeepEqual(drawn, [mulberry32(43)(), mulberry32(43)(), mulberry32(43)()]);
});

test('seeds and effect ids from outside are brought into range', () => {
	assert.equal(normalizeSeed(7), 7);
	assert.equal(normalizeSeed('7.9'), 7);
	assert.equal(normalizeSeed(-1), SEED_RANGE - 1);
	assert.equal(normalizeSeed(SEED_RANGE), 0);
	assert.equal(normalizeSeed('x'), 0);
	assert.equal(normalizeEffect('nope'), 'none');
	assert.equal(normalizeEffect(SPINNABLE_EFFECTS[0]), SPINNABLE_EFFECTS[0]);
});

test('rollEffect returns a spinnable family and a seed in range', () => {
	for (let i = 0; i < 200; i++) {
		const rolled = rollEffect();
		assert.ok(SPINNABLE_EFFECTS.includes(rolled.effect as never));
		assert.ok(Number.isInteger(rolled.seed) && rolled.seed >= 0 && rolled.seed < SEED_RANGE);
	}
});
