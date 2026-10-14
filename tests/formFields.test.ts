import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	type DurationPreset,
	checkboxField,
	checkboxValue,
	durationField,
	durationValue,
	radioField,
	radioValue,
	selectValue,
	uploadedFiles
} from '../src/lib/backend/bots/official-bot/components/interface/formFields.ts';

const PRESETS: DurationPreset[] = [
	{ amount: 10, unit: 'minute' },
	{ amount: 1, unit: 'hour' },
	{ amount: 7, unit: 'day' }
];
const picked = (value: unknown) => ({ getRadioGroup: () => value });
const throwing = {
	getCheckbox: () => {
		throw new Error('missing');
	},
	getRadioGroup: () => {
		throw new Error('missing');
	},
	getStringSelectValues: () => {
		throw new Error('missing');
	},
	getUploadedFiles: () => {
		throw new Error('missing');
	}
};

test('durationField offers the presets as radio choices labelled in the member language', () => {
	const english = durationField('How long', 'duration', { lang: 'en', presets: PRESETS }).toJSON();
	assert.equal(english.label, 'How long');
	assert.deepEqual(english.component, {
		type: 21,
		custom_id: 'duration',
		options: [
			{ label: '10 minutes', value: '600' },
			{ label: '1 hour', value: '3600' },
			{ label: '7 days', value: '604800' }
		]
	});
	const indonesian = durationField('Berapa lama', 'duration', { lang: 'id', presets: PRESETS }).toJSON();
	assert.deepEqual(
		(indonesian.component as { options: { label: string }[] }).options.map((option) => option.label),
		['10 menit', '1 jam', '7 hari']
	);
});

test('durationValue accepts only a value that is one of the presets', () => {
	assert.equal(durationValue(picked('600'), 'duration', PRESETS), 600);
	assert.equal(durationValue(picked('604800'), 'duration', PRESETS), 604800);
	assert.equal(durationValue(picked('601'), 'duration', PRESETS), null);
	assert.equal(durationValue(picked('999999999'), 'duration', PRESETS), null);
	assert.equal(durationValue(picked(null), 'duration', PRESETS), null);
	assert.equal(durationValue(throwing, 'duration', PRESETS), null);
});

test('field labels are cut to the length Discord allows', () => {
	assert.equal(checkboxField('x'.repeat(60), 'flag', true).toJSON().label.length, 45);
	assert.equal(
		radioField('y'.repeat(60), 'choice', [
			{ label: 'A', value: 'a' },
			{ label: 'B', value: 'b' }
		]).toJSON().label.length,
		45
	);
	assert.deepEqual(checkboxField('Allow', 'flag', true).toJSON().component, { type: 23, custom_id: 'flag', default: true });
});

test('reading a submitted form falls back when a field is missing', () => {
	assert.equal(checkboxValue({ getCheckbox: () => true }, 'flag', false), true);
	assert.equal(checkboxValue({ getCheckbox: () => false }, 'flag', true), false);
	assert.equal(checkboxValue(throwing, 'flag', true), true);
	assert.equal(radioValue(picked('a'), 'choice'), 'a');
	assert.equal(radioValue(throwing, 'choice'), null);
	assert.equal(selectValue({ getStringSelectValues: () => ['first', 'second'] }, 'pick'), 'first');
	assert.equal(selectValue({ getStringSelectValues: () => [] }, 'pick'), null);
	assert.equal(selectValue(throwing, 'pick'), null);
});

test('uploadedFiles lists what was attached, or nothing', () => {
	const files = new Map([['1', { url: 'https://cdn.example/a.png', name: 'a.png' }]]);
	assert.deepEqual(uploadedFiles({ getUploadedFiles: () => files }, 'images'), [{ attachment: 'https://cdn.example/a.png', name: 'a.png' }]);
	assert.deepEqual(uploadedFiles({ getUploadedFiles: () => null }, 'images'), []);
	assert.deepEqual(uploadedFiles(throwing, 'images'), []);
});
