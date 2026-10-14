import assert from 'node:assert/strict';
import { test } from 'node:test';
import { faqNode, ldJson, siteNodes, softwareNodes, techArticleNode, webPageNode } from '../src/lib/structuredData.ts';

const idsOf = (nodes: Record<string, unknown>[]) => nodes.map((node) => node['@id']).filter(Boolean);

test('the site is described as an organization and a website on the site origin', () => {
	const nodes = siteNodes();
	assert.deepEqual(
		nodes.map((node) => node['@type']),
		['Organization', 'WebSite']
	);
	assert.deepEqual(idsOf(nodes), ['https://example.test/#organization', 'https://example.test/#website']);
	assert.equal(nodes[0].name, 'Test Bot');
});

test('a page node points back at the website', () => {
	const page = webPageNode('https://example.test/shop', 'Shop', 'Every item');
	assert.equal(page['@type'], 'WebPage');
	assert.equal(page['@id'], 'https://example.test/shop');
	assert.equal(page.url, 'https://example.test/shop');
	assert.equal(page.name, 'Shop');
	assert.equal(page.description, 'Every item');
	assert.deepEqual(page.isPartOf, { '@id': 'https://example.test/#website' });
});

test('every question becomes a question with an accepted answer', () => {
	const node = faqNode([
		{ q: 'Is it free?', a: 'Yes.' },
		{ q: 'Can I self host?', a: 'Yes, with Docker.' }
	]);
	assert.equal(node['@type'], 'FAQPage');
	const entries = node.mainEntity as { '@type': string; name: string; acceptedAnswer: { text: string } }[];
	assert.equal(entries.length, 2);
	assert.equal(entries[0]['@type'], 'Question');
	assert.equal(entries[0].name, 'Is it free?');
	assert.equal(entries[1].acceptedAnswer.text, 'Yes, with Docker.');
});

test('software and article nodes carry what they were given', () => {
	const software = softwareNodes('A Discord bot', ['Leveling', 'Giveaways']);
	assert.ok(software.length > 0);
	assert.ok(JSON.stringify(software).includes('Leveling'));
	assert.ok(JSON.stringify(software).includes('A Discord bot'));
	const article = techArticleNode('https://example.test/docs', { headline: 'Docs', description: 'Setup guide', sections: ['Install', 'Configure'] });
	assert.equal(article.headline, 'Docs');
	assert.ok(JSON.stringify(article).includes('Configure'));
});

test('the serialised graph can never close the script tag it is embedded in', () => {
	const json = ldJson([webPageNode('https://example.test/x', '</script><script>alert(1)</script>', 'a < b')]);
	assert.equal(json.includes('<'), false);
	assert.equal(json.includes('</script>'), false);
	const parsed = JSON.parse(json) as { '@context': string; '@graph': { name: string; description: string }[] };
	assert.equal(parsed['@context'], 'https://schema.org');
	assert.equal(parsed['@graph'][0].name, '</script><script>alert(1)</script>');
	assert.equal(parsed['@graph'][0].description, 'a < b');
});
