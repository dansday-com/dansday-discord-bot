import { BRAND_TAGLINE } from './brand.js';
import { APP_NAME, APP_NAME_PLAIN, APP_URL } from './backend/panelServer.js';
import { COMMUNITY_DISCORD_URL, DISCORD_APP_DIRECTORY_URL, OFFICIAL_BOT_INVITE_URL, SOURCE_REPO_URL } from './url.js';

export type LdNode = Record<string, unknown>;

const ORGANIZATION_ID = `${APP_URL}/#organization`;
const WEBSITE_ID = `${APP_URL}/#website`;
const SOFTWARE_ID = `${APP_URL}/#software`;
const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

const alternateNames = (suffix = ''): string[] | undefined => (APP_NAME_PLAIN === APP_NAME ? undefined : [`${APP_NAME}${suffix}`]);

export function siteNodes(): LdNode[] {
	return [
		{
			'@type': 'Organization',
			'@id': ORGANIZATION_ID,
			name: APP_NAME_PLAIN,
			alternateName: alternateNames(),
			slogan: BRAND_TAGLINE,
			url: `${APP_URL}/`,
			logo: `${APP_URL}/web-app-manifest-512x512.png`,
			sameAs: [SOURCE_REPO_URL, DISCORD_APP_DIRECTORY_URL, COMMUNITY_DISCORD_URL]
		},
		{
			'@type': 'WebSite',
			'@id': WEBSITE_ID,
			name: APP_NAME_PLAIN,
			alternateName: [...(alternateNames() ?? []), `${APP_NAME_PLAIN} Discord Bot`],
			url: `${APP_URL}/`,
			inLanguage: 'en',
			publisher: { '@id': ORGANIZATION_ID }
		}
	];
}

export function webPageNode(url: string, name: string, description: string): LdNode {
	return {
		'@type': 'WebPage',
		'@id': url,
		url,
		name,
		description,
		inLanguage: 'en',
		isPartOf: { '@id': WEBSITE_ID }
	};
}

export function softwareNodes(description: string, featureList: string[]): LdNode[] {
	return [
		{
			'@type': 'SoftwareApplication',
			'@id': SOFTWARE_ID,
			name: `${APP_NAME_PLAIN} Discord Bot`,
			alternateName: alternateNames(' Discord Bot'),
			applicationCategory: 'CommunicationApplication',
			applicationSubCategory: 'Discord bot',
			operatingSystem: 'Discord',
			url: `${APP_URL}/`,
			image: `${APP_URL}/og.png?v=3`,
			description,
			featureList,
			isAccessibleForFree: true,
			license: LICENSE_URL,
			installUrl: OFFICIAL_BOT_INVITE_URL,
			softwareHelp: { '@type': 'CreativeWork', url: `${APP_URL}/docs` },
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
			publisher: { '@id': ORGANIZATION_ID },
			sameAs: [SOURCE_REPO_URL, DISCORD_APP_DIRECTORY_URL]
		},
		{
			'@type': 'SoftwareSourceCode',
			name: `${APP_NAME_PLAIN} Discord Bot source code`,
			codeRepository: SOURCE_REPO_URL,
			programmingLanguage: 'TypeScript',
			runtimePlatform: 'Node.js',
			license: LICENSE_URL,
			targetProduct: { '@id': SOFTWARE_ID }
		}
	];
}

export function faqNode(faq: { q: string; a: string }[]): LdNode {
	return {
		'@type': 'FAQPage',
		about: { '@id': SOFTWARE_ID },
		mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
	};
}

export function techArticleNode(url: string, headline: string, description: string, sections: string[]): LdNode {
	return {
		'@type': 'TechArticle',
		headline,
		description,
		url,
		inLanguage: 'en',
		articleSection: sections,
		mainEntityOfPage: { '@id': url },
		about: { '@id': SOFTWARE_ID },
		publisher: { '@id': ORGANIZATION_ID }
	};
}

export function ldJson(nodes: LdNode[]): string {
	return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}
