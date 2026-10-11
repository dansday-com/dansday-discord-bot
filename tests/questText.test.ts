import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseQuestRewardLine, parseQuestTaskLine, questTaskLabel } from '../src/lib/backend/api/discord-quest-api.ts';

test('questTaskLabel turns a task key into readable words', () => {
	assert.equal(questTaskLabel('WATCH_VIDEO'), 'Watch video');
	assert.equal(questTaskLabel('PLAY_ON_DESKTOP'), 'Play on desktop');
	assert.equal(questTaskLabel('SOMETHING_NEW'), 'Something New');
});

test('a reward line is split into its parts', () => {
	assert.deepEqual(parseQuestRewardLine('Avatar Decoration · 3 months of Nitro'), [
		{ kind: 'name', name: 'Avatar Decoration' },
		{ kind: 'name', name: '3 months of Nitro' }
	]);
	assert.deepEqual(parseQuestRewardLine('• 700× Discord quest currency'), [{ kind: 'currency', quantity: 700 }]);
	assert.deepEqual(parseQuestRewardLine('700× Discord quest currency · Avatar Decoration'), [
		{ kind: 'currency', quantity: 700 },
		{ kind: 'name', name: 'Avatar Decoration' }
	]);
});

test('an empty or placeholder reward line has no parts', () => {
	assert.deepEqual(parseQuestRewardLine(null), []);
	assert.deepEqual(parseQuestRewardLine('   '), []);
	assert.deepEqual(parseQuestRewardLine('Quest reward'), []);
});

test('a task line is recognised by its shape', () => {
	assert.deepEqual(parseQuestTaskLine('Play on desktop for 15 minutes', 'PLAY_ON_DESKTOP'), { kind: 'minutes', value: 15 });
	assert.deepEqual(parseQuestTaskLine('Play on desktop for 1 minute', 'PLAY_ON_DESKTOP'), { kind: 'minutes', value: 1 });
	assert.deepEqual(parseQuestTaskLine('Watch video for 30 seconds', 'WATCH_VIDEO'), { kind: 'seconds', value: 30 });
	assert.deepEqual(parseQuestTaskLine('Watch video · 45.5 seconds', 'WATCH_VIDEO'), { kind: 'secondsTarget', value: 45.5 });
	assert.deepEqual(parseQuestTaskLine('Watch video · target 30', 'WATCH_VIDEO'), { kind: 'target', value: 30 });
});

test('a task line that is only the label, or missing, is just the label', () => {
	assert.deepEqual(parseQuestTaskLine('Watch video', 'WATCH_VIDEO'), { kind: 'label' });
	assert.deepEqual(parseQuestTaskLine(null, 'WATCH_VIDEO'), { kind: 'label' });
	assert.deepEqual(parseQuestTaskLine('  ', 'WATCH_VIDEO'), { kind: 'label' });
});

test('any other task line is kept as custom text', () => {
	assert.deepEqual(parseQuestTaskLine('Reach level 5 in the game', 'PLAY_ON_DESKTOP'), { kind: 'custom', text: 'Reach level 5 in the game' });
	assert.deepEqual(parseQuestTaskLine('Play on desktop for 15 minutes', 'WATCH_VIDEO'), { kind: 'custom', text: 'Play on desktop for 15 minutes' });
});
