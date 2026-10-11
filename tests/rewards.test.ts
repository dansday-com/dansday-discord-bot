import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewardGoalLabel, rewardGoalMeta, rewardGoalUnits, rewardProgress, rewardRuleFlags, sortRewards, xpForLevel } from '../src/lib/rewards.ts';

test('rewardGoalMeta falls back to the level goal for unknown types', () => {
	assert.equal(rewardGoalMeta('chat').column, 'chat_total');
	assert.equal(rewardGoalMeta('voice').perUnit, 60);
	assert.equal(rewardGoalMeta('nope').id, 'level');
});

test('time goals are stored in minutes and shown in hours', () => {
	assert.equal(rewardGoalUnits({ goal_type: 'level', goal: 10 }), 10);
	assert.equal(rewardGoalUnits({ goal_type: 'chat', goal: 500 }), 500);
	assert.equal(rewardGoalUnits({ goal_type: 'voice', goal: 120 }), 2);
	assert.equal(rewardGoalUnits({ goal_type: 'stream', goal: 90 }), 2);
});

test('rewardGoalLabel names the goal in plain words', () => {
	assert.equal(rewardGoalLabel({ goal_type: 'level', goal: 10 }), 'Level 10');
	assert.equal(rewardGoalLabel({ goal_type: 'chat', goal: 500 }), '500 messages');
	assert.equal(rewardGoalLabel({ goal_type: 'voice', goal: 120 }), '2 voice hours');
	assert.equal(rewardGoalLabel({ goal_type: 'video', goal: 60 }), '1 video hours');
	assert.equal(rewardGoalLabel({ goal_type: 'stream', goal: 180 }), '3 streaming hours');
});

test('sortRewards orders by goal type, then by goal, without changing the input', () => {
	const rewards = [
		{ goal_type: 'chat', goal: 100 },
		{ goal_type: 'level', goal: 20 },
		{ goal_type: 'stream', goal: 60 },
		{ goal_type: 'level', goal: 5 }
	];
	const original = [...rewards];
	assert.deepEqual(sortRewards(rewards), [
		{ goal_type: 'level', goal: 5 },
		{ goal_type: 'level', goal: 20 },
		{ goal_type: 'chat', goal: 100 },
		{ goal_type: 'stream', goal: 60 }
	]);
	assert.deepEqual(rewards, original);
});

test('rewardProgress reads each goal column and starts everyone at level one', () => {
	assert.deepEqual(rewardProgress(null), { level: 1, chat: 0, voice: 0, video: 0, stream: 0 });
	assert.deepEqual(rewardProgress({ level: 7, chat_total: '42', voice_minutes_active: 90.9, voice_minutes_video: -3, voice_minutes_streaming: 'abc' }), {
		level: 7,
		chat: 42,
		voice: 90,
		video: 0,
		stream: 0
	});
});

test('rewardRuleFlags default to on unless stored as false', () => {
	assert.deepEqual(rewardRuleFlags(null), { keep: true, stack: true });
	assert.deepEqual(rewardRuleFlags({}), { keep: true, stack: true });
	assert.deepEqual(rewardRuleFlags({ rewards_keep: false, rewards_stack: 0 }), { keep: false, stack: true });
	assert.deepEqual(rewardRuleFlags({ rewards_stack: false }), { keep: true, stack: false });
});

test('xpForLevel is zero at level one and grows linearly or geometrically', () => {
	assert.equal(xpForLevel(1, 100, 1.5), 0);
	assert.equal(xpForLevel(0, 100, 1.5), 0);
	assert.equal(xpForLevel(2, 100, 1), 100);
	assert.equal(xpForLevel(5, 100, 1), 400);
	assert.equal(xpForLevel(2, 100, 2), 100);
	assert.equal(xpForLevel(3, 100, 2), 300);
	assert.equal(xpForLevel(4, 100, 2), 700);
	assert.equal(xpForLevel(3, 100, 1.5), 250);
});

test('each level costs more than the one before it', () => {
	for (let level = 2; level < 30; level++) {
		assert.ok(xpForLevel(level + 1, 100, 1.2) > xpForLevel(level, 100, 1.2));
	}
});
