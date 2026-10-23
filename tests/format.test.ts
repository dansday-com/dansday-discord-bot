import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeHtml } from '../src/lib/utils/format.ts';

test('escapeHtml escapes every character that is markup in HTML', () => {
	assert.equal(escapeHtml(`<b>"Tom" & 'Jerry'</b>`), '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
	assert.equal(escapeHtml('plain'), 'plain');
});
