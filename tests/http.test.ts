import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJsonObject } from '../src/lib/http.ts';

const jsonRequest = (body: string) => new Request('https://x.test', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });

test('readJsonObject returns the parsed object', async () => {
	assert.deepEqual(await readJsonObject(jsonRequest('{"is_frozen":true}')), { is_frozen: true });
});

test('readJsonObject returns an empty object for anything that is not a JSON object', async () => {
	assert.deepEqual(await readJsonObject(jsonRequest('not json')), {});
	assert.deepEqual(await readJsonObject(jsonRequest('[1,2]')), {});
	assert.deepEqual(await readJsonObject(jsonRequest('null')), {});
	assert.deepEqual(await readJsonObject(jsonRequest('"text"')), {});
});
