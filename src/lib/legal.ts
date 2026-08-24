import { APP_NAME, APP_URL } from './frontend/panelServer.js';

export const LEGAL_BASE_URL = 'https://bot.dansday.com';

export const TERMS_PATH = '/terms-of-service';
export const PRIVACY_PATH = '/privacy-policy';

export const TERMS_URL = `${LEGAL_BASE_URL}${TERMS_PATH}`;
export const PRIVACY_URL = `${LEGAL_BASE_URL}${PRIVACY_PATH}`;

export const LEGAL_LAST_UPDATED = 'August 24, 2026';

export const DISCORD_LINKS = {
	terms: 'https://discord.com/terms',
	privacy: 'https://discord.com/privacy',
	developerPolicy: 'https://discord.com/developers/docs/policy'
};

export const legalNav = [
	{ label: 'Privacy Policy', href: PRIVACY_PATH },
	{ label: 'Terms of Service', href: TERMS_PATH }
];

export type LegalBlock =
	| { kind: 'text'; text: string }
	| { kind: 'list'; items: string[] }
	| { kind: 'links'; text: string; links: { label: string; href: string }[]; tail?: string };

export type LegalSection = {
	id: string;
	heading: string;
	blocks: LegalBlock[];
};

export type LegalDoc = {
	title: string;
	description: string;
	heading: string;
	intro: string;
	lastUpdated: string;
	sections: LegalSection[];
};

export const terms: LegalDoc = {
	title: `Terms of Service | ${APP_NAME} Discord Bot`,
	description: `Terms governing use of ${APP_NAME} Discord Bot, the web panel, and related services.`,
	heading: 'Terms of Service',
	intro: `Please read these terms before using ${APP_NAME} Discord Bot or the website.`,
	lastUpdated: LEGAL_LAST_UPDATED,
	sections: [
		{
			id: 'agreement',
			heading: 'Agreement',
			blocks: [
				{
					kind: 'text',
					text: `By adding ${APP_NAME} Discord Bot to a Discord server, using the web panel, or otherwise using the Service, you agree to these Terms of Service and to Discord's rules. If you do not agree, do not use the Service.`
				}
			]
		},
		{
			id: 'service',
			heading: 'The Service',
			blocks: [
				{
					kind: 'text',
					text: `${APP_NAME} Discord Bot provides Discord bot features and a web-based configuration panel. Features, availability, and limits may change. We may suspend or discontinue parts of the Service with reasonable notice where practicable.`
				}
			]
		},
		{
			id: 'eligibility',
			heading: 'Eligibility and Discord',
			blocks: [
				{
					kind: 'links',
					text: 'You must comply with ',
					links: [
						{ label: "Discord's Terms of Service", href: DISCORD_LINKS.terms },
						{ label: "Discord's Privacy Policy", href: DISCORD_LINKS.privacy },
						{ label: 'Discord Developer Policy', href: DISCORD_LINKS.developerPolicy }
					],
					tail: "You are responsible for your server's rules and for how you configure the bot."
				}
			]
		},
		{
			id: 'acceptable-use',
			heading: 'Acceptable use',
			blocks: [
				{ kind: 'text', text: 'You agree not to use the Service to:' },
				{
					kind: 'list',
					items: [
						'Violate law or third-party rights.',
						'Harass, abuse, spam, or distribute malware.',
						"Attempt to disrupt, overload, or gain unauthorized access to the Service or others' data.",
						'Scrape, resell, or misrepresent the bot or website without permission.'
					]
				},
				{
					kind: 'text',
					text: "We may remove access or take other action if we believe you have violated these rules or Discord's policies."
				}
			]
		},
		{
			id: 'accounts',
			heading: 'Accounts and servers',
			blocks: [
				{
					kind: 'text',
					text: 'You are responsible for activity under panel accounts you control and for bot permissions you grant in Discord. Keep credentials secure and revoke access when appropriate.'
				}
			]
		},
		{
			id: 'self-hosting',
			heading: 'Self-hosting and open source',
			blocks: [
				{
					kind: 'text',
					text: 'The project is free and open source. If you run your own deployment from source, your use of that software is governed by the project license in addition to any hosting terms you accept. Hosted and self-hosted deployments may differ in availability and data handling.'
				}
			]
		},
		{
			id: 'disclaimer',
			heading: 'Disclaimer',
			blocks: [
				{
					kind: 'text',
					text: 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. Some jurisdictions do not allow certain disclaimers; in those cases, disclaimers apply to the fullest extent permitted by law.'
				}
			]
		},
		{
			id: 'liability',
			heading: 'Limitation of liability',
			blocks: [
				{
					kind: 'text',
					text: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. The Service is provided free of charge, so our total liability for any claim relating to the Service is limited to zero.'
				}
			]
		},
		{
			id: 'indemnity',
			heading: 'Indemnity',
			blocks: [
				{
					kind: 'text',
					text: 'You agree to defend and indemnify us against claims arising from your use of the Service, your server content, or your violation of these terms, except to the extent caused by our willful misconduct.'
				}
			]
		},
		{
			id: 'termination',
			heading: 'Termination',
			blocks: [
				{
					kind: 'text',
					text: 'You may stop using the Service at any time by removing the bot from your server. We may suspend or terminate access if you breach these terms, create risk, or if required by law or Discord. Provisions that should survive, such as disclaimers, limitations, and indemnity, will survive termination.'
				}
			]
		},
		{
			id: 'changes',
			heading: 'Changes',
			blocks: [
				{
					kind: 'text',
					text: 'We may update these terms. We will post the new version and update the "Last updated" date. Continued use after changes constitutes acceptance unless applicable law requires a different process.'
				}
			]
		},
		{
			id: 'contact',
			heading: 'Contact',
			blocks: [
				{
					kind: 'links',
					text: 'For questions about these terms, reach us through the support channel listed at ',
					links: [{ label: APP_URL.replace(/^https?:\/\//, ''), href: APP_URL }]
				}
			]
		}
	]
};

export const privacy: LegalDoc = {
	title: `Privacy Policy | ${APP_NAME} Discord Bot`,
	description: `How ${APP_NAME} Discord Bot collects, uses, and protects information when you use the website and bot.`,
	heading: 'Privacy Policy',
	intro: `How we handle information for the ${APP_NAME} Discord Bot service and this website.`,
	lastUpdated: LEGAL_LAST_UPDATED,
	sections: [
		{
			id: 'overview',
			heading: 'Overview',
			blocks: [
				{
					kind: 'text',
					text: `This policy describes how information is collected and used when you use ${APP_NAME} Discord Bot (the "Service"), including the web panel, Discord interactions, and related features.`
				}
			]
		},
		{
			id: 'information-you-provide',
			heading: 'Information you provide',
			blocks: [
				{ kind: 'text', text: 'Data you or your server members may provide through the Service includes:' },
				{
					kind: 'list',
					items: [
						'Panel account details used only for authentication, such as an email address and password hash.',
						'Configuration you save in the panel, including server settings, module options, messages, and role mappings.',
						'Content sent through Discord that the bot processes to provide the features you enable.'
					]
				}
			]
		},
		{
			id: 'discord-data',
			heading: 'Data from Discord',
			blocks: [
				{
					kind: 'text',
					text: 'When the bot is added to a server or when members interact with it, Discord shares the identifiers and event data needed to run the features you enable. This can include user IDs, channel IDs, message content where a feature requires it, and voice or activity signals for the modules you turn on.'
				},
				{
					kind: 'links',
					text: 'Use of Discord is also subject to ',
					links: [
						{ label: "Discord's Terms of Service", href: DISCORD_LINKS.terms },
						{ label: "Discord's Privacy Policy", href: DISCORD_LINKS.privacy }
					]
				}
			]
		},
		{
			id: 'cookies',
			heading: 'Cookies and similar technologies',
			blocks: [
				{
					kind: 'text',
					text: 'The website uses cookies and local storage for sessions, preferences, and security, such as keeping you signed in to the panel. We do not use advertising cookies.'
				}
			]
		},
		{
			id: 'how-we-use',
			heading: 'How we use information',
			blocks: [
				{
					kind: 'text',
					text: 'We use information to operate, secure, and improve the Service, to respond to support requests, and to comply with law. We do not sell personal data.'
				}
			]
		},
		{
			id: 'retention',
			heading: 'Retention',
			blocks: [
				{
					kind: 'text',
					text: 'Panel and server configuration is kept while the bot remains in your server and your account exists. Removing the bot or deleting your account removes the associated configuration. Operational logs are kept only as long as needed to run and secure the Service.'
				}
			]
		},
		{
			id: 'sharing',
			heading: 'Sharing',
			blocks: [
				{
					kind: 'text',
					text: 'We share data only with the infrastructure providers needed to run the Service, such as hosting, database, and email delivery. Providers process data on our instructions. Self-hosted deployments are operated entirely by whoever runs them.'
				}
			]
		},
		{
			id: 'security',
			heading: 'Security',
			blocks: [
				{
					kind: 'text',
					text: 'We take reasonable measures to protect information, including encrypted transport and hashed credentials. No method of transmission or storage is completely secure.'
				}
			]
		},
		{
			id: 'your-rights',
			heading: 'Your rights',
			blocks: [
				{
					kind: 'text',
					text: 'Depending on where you live, you may have rights to access, correct, delete, or export personal data, or to object to certain processing. Contact us to exercise those rights.'
				}
			]
		},
		{
			id: 'children',
			heading: 'Children',
			blocks: [
				{
					kind: 'text',
					text: 'The Service is not directed at children under the minimum age required by Discord or applicable law. If you believe we have collected data from a child, contact us so we can delete it.'
				}
			]
		},
		{
			id: 'changes',
			heading: 'Changes',
			blocks: [
				{
					kind: 'text',
					text: 'We may update this policy from time to time. The "Last updated" date will change when we do. Continued use of the Service after changes means you accept the updated policy.'
				}
			]
		},
		{
			id: 'contact',
			heading: 'Contact',
			blocks: [
				{
					kind: 'links',
					text: 'For privacy questions, reach us through the support channel listed at ',
					links: [{ label: APP_URL.replace(/^https?:\/\//, ''), href: APP_URL }]
				}
			]
		}
	]
};
