import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	COLOR_MAX_SCORE,
	COLOR_MAX_TOTAL,
	COLOR_OPENING_HUE_GAP,
	colorGuess,
	colorHueGap,
	colorLuma,
	colorOpeningGuess,
	colorScore,
	colorTarget,
	colorTotal,
	colorXp,
	deltaE2000,
	hsbToCss,
	hsbToHex,
	hsbToRgb
} from '../src/lib/color.ts';

test('colorHueGap measures the short way round the wheel', () => {
	assert.equal(colorHueGap(10, 350), 20);
	assert.equal(colorHueGap(350, 10), 20);
	assert.equal(colorHueGap(0, 180), 180);
	assert.equal(colorHueGap(90, 90), 0);
});

test('colorGuess wraps the hue, clamps the rest and rejects incomplete input', () => {
	assert.deepEqual(colorGuess({ h: 370, s: 150, b: -5 }), { h: 10, s: 100, b: 0 });
	assert.deepEqual(colorGuess({ h: '-10', s: '50.4', b: 20 }), { h: 350, s: 50, b: 20 });
	assert.equal(colorGuess({ h: 1, s: '', b: 2 }), null);
	assert.equal(colorGuess({ h: 'x', s: 1, b: 2 }), null);
	assert.equal(colorGuess({ h: 1, s: 2 }), null);
});

test('hsbToRgb converts the primaries, white and black', () => {
	assert.deepEqual(hsbToRgb({ h: 0, s: 100, b: 100 }), [255, 0, 0]);
	assert.deepEqual(hsbToRgb({ h: 120, s: 100, b: 100 }), [0, 255, 0]);
	assert.deepEqual(hsbToRgb({ h: 240, s: 100, b: 100 }), [0, 0, 255]);
	assert.deepEqual(hsbToRgb({ h: 360, s: 100, b: 100 }), [255, 0, 0]);
	assert.deepEqual(hsbToRgb({ h: 0, s: 0, b: 100 }), [255, 255, 255]);
	assert.deepEqual(hsbToRgb({ h: 0, s: 0, b: 0 }), [0, 0, 0]);
	assert.equal(hsbToCss({ h: 120, s: 100, b: 100 }), 'rgb(0 255 0)');
	assert.equal(hsbToHex({ h: 0, s: 100, b: 100 }), 0xff0000);
	assert.equal(colorLuma({ h: 0, s: 0, b: 100 }), 1);
	assert.equal(colorLuma({ h: 0, s: 0, b: 0 }), 0);
});

test('deltaE2000 matches the published reference pairs', () => {
	const pairs: [[number, number, number], [number, number, number], string][] = [
		[[50, 2.6772, -79.7751], [50, 0, -82.7485], '2.0425'],
		[[50, 3.1571, -77.2803], [50, 0, -82.7485], '2.8615'],
		[[50, 2.8361, -74.02], [50, 0, -82.7485], '3.4412'],
		[[50, -1.3802, -84.2814], [50, 0, -82.7485], '1.0000'],
		[[50, 0, 0], [50, -1, 2], '2.3669']
	];
	for (const [first, second, expected] of pairs) {
		assert.equal(deltaE2000(first, second).toFixed(4), expected);
	}
	assert.equal(deltaE2000([50, 2.6772, -79.7751], [50, 2.6772, -79.7751]), 0);
});

test('a perfect guess scores the maximum and closer guesses score higher', () => {
	const target = { h: 200, s: 60, b: 70 };
	assert.equal(colorScore(target, target), COLOR_MAX_SCORE);
	const near = colorScore(target, { h: 205, s: 60, b: 70 });
	const far = colorScore(target, { h: 20, s: 60, b: 70 });
	assert.ok(near > far);
	assert.ok(near < COLOR_MAX_SCORE);
});

test('every score stays between zero and the maximum', () => {
	for (let h = 0; h < 360; h += 45) {
		for (const s of [0, 50, 100]) {
			for (const b of [0, 50, 100]) {
				const score = colorScore({ h: 200, s: 60, b: 70 }, { h, s, b });
				assert.ok(score >= 0 && score <= COLOR_MAX_SCORE, `${h}/${s}/${b} scored ${score}`);
			}
		}
	}
});

test('the game total is the sum of the rounds and XP equals the total, capped', () => {
	assert.equal(colorTotal([10, 9.48, 2.67]), 22.15);
	assert.equal(colorTotal([]), 0);
	assert.equal(colorXp(COLOR_MAX_TOTAL), COLOR_MAX_TOTAL);
	assert.equal(colorXp(37.6), 38);
	assert.equal(colorXp(999), COLOR_MAX_TOTAL);
	assert.equal(colorXp(-3), 0);
	assert.equal(colorXp('x'), 0);
});

test('targets and opening guesses stay inside their ranges', () => {
	for (let i = 0; i < 200; i++) {
		const target = colorTarget();
		assert.ok(target.h >= 0 && target.h <= 359 && target.s >= 15 && target.s <= 100 && target.b >= 15 && target.b <= 100);
		const opening = colorOpeningGuess(target);
		assert.ok(colorHueGap(opening.h, target.h) >= COLOR_OPENING_HUE_GAP);
		assert.ok(opening.s >= 30 && opening.s <= 89 && opening.b >= 40 && opening.b <= 89);
	}
});
