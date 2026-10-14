import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discordMarkdown, type MarkdownContext } from '../src/lib/frontend/components/messages/discordMarkdown.ts';

const context: MarkdownContext = {
	roles: new Map([
		['123456', { name: 'Mods', color: '#ff0000' }],
		['654321', { name: 'Plain', color: null }]
	]),
	channels: new Map([['222222', 'general']]),
	members: new Map([['333333', 'Ann']])
};

test('plain text is escaped, never passed through as markup', () => {
	const html = discordMarkdown('<script>alert("x")</script> & more', context);
	assert.equal(html, '<div class="dc-line">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more</div>');
});

test('inline styles become their tags', () => {
	assert.equal(
		discordMarkdown('**bold** *em* __under__ ~~gone~~', context),
		'<div class="dc-line"><strong>bold</strong> <em>em</em> <u>under</u> <s>gone</s></div>'
	);
	assert.equal(discordMarkdown('||secret||', context), '<div class="dc-line"><span class="dc-spoiler">secret</span></div>');
});

test('code keeps its content literal and escaped', () => {
	assert.equal(discordMarkdown('`<b>**x**</b>`', context), '<div class="dc-line"><code class="dc-code">&lt;b&gt;**x**&lt;/b&gt;</code></div>');
	assert.equal(discordMarkdown('```js\n<i>\n```', context), '<div class="dc-line"><pre class="dc-codeblock">&lt;i&gt;</pre></div>');
});

test('only http and https targets become links', () => {
	assert.equal(
		discordMarkdown('[site](https://example.com/a?b=1)', context),
		'<div class="dc-line"><a class="dc-link" href="https://example.com/a?b=1" target="_blank" rel="noreferrer">site</a></div>'
	);
	assert.equal(discordMarkdown('[x](javascript:alert(1))', context).includes('<a'), false);
	assert.equal(
		discordMarkdown('see https://example.com.', context),
		'<div class="dc-line">see <a class="dc-link" href="https://example.com" target="_blank" rel="noreferrer">https://example.com</a>.</div>'
	);
});

test('mentions resolve through the context and fall back when unknown', () => {
	assert.equal(
		discordMarkdown('<@&123456>', context),
		'<div class="dc-line"><span class="dc-mention" style="color:#ff0000;background:#ff000026">@Mods</span></div>'
	);
	assert.equal(discordMarkdown('<@&654321>', context), '<div class="dc-line"><span class="dc-mention">@Plain</span></div>');
	assert.equal(discordMarkdown('<@&999999>', context), '<div class="dc-line"><span class="dc-mention">@deleted-role</span></div>');
	assert.equal(
		discordMarkdown('<#222222> <#999999>', context),
		'<div class="dc-line"><span class="dc-mention">#general</span> <span class="dc-mention">#deleted-channel</span></div>'
	);
	assert.equal(
		discordMarkdown('<@333333> <@!999999>', context),
		'<div class="dc-line"><span class="dc-mention">@Ann</span> <span class="dc-mention">@member</span></div>'
	);
	assert.equal(discordMarkdown('@everyone', context), '<div class="dc-line"><span class="dc-mention">@everyone</span></div>');
});

test('block syntax maps one line to one element', () => {
	assert.equal(discordMarkdown('# Title', context), '<div class="dc-h1">Title</div>');
	assert.equal(discordMarkdown('> quoted', context), '<div class="dc-quote">quoted</div>');
	assert.equal(discordMarkdown('- item', context), '<div class="dc-li" style="margin-left:0px"><span>•</span><span>item</span></div>');
	assert.equal(discordMarkdown('2. second', context), '<div class="dc-li" style="margin-left:0px"><span>2.</span><span>second</span></div>');
	assert.equal(discordMarkdown('a\n\nb', context), '<div class="dc-line">a</div><div class="dc-blank"></div><div class="dc-line">b</div>');
});

test('custom emoji become images from the Discord CDN', () => {
	assert.equal(
		discordMarkdown('<:wave:1234567890>', context),
		'<div class="dc-line"><img class="dc-emoji" src="https://cdn.discordapp.com/emojis/1234567890.webp?size=48" alt=":wave:" /></div>'
	);
	assert.equal(discordMarkdown('<a:spin:1234567890>', context).includes('1234567890.gif'), true);
});
