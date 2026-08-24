import { APP_NAME, APP_URL } from './frontend/panelServer.js';

export const LEGAL_BASE_URL = 'https://bot.dansday.com';

export const TERMS_PATH = '/terms-of-service';
export const PRIVACY_PATH = '/privacy-policy';

export const TERMS_URL = `${LEGAL_BASE_URL}${TERMS_PATH}`;
export const PRIVACY_URL = `${LEGAL_BASE_URL}${PRIVACY_PATH}`;

export const LEGAL_LAST_UPDATED = 'August 24, 2026';
export const LEGAL_RETENTION_DAYS = 7;
export const SECURITY_EMAIL = 'security@dansday.com';

export const DISCORD_LINKS = {
	terms: 'https://discord.com/terms',
	privacy: 'https://discord.com/privacy',
	developerPolicy: 'https://discord.com/developers/docs/policy'
};

export const THIRD_PARTY_LINKS = {
	coingecko: 'https://www.coingecko.com/en/privacy',
	google: 'https://policies.google.com/privacy',
	openai: 'https://openai.com/policies/privacy-policy',
	roblox: 'https://en.help.roblox.com/hc/en-us/articles/115004630823',
	tiktok: 'https://www.tiktok.com/legal/privacy-policy',
	mediawiki: 'https://www.mediawiki.org/wiki/API:Main_page',
	license: 'https://github.com/dansday-com/dansday-discord-bot/blob/master/LICENSE',
	repo: 'https://github.com/dansday-com/dansday-discord-bot'
};

export const legalNav = [
	{ label: 'Privacy Policy', href: PRIVACY_PATH },
	{ label: 'Terms of Service', href: TERMS_PATH }
];

export type LegalBlock =
	| { kind: 'text'; text: string }
	| { kind: 'list'; items: string[] }
	| { kind: 'defs'; items: { term: string; desc: string }[] }
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
					text: `By adding ${APP_NAME} Discord Bot to a Discord server, signing in to the web panel, using a public server page, or otherwise using the Service, you agree to these Terms of Service and to Discord's rules. If you do not agree, do not use the Service.`
				}
			]
		},
		{
			id: 'service',
			heading: 'What the Service does',
			blocks: [
				{
					kind: 'text',
					text: `${APP_NAME} Discord Bot is a Discord bot with a web configuration panel. Server owners run /setup once, then configure everything from the browser rather than through slash commands.`
				},
				{
					kind: 'defs',
					items: [
						{
							term: 'Leveling and XP',
							desc: 'Messages, voice, video and streaming time earn XP, which drives levels, role rewards and leaderboards. Reactions are tracked for tasks.'
						},
						{
							term: 'Items and XP economy',
							desc: 'A per-server shop priced in XP with a 50-slot bag and optional timed availability. Effects include steal, bomb, leech, bounty, shield, reflect, insurance, boost, gift, spy, disguise, purifier and luck.'
						},
						{
							term: 'Tasks, streaks and check-in',
							desc: 'Daily and weekly tasks generated per member from their own recent activity, with streak bonuses and a 7-day check-in cycle.'
						},
						{
							term: 'Minigames',
							desc: 'Members wager XP. Only XP above the current level can be wagered, so a loss never costs a level.'
						},
						{
							term: 'Assets market',
							desc: 'Members lock XP into simulated crypto positions priced from live market data. This is a game score only, described further below.'
						},
						{
							term: 'Moderation and operations',
							desc: 'Warnings, mutes, bans, staff ratings, channel notifications and a message forwarder.'
						},
						{
							term: 'AI chat, voice and tools',
							desc: 'Optional AI conversation in text and voice, with web search, page fetch, image generation, wiki reading and read-only access to the server’s own public data.'
						},
						{
							term: 'Integrations',
							desc: 'Discord Quest notifications, Roblox catalog watching, and creator or TikTok live digests.'
						},
						{
							term: 'Public server pages',
							desc: 'Each server can expose live statistics, a leaderboard, a members directory and member accounts at a public URL.'
						}
					]
				},
				{
					kind: 'text',
					text: 'Every module has a toggle. Features, availability and limits may change, and we may suspend or discontinue parts of the Service with reasonable notice where practicable.'
				}
			]
		},
		{
			id: 'no-real-money',
			heading: 'XP, items and the assets market are not real money',
			blocks: [
				{
					kind: 'text',
					text: 'XP, shop items, bag contents, minigame wagers and asset positions are in-game scores with no monetary value. They cannot be bought with, redeemed for, or exchanged into real currency by us.'
				},
				{
					kind: 'text',
					text: 'The assets market is a simulation. It reads live public market prices to move a score up and down. No cryptocurrency is ever bought, held, sold or transferred on your behalf, no funds are custodied, and nothing here is financial advice or an investment product.'
				},
				{
					kind: 'text',
					text: 'Minigames wager XP only. They are not gambling for money and no purchase is possible. Server owners can disable minigames, items, assets and tasks independently.'
				},
				{
					kind: 'text',
					text: 'Scores may be adjusted, reset or removed to correct bugs, abuse or exploits. We do not compensate for lost XP, items or positions.'
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
					tail: 'You must also meet the minimum age Discord requires in your country. You are responsible for your server’s rules and for how you configure the bot.'
				}
			]
		},
		{
			id: 'server-owner',
			heading: 'If you run a server',
			blocks: [
				{
					kind: 'text',
					text: 'Adding the bot and enabling modules is your decision, and it determines what data the Service processes about your members. You are the one who decides whether public pages are on, whether AI features are on, and which channels the bot reads or posts in.'
				},
				{
					kind: 'list',
					items: [
						'Tell your members which features you have enabled, particularly public pages and AI.',
						'Turn on the Server Members and Message Content privileged intents only for the features you actually want.',
						'Keep panel accounts and staff tiers limited to people you trust; staff can change settings and moderate members.',
						'Make sure your own server rules and any local law that applies to your community are followed.'
					]
				},
				{
					kind: 'text',
					text: 'Public pages are a master switch with sub-toggles for items, minigames, assets and daily tasks. Turning the master switch off takes every public page dark immediately.'
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
						"Attempt to disrupt, overload, or gain unauthorized access to the Service or other people's data.",
						'Exploit bugs in XP, items, tasks, minigames or the assets market, or automate interactions to farm rewards.',
						'Use the AI features to generate content that is illegal, or that breaks Discord’s rules or your AI provider’s terms.',
						'Scrape, resell, or misrepresent the bot or website without permission.',
						'Circumvent rate limits, module toggles, or a server owner’s configuration.'
					]
				},
				{
					kind: 'text',
					text: "We may remove access or take other action if we believe you have violated these rules or Discord's policies."
				}
			]
		},
		{
			id: 'ai',
			heading: 'AI features',
			blocks: [
				{
					kind: 'text',
					text: 'AI chat, voice and tools are off until a server or bot operator supplies an endpoint, model and key. When enabled, prompts and the context needed to answer are sent to whichever provider that operator configured, and the provider’s own terms and privacy policy apply to that processing.'
				},
				{
					kind: 'text',
					text: 'AI output is generated automatically and can be wrong. Do not rely on it for factual, legal, financial, medical or safety decisions. Voice features record and transcribe speech in a voice channel only while the bot has been invited into it.'
				},
				{
					kind: 'text',
					text: 'The AI can read the server’s own public data and the asking member’s own account. It follows your module toggles, and it will not disclose another member’s private account data.'
				}
			]
		},
		{
			id: 'accounts',
			heading: 'Accounts and servers',
			blocks: [
				{
					kind: 'text',
					text: 'You are responsible for activity under panel accounts you control and for bot permissions you grant in Discord. Keep credentials secure and revoke access when appropriate. Member accounts on public pages are reached with a per-member link; treat that link as private, since anyone holding it can view that member’s account page.'
				}
			]
		},
		{
			id: 'self-hosting',
			heading: 'Self-hosting and open source',
			blocks: [
				{
					kind: 'links',
					text: 'The project is free and open source under the MIT license. If you run your own deployment from source, you are the operator of that deployment: you control its database, its keys and its data, and these terms cover only the hosted Service we run. See the ',
					links: [
						{ label: 'license', href: THIRD_PARTY_LINKS.license },
						{ label: 'source repository', href: THIRD_PARTY_LINKS.repo }
					]
				},
				{
					kind: 'text',
					text: 'The optional selfbot path uses a user token and is not supported by Discord. If you choose to enable it, you do so on your own risk assessment and remain responsible for any consequences to the account involved.'
				}
			]
		},
		{
			id: 'availability',
			heading: 'Availability',
			blocks: [
				{
					kind: 'text',
					text: 'The Service is provided free of charge with no uptime commitment. Maintenance, Discord outages, rate limits from upstream providers and bugs can all interrupt it. Rate limits apply to public endpoints to keep the Service stable.'
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
					text: `You may stop using the Service at any time by removing the bot from your server. That stops all further collection, hides the server’s data immediately, and permanently deletes its configuration and member records after ${LEGAL_RETENTION_DAYS} days. Re-adding the bot inside that window restores it. We may suspend or terminate access if you breach these terms, create risk, or if required by law or Discord. Provisions that should survive, such as disclaimers, limitations, and indemnity, will survive termination.`
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
					links: [{ label: APP_URL.replace(/^https?:\/\//, ''), href: APP_URL }],
					tail: `To report a security vulnerability, email ${SECURITY_EMAIL} instead of opening a public issue.`
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
					text: `This policy describes what ${APP_NAME} Discord Bot (the "Service") stores and why, covering the web panel, the Discord bot, the public server pages and the optional AI features.`
				},
				{
					kind: 'text',
					text: 'Two roles matter throughout. A server owner decides which modules are on, and that decision determines what is processed about their members. We operate the hosted Service and the database behind it. Anyone self-hosting from source operates their own deployment, and this policy does not cover it.'
				}
			]
		},
		{
			id: 'panel-accounts',
			heading: 'Panel accounts',
			blocks: [
				{ kind: 'text', text: 'When you register a panel account to configure a bot or server, we store:' },
				{
					kind: 'list',
					items: [
						'Your username and email address, used to identify you and to send account email.',
						'A bcrypt hash of your password. We never store the password itself.',
						'Your most recent IP address, recorded at registration and overwritten on each successful sign-in, kept to detect abuse and duplicate accounts. Only the latest one is stored, and it is visible to the superadmin who operates the bot.',
						'Which servers you own or were invited to, and your staff tier in each.'
					]
				},
				{
					kind: 'text',
					text: 'Sign-in activity, including failed attempts, is written to the operational log with the username and IP address so that abuse and brute-force attempts can be spotted. Public endpoints are rate limited by IP, which is held only briefly for that purpose and is not written to the database.'
				},
				{
					kind: 'text',
					text: 'Sessions are held in Redis where configured, or in process memory otherwise, and expire on sign-out or after inactivity. A session cookie keeps you signed in; the demo login is protected by a self-hosted captcha, with no third-party captcha service involved.'
				}
			]
		},
		{
			id: 'server-config',
			heading: 'Server configuration',
			blocks: [
				{
					kind: 'text',
					text: 'For each server the bot joins we store the Discord server ID and name, its categories, channels and roles, your per-module settings, embed styles and templates, and the channel assignments made by /setup. Bot tokens and AI provider keys are stored per bot and are never sent back to the browser.'
				}
			]
		},
		{
			id: 'member-data',
			heading: 'Member data from Discord',
			blocks: [
				{
					kind: 'text',
					text: 'When a member interacts with an enabled module, we store the record that module needs. Nothing here is collected for its own sake; each item exists to make a feature work.'
				},
				{
					kind: 'defs',
					items: [
						{
							term: 'Identity',
							desc: 'Discord user ID, username, display name, server nickname, avatar, account creation date, server join date, booster status and preferred language.'
						},
						{
							term: 'Activity and XP',
							desc: 'Message counts, voice, video, streaming and AFK minutes, reaction counts, level, XP totals and a log of XP events with their source.'
						},
						{
							term: 'Economy',
							desc: 'Bag contents, purchases, item activations and their effects, bounties, gifts, and logs of item use for cooldowns and history.'
						},
						{
							term: 'Tasks and streaks',
							desc: 'Generated daily and weekly tasks, progress, claims, streak count, freezes and check-in cycle, plus the timezone offset needed to run them on your local day.'
						},
						{
							term: 'Minigames and assets',
							desc: 'Wagers, outcomes, simulated asset positions and their transaction logs.'
						},
						{
							term: 'Roles and moderation',
							desc: 'Role assignments, custom supporter roles, AFK status, warnings and moderation actions, staff ratings and reviews, feedback submissions, giveaway entries, quest progress and creator applications.'
						},
						{
							term: 'Message content',
							desc: 'Read only where a feature requires it, such as the message forwarder, moderation and AI chat. It is used to perform the action and is not retained as a general message archive.'
						}
					]
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
			id: 'public-pages',
			heading: 'Public pages and visibility',
			blocks: [
				{
					kind: 'text',
					text: 'If a server owner enables public statistics, that server gets pages at a public URL showing server totals, a leaderboard, a members directory with levels and roles, and per-member account pages. These pages need no login and can be indexed by search engines.'
				},
				{
					kind: 'text',
					text: 'A member account page is reached through a link derived from that member’s Discord ID and join date. Anyone with the link can open that page, so it should be treated as private. Members using the disguise item are hidden from public leaderboards and the members directory.'
				},
				{
					kind: 'text',
					text: 'Turning off public statistics removes every public page for that server, and the sub-toggles for items, minigames, assets and daily tasks control those sections individually.'
				}
			]
		},
		{
			id: 'ai-data',
			heading: 'AI features',
			blocks: [
				{
					kind: 'text',
					text: 'AI is off until an operator configures an endpoint, model and key. When it is on, the member’s message and the context needed to answer are sent to that provider. Chat history is kept per member per server in a session that expires 30 minutes after the last message. Voice audio is streamed to the configured provider while the bot is in the channel and is not stored by us afterwards.'
				},
				{
					kind: 'links',
					text: 'Depending on what the operator configured, that provider may be ',
					links: [
						{ label: 'Google', href: THIRD_PARTY_LINKS.google },
						{ label: 'OpenAI', href: THIRD_PARTY_LINKS.openai }
					],
					tail: 'or any other OpenAI-compatible endpoint, including a local model. Their policies govern that processing. Web search, page fetch, image generation and wiki reading send only the query or URL needed for the lookup.'
				}
			]
		},
		{
			id: 'third-parties',
			heading: 'Third-party services',
			blocks: [
				{
					kind: 'text',
					text: 'Beyond Discord and any AI provider, the Service contacts these only for the modules that use them:'
				},
				{
					kind: 'links',
					text: 'Live market prices for the assets market come from ',
					links: [{ label: 'CoinGecko', href: THIRD_PARTY_LINKS.coingecko }],
					tail: 'Requests carry no member data.'
				},
				{
					kind: 'links',
					text: 'Catalog watching reads public listings from ',
					links: [{ label: 'Roblox', href: THIRD_PARTY_LINKS.roblox }],
					tail: 'for the catalog items a server chooses to watch.'
				},
				{
					kind: 'links',
					text: 'Creator digests read public live data from ',
					links: [{ label: 'TikTok', href: THIRD_PARTY_LINKS.tiktok }],
					tail: 'for the accounts a server configures, and never a member’s private TikTok data.'
				},
				{
					kind: 'links',
					text: 'Wiki lookups query the ',
					links: [{ label: 'MediaWiki Action API', href: THIRD_PARTY_LINKS.mediawiki }],
					tail: 'of the wikis an operator adds, sending only the search term or page title.'
				},
				{
					kind: 'text',
					text: 'We also rely on the infrastructure needed to run the Service: hosting, a MySQL database, Redis for sessions and caching, and an email provider for account mail. We do not sell personal data, and there is no advertising or third-party analytics on the site.'
				}
			]
		},
		{
			id: 'cookies',
			heading: 'Cookies and similar technologies',
			blocks: [
				{
					kind: 'text',
					text: 'The website uses a session cookie to keep you signed in to the panel, and local storage for preferences such as language and theme. There are no advertising or tracking cookies.'
				}
			]
		},
		{
			id: 'how-we-use',
			heading: 'How we use information',
			blocks: [
				{
					kind: 'text',
					text: 'We use information to run the modules a server has enabled, to keep the Service secure and within rate limits, to respond to support requests, and to comply with law. We do not use member data to train AI models.'
				}
			]
		},
		{
			id: 'retention',
			heading: 'Retention and deletion',
			blocks: [
				{
					kind: 'text',
					text: `Removing the bot from a Discord server, or a member leaving one, marks that data for deletion and hides it right away. It stops appearing on leaderboards, the members directory and every public page immediately. After a ${LEGAL_RETENTION_DAYS}-day grace period the records are permanently deleted, and because everything is chained together by database constraints, the members, levels, items, tasks, assets, logs and settings go with them. If the bot was offline at the time, it catches up the next time it starts.`
				},
				{
					kind: 'text',
					text: `The grace period is there so accidents are recoverable. Re-adding the bot within those ${LEGAL_RETENTION_DAYS} days restores the server, and a member who rejoins gets their XP, level, items and history back as they were. Once the ${LEGAL_RETENTION_DAYS} days pass, the deletion is final and nothing can be restored.`
				},
				{
					kind: 'text',
					text: 'Deleting a bot from the panel removes every server under it at once, with no grace period, and deleting a panel account removes the account and what it owns.'
				},
				{
					kind: 'text',
					text: 'If you want your own member record removed sooner, or removed while the bot stays in the server, contact us and we will delete it.'
				},
				{
					kind: 'list',
					items: [
						'AI chat sessions expire 30 minutes after the last message.',
						'Wiki page reads are cached for about 10 minutes.',
						'Sessions expire on sign-out or after inactivity.',
						'Depleted items are purged automatically.',
						`Data marked for deletion is hidden immediately and permanently removed after ${LEGAL_RETENTION_DAYS} days.`
					]
				},
				{
					kind: 'text',
					text: 'Operational logs are kept only as long as needed to run and secure the Service. Backups may hold removed data for a short period before rotating out.'
				}
			]
		},
		{
			id: 'security',
			heading: 'Security',
			blocks: [
				{
					kind: 'text',
					text: 'Passwords are hashed with bcrypt. Traffic is served over HTTPS. Bot tokens and provider keys are stored server-side and never returned to the browser. Public endpoints are rate limited. Panel access is bounded by owner and staff tiers, and permissions map Discord roles to what they unlock.'
				},
				{
					kind: 'links',
					text: 'No method of transmission or storage is completely secure. If you find a vulnerability, email ',
					links: [{ label: SECURITY_EMAIL, href: `mailto:${SECURITY_EMAIL}` }],
					tail: 'rather than opening a public issue.'
				}
			]
		},
		{
			id: 'your-rights',
			heading: 'Your rights',
			blocks: [
				{
					kind: 'text',
					text: 'Depending on where you live, you may have rights to access, correct, delete, or export your personal data, or to object to certain processing. Contact us to exercise them; deletion of an individual member record is handled by us on request rather than through a panel control. A server owner can switch off the modules that collect data, and can take public pages dark, which stops further collection and hides existing records from public view.'
				}
			]
		},
		{
			id: 'children',
			heading: 'Children',
			blocks: [
				{
					kind: 'text',
					text: 'The Service is not directed at children under the minimum age Discord requires in their country. If you believe we hold data from a child below that age, contact us so we can delete it.'
				}
			]
		},
		{
			id: 'international',
			heading: 'Where data is processed',
			blocks: [
				{
					kind: 'text',
					text: 'The Service runs on hosted infrastructure that may be located outside your country, and the third parties listed above may process requests in their own regions. Using the Service means data may be transferred across borders for these purposes.'
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
					links: [{ label: APP_URL.replace(/^https?:\/\//, ''), href: APP_URL }],
					tail: `For security reports, email ${SECURITY_EMAIL}.`
				}
			]
		}
	]
};
