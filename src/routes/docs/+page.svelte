<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';

	const officialBotInviteUrl = 'https://discord.com/oauth2/authorize?client_id=1446572985849876640';

	const sections = [
		{ id: 'start', icon: 'fa-flag-checkered', label: 'Get started' },
		{ id: 'bots', icon: 'fa-robot', label: 'Bot vs selfbot' },
		{ id: 'setup-command', icon: 'fa-terminal', label: '/setup' },
		{ id: 'accounts', icon: 'fa-user-plus', label: 'Accounts & staff' },
		{ id: 'roles', icon: 'fa-users-gear', label: 'Who can do what' },
		{ id: 'permissions', icon: 'fa-user-shield', label: 'Permissions' },
		{ id: 'modules', icon: 'fa-toggle-on', label: 'Modules' },
		{ id: 'ai-chat', icon: 'fa-robot', label: 'AI chat' },
		{ id: 'ai-tools', icon: 'fa-toolbox', label: 'Search, fetch, images' },
		{ id: 'ai-wikis', icon: 'fa-book', label: 'Wiki knowledge' },
		{ id: 'shop', icon: 'fa-store', label: 'Items shop' },
		{ id: 'discord', icon: 'fa-discord', label: 'Discord menu' },
		{ id: 'selfhost', icon: 'fa-server', label: 'Self-host' }
	];

	const shopSteps = [
		{
			icon: 'fa-toggle-on',
			title: 'Enable Items',
			desc: 'On the server Public statistics config page, turn on the Items toggle. This unlocks buy and use actions. Public statistics must be on.'
		},
		{
			icon: 'fa-hashtag',
			title: 'Set the events channel',
			desc: 'Pick an Item Events Channel where steal, bomb, leech, gift and other announcements post. Keep it separate from the level channel. If unset, item events are not announced.'
		},
		{
			icon: 'fa-plus',
			title: 'Create items',
			desc: 'Open the admin Items page and add items. Each needs a name, an effect type, a description and an XP cost. Items live in the catalog and appear in every server that has Items enabled.'
		},
		{
			icon: 'fa-sliders',
			title: 'Tune the effect',
			desc: 'Each effect type has its own settings: percentages and cooldowns for steal/bomb, multiplier and scope for boost, spy success chance, and so on.'
		},
		{
			icon: 'fa-clock',
			title: 'Set availability (optional)',
			desc: 'Limit an item to a date range or to recurring days and times so it only shows in a window. Leave blank for always available.'
		},
		{
			icon: 'fa-eye',
			title: 'Control visibility',
			desc: 'Show in shop hides or reveals an item without deleting it. Allow use lets you freeze copies members already own. You can also gift copies straight to members.'
		},
		{
			icon: 'fa-bag-shopping',
			title: 'Members play',
			desc: 'Members open the shop from the Items button, spend XP, and use items from their bag (which holds up to 50). The Guide tab inside the shop explains every item to them.'
		},
		{
			icon: 'fa-list-check',
			title: 'Your prices drive tasks',
			desc: 'With Daily tasks on, your shop sets the economy: the median item cost sizes XP rewards, and item rewards are drawn from items priced near the value of the task or check-in day that earned them. Hidden and disabled items are never handed out.'
		}
	];

	const botKinds = [
		{
			icon: 'fa-robot',
			accent: '#5865f2',
			title: 'Official bot',
			what: 'The real Discord bot application you invite with an OAuth link. It runs almost everything: leveling, items, moderation, welcomer, booster, giveaways, AFK, feedback, staff rating, custom supporter roles, the /setup command, and every menu button.',
			fields: [
				{
					label: 'How to add',
					desc: 'Invite it with the OAuth link (the "Add the bot" button). It joins as a normal bot user with the permissions the features need.'
				},
				{
					label: 'Token',
					desc: 'For the hosted bot this is handled for you. Self-hosters store the bot token in the database bots table, not in Discord, and point the process at it with BOT_ID.'
				},
				{ label: 'Runs', desc: 'All standard features and slash/button interactions.' }
			]
		},
		{
			icon: 'fa-user-secret',
			accent: '#c0392b',
			title: 'Selfbot (optional)',
			what: 'An optional user-token client for features that need a real user account. Only two features require it: the Discord Quest notifier and the message Forwarder. Everything else uses the official bot.',
			fields: [
				{
					label: 'Requires a selfbot',
					desc: 'Discord Quest notifier and Message forwarder. Their config pages warn you if no selfbot is running for the server.'
				},
				{
					label: 'How to add',
					desc: 'Add a selfbot under the Selfbots page for the server and paste a user token. It is stored encrypted. Adding, starting, stopping, restarting and deleting are owner-only; staff see it read-only.'
				},
				{
					label: 'Risk',
					desc: 'A selfbot uses a user account token. Use it in line with Discord’s terms and your own risk assessment. It is entirely optional.'
				}
			]
		}
	];

	const tiers = [
		{
			icon: 'fa-crown',
			accent: '#d9a528',
			title: 'Owner',
			what: 'Full control of one server in the panel. The first owner claims the link from /setup.',
			can: [
				'Configure every module and permission for the server',
				'Invite, freeze and delete staff accounts (not other owners)',
				'Create and expire invite links',
				'Add, start, stop, restart and delete selfbots',
				'Invite more owners'
			]
		},
		{
			icon: 'fa-user-tie',
			accent: '#245f73',
			title: 'Staff',
			what: 'Helper access invited by an owner. What they can change depends on the permission roles.',
			can: [
				'View and change settings allowed by their permission roles',
				'Use staff features like the rating review queue',
				'View selfbots read-only (cannot start or manage them)',
				'Cannot invite, freeze or delete any account',
				'Cannot run /setup'
			]
		},
		{
			icon: 'fa-shield-halved',
			accent: '#c0392b',
			title: 'Superadmin',
			what: 'Global panel administrator (mainly relevant to self-hosters who run the whole instance).',
			can: [
				'Access every bot and server on the instance',
				'Manage and freeze any account, including owners',
				'Delete any account and expire any invite',
				'Effectively unrestricted across the panel'
			]
		}
	];

	const aiChatFields = [
		{ label: 'Enable AI chat', req: 'required', desc: 'When off, mentions are ignored. The URL, key and model must all be set before it can be turned on.' },
		{ label: 'API URL', req: 'required', desc: 'Any OpenAI-compatible endpoint. A trailing slash or a full /chat/completions URL both work.' },
		{ label: 'API key', req: 'required', desc: 'Stored per bot and never sent back to the browser. Leave blank when saving to keep the current key.' },
		{ label: 'Model name', req: 'required', desc: 'The model id your endpoint expects, for example gemini-3.6-flash or gpt-4o.' },
		{ label: 'Reasoning', req: 'optional', desc: 'Off, Low, Medium, High or Extra high. Thinking options are matched to the model you named.' },
		{
			label: 'System prompt',
			req: 'optional',
			desc: 'Sets the personality and rules for chat. Voice has its own prompt. Use {{today}} to insert the current date.'
		},
		{
			label: 'Enable voice AI',
			req: 'optional',
			desc: 'Lets members ask the bot in chat to join their voice channel and talk out loud. Needs AI chat on, plus its own Google AI key and voice model. Requires Redis.'
		},
		{ label: 'Voice model', req: 'optional', desc: 'A Gemini Live model, for example gemini-3.1-flash-live-preview. Only needed when voice AI is on.' },
		{
			label: 'Voice',
			req: 'optional',
			desc: 'Which of the 30 Gemini voices the bot speaks with. Listen to them in Google AI Studio first. Leave on Default to use the model default.'
		},
		{
			label: 'Voice API URL, key and system prompt',
			req: 'optional',
			desc: 'Voice has its own Google AI key and personality, separate from chat. Both are required to turn voice on. Always Gemini Live, so no endpoint to set.'
		}
	];

	const aiToolFields = [
		{
			label: 'Web search URL, model and key',
			req: 'optional',
			desc: 'Fill all three and the bot can search the live web. Give the base URL, including any version segment — /search is appended for you.'
		},
		{
			label: 'Web fetch URL, model and key',
			req: 'optional',
			desc: 'Fill all three and the bot can read a page it was linked to. Base URL again — /web/fetch is appended for you.'
		},
		{
			label: 'Image URL, model and key',
			req: 'optional',
			desc: 'Fill all three and the bot can draw pictures. Base URL again — /images/generations is appended for you. Images come back at 512x512.'
		}
	];

	const aiToolRules = [
		{
			icon: 'fa-toggle-off',
			title: 'Off until filled',
			desc: 'Each tool needs its URL, model and key. Until all three are set the bot is never offered that tool.'
		},
		{ icon: 'fa-brain', title: 'The AI decides', desc: 'Nothing is forced. It searches, reads or draws only when the question calls for it.' },
		{ icon: 'fa-book', title: 'Wikis come first', desc: 'Game questions go to your wikis. Web search is for what the wikis do not cover.' },
		{ icon: 'fa-link', title: 'Real links only', desc: 'Web fetch only opens a URL a member sent or a search result returned, never an invented one.' },
		{
			icon: 'fa-image',
			title: 'Pictures post themselves',
			desc: 'A generated image is uploaded straight to the channel. In voice it lands in the voice channel chat.'
		},
		{ icon: 'fa-key', title: 'Keys stay server side', desc: 'Every key is write-only. Save with the box blank to keep the key you already have.' }
	];

	const aiVoiceRules = [
		{ icon: 'fa-hand-point-right', title: 'Ask it to join', desc: 'A member says "join voice" to the bot in chat. It joins the channel that member is in.' },
		{ icon: 'fa-user-slash', title: 'Not in a channel', desc: 'If the member is not in voice, the bot says so instead of joining.' },
		{ icon: 'fa-ban', title: 'One call at a time', desc: 'If it is already in a call, it tells the next person it is busy and stays where it is.' },
		{
			icon: 'fa-comment-dots',
			title: 'Say "hey stupid"',
			desc: 'A trained wake-word model listens for that exact phrase, so a busy channel never sets it off.'
		},
		{ icon: 'fa-lock', title: 'One speaker at a time', desc: 'Whoever wakes it holds the conversation. Say you are done to release it for the next person.' },
		{ icon: 'fa-microphone', title: 'Mutes when idle', desc: 'It answers, then mutes itself. The mute icon shows whether it is listening.' },
		{ icon: 'fa-users', title: 'Follows the inviter', desc: 'Moved to another channel, it goes back to whoever invited it. Only they can send it away.' },
		{ icon: 'fa-door-open', title: 'Leaving', desc: 'Ask it to leave, or it leaves when the member who invited it leaves, or when the channel empties.' },
		{ icon: 'fa-clock', title: 'Quiet for 3 minutes', desc: 'It says a short goodbye out loud, then disconnects. There is no fixed call length limit.' }
	];

	const aiWikiFields = [
		{ label: 'API URL', req: 'required', desc: 'The wiki api.php endpoint, usually /w/api.php or /api.php. Press Test to check it and fill in the name.' },
		{ label: 'Name', req: 'required', desc: 'What the AI calls this wiki when it picks one. Keep it short.' },
		{ label: 'Description', req: 'optional', desc: 'What the wiki covers. This is how the AI chooses the right one when a bot has several.' },
		{ label: 'Site URL', req: 'optional', desc: 'The wiki home page, used when the bot links a page it read.' },
		{
			label: 'Relay URL',
			req: 'optional',
			desc: 'Only needed when a wiki blocks your server. Points at a relay.php you host somewhere the wiki does accept. Leave blank to connect straight to the wiki.'
		},
		{ label: 'Relay key', req: 'optional', desc: 'The secret set inside relay.php. Required whenever a relay URL is filled in.' },
		{ label: 'Enabled', req: 'optional', desc: 'Turn a wiki off without deleting it. Disabled wikis are ignored by chat and voice.' }
	];

	const aiWikiRules = [
		{ icon: 'fa-plus', title: 'Add a wiki', desc: 'Open the bot, go to the Wikis tab and paste the api.php URL. Any MediaWiki site works, including Fandom.' },
		{ icon: 'fa-check', title: 'Test it', desc: 'Test confirms the endpoint answers and is really a wiki, then fills in the name for you.' },
		{ icon: 'fa-comments', title: 'Ask normally', desc: 'Members just ask. Full questions work, not only exact page names.' },
		{ icon: 'fa-list', title: 'Real numbers', desc: 'Prices, weights and drop rates come from the wiki infobox, so stat answers are exact.' },
		{ icon: 'fa-file-lines', title: 'Reads the whole page', desc: 'Skin lists, tables and changelogs come through in full. Nothing is trimmed.' },
		{ icon: 'fa-globe', title: 'Any wiki, any language', desc: 'No per-game rules. Ask in Indonesian and it still finds the English page.' },
		{ icon: 'fa-bolt', title: 'Cached 10 minutes', desc: 'Repeat questions answer instantly and the wiki is not hammered.' },
		{
			icon: 'fa-check',
			title: 'Applies right away',
			desc: 'Chat picks up a new wiki on the next message. Voice picks it up on the next call. No restart needed.'
		}
	];

	const aiWikiRelaySteps = [
		{ icon: 'fa-ban', title: 'When you need it', desc: 'Some wikis refuse requests from server IPs. Test says the wiki refused, not that your URL is wrong.' },
		{
			icon: 'fa-plus',
			title: 'Put relay.php online',
			desc: 'Copy scripts/relay.php to any hosting the wiki does accept, often cheap shared hosting, and open it over https.'
		},
		{
			icon: 'fa-lock',
			title: 'Set a secret',
			desc: 'Edit RELAY_KEY in the file to a long random string. The relay refuses to run while the key is still the default.'
		},
		{ icon: 'fa-book', title: 'Fill both fields', desc: 'Paste the relay address into Relay URL and the same secret into Relay key, then press Test.' },
		{ icon: 'fa-check', title: 'Test goes through it', desc: 'With a relay set, Test uses the relay too, so a green result means the whole path works.' },
		{
			icon: 'fa-rotate',
			title: 'One relay, many wikis',
			desc: 'The same relay serves any wiki. Set the fields per wiki, and leave them blank for wikis that work directly.'
		}
	];

	const envVars = [
		{ label: 'BASE_URL', req: 'required', desc: 'Public base URL of your site, e.g. https://bot.example.com.' },
		{
			label: 'DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME',
			req: 'required',
			desc: 'MySQL connection. Or provide a single DATABASE_URL instead (mysql://user:pass@host:port/db).'
		},
		{
			label: 'MAIL_HOST / MAIL_USERNAME / MAIL_PASSWORD',
			req: 'required',
			desc: 'SMTP for account notification emails. MAIL_PORT is optional (defaults to 587).'
		},
		{ label: 'CAPTCHA_SECRET', req: 'required', desc: 'A long random secret used by the demo login captcha.' },
		{ label: 'REDIS_URL', req: 'optional', desc: 'Redis for sessions and caching, e.g. redis://default:pass@localhost:6379/0.' },
		{ label: 'BOT_ID', req: 'per bot process', desc: 'The database id of the bot this process runs. The token lives in the database, not in env.' },
		{
			label: 'OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_SERVICE_NAME',
			req: 'optional',
			desc: 'OpenTelemetry log export. Telemetry only turns on when the endpoint is set.'
		}
	];

	const selfhostSteps = [
		{
			icon: 'fa-database',
			title: 'Provision MySQL',
			desc: 'Create a database. The app builds its schema and runs migrations automatically on first start. Redis is optional.'
		},
		{
			icon: 'fa-file-lines',
			title: 'Fill the .env',
			desc: 'Copy .env.example to .env and set DB_*, MAIL_*, BASE_URL and CAPTCHA_SECRET. Add REDIS_URL if you use Redis.'
		},
		{ icon: 'fa-box-open', title: 'Install and build', desc: 'Run npm install then npm run build. The Node adapter outputs a server bundle.' },
		{
			icon: 'fa-circle-play',
			title: 'Run it',
			desc: 'Start with node build for production, or npm run dev while developing. The schema is created on first boot.'
		},
		{
			icon: 'fa-robot',
			title: 'Register the bot',
			desc: 'Create a bot in the Discord Developer Portal, add its token and application id to the bots table, then set BOT_ID for the bot process and restart.'
		}
	];

	const startSteps = [
		{ icon: 'fa-discord', title: 'Add the bot', desc: 'It joins instantly and posts a short guide with the docs and support links.' },
		{
			icon: 'fa-terminal',
			title: 'Run /setup',
			desc: 'Builds the menu category and posts the interface. Safe to re-run: only missing channels are created. Owner or Administrator only.'
		},
		{
			icon: 'fa-right-to-bracket',
			title: 'Open the panel',
			desc: 'After /setup, register the owner account from the link it gives you, then sign in to the web panel to configure everything.'
		}
	];

	const setupChannels = [
		{ name: '「💻」menu', desc: 'Holds the main interface button members click to open the bot menu.' },
		{ name: '「⚙️」bot-updates', desc: 'Bot update notifications.' },
		{ name: '「🚪」welcome', desc: 'Where welcome messages post.' },
		{ name: '「🚀」booster', desc: 'Where server boost messages post.' },
		{ name: '「🔨」moderation', desc: 'Moderation (ban/kick) log embeds.' },
		{ name: '「🆙」level', desc: 'Level and rank progress notifications.' },
		{ name: '「🎁」giveaway', desc: 'Giveaway posts and winner announcements.' },
		{ name: '「⭐」staff-rating', desc: 'Staff rating reports and updates.' },
		{ name: '「📜」discord-quest', desc: 'Discord Quest notifications.' },
		{ name: '「📽️」content-creator', desc: 'Content creator posts and TikTok LIVE alerts.' },
		{ name: '「👗」roblox-catalog', desc: 'Roblox catalog item alerts.' },
		{ name: '「🛍️」items', desc: 'Link to the items shop.' }
	];

	const accountFields = [
		{
			label: 'Owner',
			desc: 'Full control of the server in the panel. The first owner registers from the link /setup generates. Owners can invite more owners and staff.'
		},
		{
			label: 'Staff',
			desc: 'Staff-tier panel access, invited by an owner. What they can change is set by Permissions, separate from Discord chat or moderation rights.'
		},
		{
			label: 'Send Invite',
			desc: 'Pick an invite type (Owner or Staff), choose Discord members, and the bot DMs them a registration link that expires 24 hours after creation.'
		},
		{
			label: 'Accounts list',
			desc: 'Every registered account with its type. Lock/unlock freezes an account (frozen accounts cannot log in), and delete removes it permanently.'
		},
		{
			label: 'Invite Links',
			desc: 'All generated invites with their status (Pending, Used, Expired) and a countdown. Expire a pending invite to revoke it before use.'
		}
	];

	const permissionRoles = [
		{ label: 'Admin Roles', desc: 'Full access to all bot features and configuration.' },
		{ label: 'Staff Roles', desc: 'Used for staff features and staff-related filtering.' },
		{ label: 'Content Creator Roles', desc: 'Roles treated as content creators in permissions and member filtering.' },
		{ label: 'Supporter Roles', desc: 'Marks members as supporters for supporter-only features.' },
		{ label: 'Member Roles', desc: 'Required to apply as a content creator, and used for role mentions and member filtering.' }
	];

	const modules = [
		{
			id: 'leveling',
			icon: 'fa-star',
			accent: '#d9a528',
			title: 'Leveling & XP',
			what: 'Chat and voice activity earn XP that feeds levels, role rewards and leaderboards.',
			fields: [
				{ label: 'Leveling module', desc: 'Master toggle. When off, XP, voice time and the leveling Discord UI are disabled.' },
				{ label: 'Base XP', desc: 'XP needed to reach level 2 (50 to 1000). Higher levels scale from this and the multiplier.' },
				{ label: 'Multiplier', desc: 'Exponential multiplier for level requirements (1.0 to 2.0). Higher makes each level progressively harder.' },
				{
					label: 'XP Per Message',
					desc: 'XP awarded per eligible message (5 to 100). The message must pass the cooldown. Every human member earns XP; bots never do.'
				},
				{ label: 'Message Cooldown (seconds)', desc: 'Minimum gap between messages that earn XP (0 to 180). Messages sent too fast award nothing.' },
				{ label: 'Active Voice XP', desc: 'XP granted each interval while active in voice (5 to 100).' },
				{ label: 'AFK Voice XP', desc: 'XP granted each interval while AFK in voice (5 to 100).' },
				{ label: 'Voice Cooldown (seconds)', desc: 'How often voice XP is awarded (0 to 180). The voice XP above is granted each interval.' },
				{ label: 'Video / camera XP', desc: 'Extra XP per voice tick while your camera is on, even if muted. 0 disables. Stacks with voice XP.' },
				{ label: 'Live stream XP', desc: 'Extra XP per voice tick while using Go Live, even if muted. 0 disables. Stacks with voice and video XP.' },
				{ label: 'Level Progress Notification Channel', desc: 'Channel for level-up and rank notifications.' }
			]
		},
		{
			id: 'items',
			icon: 'fa-store',
			accent: '#733e24',
			title: 'Items & economy',
			what: 'A per-server shop of PvP and utility items bought with XP. Items are created in the global admin Items page; each server enables the system from the Public statistics config page (Items toggle + channel). Requires Public statistics to be on.',
			fields: [
				{ label: 'Items toggle (under Public statistics)', desc: 'When off, the Items tab and all buy/use actions are disabled for this server.' },
				{
					label: 'Item Events Channel',
					desc: 'Where steal, bomb, leech, gift and other item announcements post. Keep it separate from the level channel. If unset, item events are not announced.'
				},
				{
					label: 'Item: Name / Effect type / Description / Cost (XP)',
					desc: 'Per item in the admin catalog: its display name, what it does, the hover-card text and its XP price.'
				},
				{
					label: 'Item: effect settings',
					desc: 'Per effect type: Steal/Bomb use Min %, Max %, Cooldown, Victim immunity; Boost uses Multiplier, Duration, Scope (all/message/voice); Shield/Reflect/Disguise use Duration; Insurance uses Refund %, Duration, Cooldown; Gift uses Gift amount, Tax %; Leech uses Skim %, Duration; Bounty uses Bounty amount; Spy uses Spy success chance %.'
				},
				{
					label: 'Item: Availability',
					desc: 'Optional From/To dates (UTC) and recurring days plus From/To times (HH:MM) so an item only appears in a window.'
				},
				{ label: 'Item: Show in shop / Allow use', desc: 'Hide an item from the shop, or block using copies members already own, without deleting it.' }
			]
		},
		{
			id: 'welcomer',
			icon: 'fa-hand-sparkles',
			accent: '#5a8a1f',
			title: 'Welcomer',
			what: 'Greets new members with a custom message in one or more channels.',
			fields: [
				{ label: 'Welcomer module', desc: 'When off, welcome messages are not sent.' },
				{ label: 'Welcome Channels', desc: 'One or more channels welcome messages post to.' },
				{ label: 'Welcome Messages', desc: 'Your message templates. Placeholders: {user}, {server}, {memberCount}, {accountAge}.' }
			]
		},
		{
			id: 'booster',
			icon: 'fa-rocket',
			accent: '#f47fff',
			title: 'Booster messages',
			what: 'Thanks members who boost the server.',
			fields: [
				{ label: 'Booster module', desc: 'When off, boost messages are not sent.' },
				{ label: 'Boost Channels', desc: 'One or more channels boost messages post to.' },
				{ label: 'Boost Messages', desc: 'Your templates. Placeholders: {user}, {server}, {boostLevel}, {totalBoosts}.' }
			]
		},
		{
			id: 'giveaway',
			icon: 'fa-gift',
			accent: '#a8327d',
			title: 'Giveaways',
			what: 'Run giveaways with entry rules and winner selection from Discord.',
			fields: [
				{ label: 'Giveaway module', desc: 'When off, giveaways and their Discord UI are disabled.' },
				{ label: 'Giveaway Channel', desc: 'Where giveaways post and winners are announced.' },
				{ label: 'Creator can participate', desc: 'Allow giveaway creators to enter their own giveaways.' }
			]
		},
		{
			id: 'afk',
			icon: 'fa-moon',
			accent: '#4b6584',
			title: 'AFK',
			what: 'Lets members flag themselves AFK; the bot adjusts their nickname and warns anyone who mentions them.',
			fields: [{ label: 'AFK module', desc: 'When off, the AFK button still shows but says the feature is turned off, and all AFK behavior stops.' }]
		},
		{
			id: 'feedback',
			icon: 'fa-comment-dots',
			accent: '#1d6f8a',
			title: 'Feedback',
			what: 'Routes member feedback into a channel, optionally pinging a role.',
			fields: [
				{ label: 'Feedback module', desc: 'When off, feedback submissions and their Discord UI are disabled.' },
				{ label: 'Feedback Channel', desc: 'Where feedback submissions post.' },
				{ label: 'Feedback Role (optional)', desc: 'Role to mention when feedback is submitted.' }
			]
		},
		{
			id: 'staff-rating',
			icon: 'fa-ranking-star',
			accent: '#c8911a',
			title: 'Staff rating',
			what: 'Members rate staff; approved ratings drive dynamic roles placed within a hierarchy range.',
			fields: [
				{ label: 'Staff rating module', desc: 'When off, staff rating flows and their Discord UI are disabled.' },
				{ label: 'Role Start (Top)', desc: 'Highest boundary role. Rating roles are created/updated below it.' },
				{ label: 'Role End (Bottom)', desc: 'Lowest boundary role. Rating roles are created/updated above it.' },
				{ label: 'Rating Cooldown (Days)', desc: 'Days a member must wait before rating the same staff member again (1 to 30).' },
				{ label: 'Review channel', desc: 'Where submissions go for staff review.' },
				{ label: 'Rating Update Channel', desc: 'Where rating updates and announcements are sent.' },
				{ label: 'Pending review role (optional)', desc: 'Role to mention on pending submissions.' }
			]
		},
		{
			id: 'moderation',
			icon: 'fa-gavel',
			accent: '#c0392b',
			title: 'Moderation',
			what: 'Logs ban and kick actions to a channel.',
			fields: [
				{ label: 'Moderation module', desc: 'When off, moderation is disabled, including ban and kick log embeds.' },
				{ label: 'Moderation Logs Channel', desc: 'Where moderation logs post.' }
			]
		},
		{
			id: 'notifications',
			icon: 'fa-bell',
			accent: '#d35400',
			title: 'Channel notifications',
			what: 'Lets members opt in to notifications for channels you list, from the bot menu.',
			fields: [
				{ label: 'Channel notification module', desc: 'When off, per-channel notifications and the menu action are disabled.' },
				{ label: 'Channels', desc: 'The channels members can opt in to follow.' }
			]
		},
		{
			id: 'custom-supporter-role',
			icon: 'fa-palette',
			accent: '#7b5ea7',
			title: 'Custom supporter roles',
			what: 'Lets supporters create a personalized role within a range you define.',
			fields: [
				{ label: 'Custom supporter role module', desc: 'When off, custom supporter role creation from the bot is disabled.' },
				{ label: 'Role Start (Top)', desc: 'Highest position where custom roles are created. New roles sit below it.' },
				{ label: 'Role End (Bottom)', desc: 'Lowest position where custom roles are created. New roles sit above it.' }
			]
		},
		{
			id: 'content-creator',
			icon: 'fa-video',
			accent: '#e0405e',
			title: 'Content creator / TikTok',
			what: 'Handles creator applications and posts TikTok LIVE alerts.',
			fields: [
				{ label: 'Content creator module', desc: 'When off, creator admission and its Discord UI are disabled.' },
				{ label: 'Admission Channel', desc: 'Staff approval queue for pending applications.' },
				{ label: 'Target Broadcast Channel', desc: 'Where TikTok LIVE notifications from approved creators post.' },
				{ label: 'Admission Cooldown (Days)', desc: 'How long a member waits before reapplying (1 to 30).' },
				{ label: 'Pending Admission Role (optional)', desc: 'Role to mention when a new application arrives.' }
			]
		},
		{
			id: 'discord-quest-notifier',
			icon: 'fa-scroll',
			accent: '#5865f2',
			title: 'Discord Quest notifier',
			what: 'Posts Discord Quest alerts. Needs a running selfbot configured for the server.',
			fields: [
				{ label: 'Quest notifier module', desc: 'When off, quest polling and posts are disabled. Requires a running selfbot when enabled.' },
				{ label: 'Notification channel', desc: 'Where the official bot posts quest embeds.' },
				{ label: 'HTTP(S) proxy (optional)', desc: 'Used only for the quest list endpoint. Leave empty for a direct connection.' },
				{ label: 'Auto quest enrollment', desc: 'When on, notifications include an Enroll button for quick enrollment with a user token.' }
			]
		},
		{
			id: 'forwarder',
			icon: 'fa-share-from-square',
			accent: '#2f8f4e',
			title: 'Message forwarder',
			what: 'Forwards messages from a selfbot channel into a channel in this server. Add as many forwarders as you need.',
			fields: [
				{ label: 'Forwarder module', desc: 'When off, message forwarding from selfbots is disabled.' },
				{ label: 'Selfbot', desc: 'The selfbot account that forwards messages.' },
				{ label: 'Server (where selfbot is)', desc: 'The server the selfbot is connected to.' },
				{ label: 'From Channels', desc: 'Messages from these source channels are forwarded.' },
				{ label: 'Target Channel', desc: 'Where forwarded messages post in this server.' },
				{ label: 'Role Pings (optional)', desc: 'Roles to mention on forwarded messages.' },
				{ label: 'Mention filter', desc: 'Only forward messages that mention the selfbot.' },
				{ label: 'Tag (optional)', desc: 'A label so you can recognize this forwarder later.' }
			]
		},
		{
			id: 'roblox-catalog-notifier',
			icon: 'fa-cubes',
			accent: '#1f9e8f',
			title: 'Roblox catalog watch',
			what: 'Posts alerts when new free, limited or official Roblox catalog items appear.',
			fields: [
				{ label: 'Roblox catalog module', desc: 'When off, Roblox catalog polling and posts are disabled.' },
				{ label: 'Notification channel', desc: 'Where the bot posts Roblox catalog embeds.' }
			]
		},
		{
			id: 'public-statistics',
			icon: 'fa-chart-pie',
			accent: '#245f73',
			title: 'Public statistics',
			what: 'The master switch for all public pages: server statistics, leaderboard, members, and the per-member account (Overview, History, Guide). Items, Minigames, Assets and Daily tasks are enabled here as sub-toggles.',
			fields: [
				{
					label: 'Public statistics module',
					desc: 'Master switch. When off, the public pages still load but show a "turned off" notice instead of data.'
				},
				{
					label: 'Items / Minigames / Assets',
					desc: 'Sub-toggles under public statistics. Each unlocks its account tab (and channel, for Items/Minigames). Tabs stay visible when off and explain that the feature is disabled.'
				},
				{
					label: 'Daily tasks',
					desc: 'Sub-toggle that adds the Task tab: 9 daily and 9 weekly auto-generated goals, a 7-day check-in, and streaks. Nothing to configure — goals are sized per member from their own recent activity, and tasks for a feature you turned off never appear. Item rewards come from your shop (needs Items on) and streak milestones post to the item events channel.'
				},
				{ label: 'Public URL', desc: 'The generated public address, shown when enabled. Derived from the server name.' }
			]
		}
	];

	const discordMenu = [
		{ label: '📋 Menu', desc: 'The main button in the menu channel. Open to every member; every feature button is always listed.' },
		{ label: '💎 Custom Supporter Role', desc: 'Opens a modal to create or edit a personal role (name, color, icon).' },
		{ label: '🎉 Create Giveaway', desc: 'Starts the giveaway flow: pick an eligibility role, then fill the details form.' },
		{ label: '⏸️ Set AFK Status', desc: 'Opens the AFK modal, or shows your current AFK status with a Remove AFK button.' },
		{ label: '💬 Submit Feedback', desc: 'Opens the feedback modal with a message field and an anonymous option.' },
		{ label: '🛡️ Staff Rating', desc: 'Pick a staff member, choose a 1 to 5 score and category, and submit a rating.' },
		{ label: '🎬 Content Creator', desc: 'Shows the creator list and an Apply button (TikTok username plus reason).' },
		{ label: '🔔 Notifications', desc: 'Opens a selector to subscribe to the notification channels you enabled.' },
		{ label: '🌐 Select Language', desc: 'Switches the Discord interface language (English or Indonesian).' },
		{ label: '🌐 Statistics', desc: 'Link to the public stats page.' },
		{ label: '👤 Account', desc: 'Link to the member account (Overview, Task, Items, Minigames, Assets, History, Guide).' }
	];

	function reveal(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') {
			node.classList.add('in');
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						(e.target as HTMLElement).classList.add('in');
						io.unobserve(e.target);
					}
				}
			},
			{ threshold: 0.08 }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}
</script>

<svelte:head>
	<title>Documentation | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Set up {APP_NAME} Bot from scratch: run /setup, register, invite staff, set permissions, and configure every module field by field."
	/>
	<meta name="theme-color" content="#245f73" />
</svelte:head>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader />

	<main class="m-main">
		<div class="m-inner">
			<div class="g-wrap">
				<header class="g-hero" use:reveal>
					<div class="g-hero-badge"><i class="fas fa-book-open"></i></div>
					<h1 class="g-hero-title">Set up {APP_NAME} Bot</h1>
					<p class="g-hero-sub">
						From adding the bot to configuring every module, field by field. Everything is set in the browser; members use it through the Discord menu.
					</p>
					<a href={officialBotInviteUrl} class="m-btn m-btn--primary g-docs-cta" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						Add the bot to start
					</a>
				</header>

				<nav class="g-docs-nav" aria-label="Sections">
					{#each sections as s}
						<a href="#{s.id}" class="g-docs-navlink"><i class="fas {s.icon}"></i>{s.label}</a>
					{/each}
				</nav>

				<section id="start" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-flag-checkered"></i>Get started</h2>
					<p class="g-sec-lead">Three steps take you from nothing to a configurable server.</p>
					<div class="g-steps">
						{#each startSteps as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="bots" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-robot"></i>Official bot vs selfbot</h2>
					<p class="g-sec-lead">The official bot runs everything. A selfbot is optional and only needed for two features.</p>
					<div class="g-modules">
						{#each botKinds as b, i}
							<article class="g-mod" style="--ac: {b.accent}; --d: {i * 60}ms">
								<div class="g-mod-head">
									<span class="g-mod-ic"><i class="fas {b.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{b.title}</h3>
										<p>{b.what}</p>
									</div>
								</div>
								<div class="g-fieldlist">
									{#each b.fields as f}
										<div class="g-field">
											<span class="g-field-key">{f.label}</span>
											<span class="g-field-val">{f.desc}</span>
										</div>
									{/each}
								</div>
							</article>
						{/each}
					</div>
				</section>

				<section id="setup-command" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-terminal"></i>The /setup command</h2>
					<p class="g-sec-lead">
						Run <code>/setup</code> in Discord (owner or Administrator only). It creates a <strong>{APP_NAME} Menu</strong> category with these channels and posts
						the bot interface in the menu channel. If no owner account exists yet, it hands you a registration link to claim ownership.
					</p>
					<div class="g-fieldlist">
						{#each setupChannels as c}
							<div class="g-field">
								<span class="g-field-key">{c.name}</span>
								<span class="g-field-val">{c.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="accounts" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-user-plus"></i>Accounts &amp; staff</h2>
					<p class="g-sec-lead">Sign in with Discord. The person who claims the first invite is the owner; they bring in helpers from the Accounts page.</p>
					<div class="g-fieldlist">
						{#each accountFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}</span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="roles" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-users-gear"></i>Who can do what</h2>
					<p class="g-sec-lead">
						Account tiers control who manages the panel. They are separate from the Discord permission roles below, which control who can use features in
						Discord.
					</p>
					<div class="g-modules">
						{#each tiers as t, i}
							<article class="g-mod" style="--ac: {t.accent}; --d: {i * 60}ms">
								<div class="g-mod-head">
									<span class="g-mod-ic"><i class="fas {t.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{t.title}</h3>
										<p>{t.what}</p>
									</div>
								</div>
								<ul class="g-cando">
									{#each t.can as c}
										<li>{c}</li>
									{/each}
								</ul>
							</article>
						{/each}
					</div>
				</section>

				<section id="permissions" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-user-shield"></i>Permissions</h2>
					<p class="g-sec-lead">Map Discord roles to what they unlock. Set these on the Permissions page.</p>
					<div class="g-fieldlist">
						{#each permissionRoles as r}
							<div class="g-field">
								<span class="g-field-key">{r.label}</span>
								<span class="g-field-val">{r.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="modules" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-toggle-on"></i>Modules, field by field</h2>
					<p class="g-sec-lead">Each module has a master toggle plus its own settings. Turn on only what you need.</p>
					<div class="g-modules">
						{#each modules as m, i}
							<article id="mod-{m.id}" class="g-mod" style="--ac: {m.accent}; --d: {(i % 4) * 60}ms">
								<div class="g-mod-head">
									<span class="g-mod-ic"><i class="fas {m.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{m.title}</h3>
										<p>{m.what}</p>
									</div>
								</div>
								<div class="g-fieldlist">
									{#each m.fields as f}
										<div class="g-field">
											<span class="g-field-key">{f.label}</span>
											<span class="g-field-val">{f.desc}</span>
										</div>
									{/each}
								</div>
							</article>
						{/each}
					</div>
				</section>

				<section id="ai-chat" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-robot"></i>AI chat</h2>
					<p class="g-sec-lead">
						Members mention the bot to talk to it, or reply to one of its messages to keep going without mentioning again. Set this on the bot panel under the
						AI tab, not per server, so every server the bot is in shares one configuration. Each member keeps their own conversation in each server. Restart the
						bot after saving.
					</p>
					<div class="g-fieldlist">
						{#each aiChatFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">Voice: how it behaves</h3>
					<p class="g-sec-lead">Everyone in the channel is heard by one shared session.</p>
					<div class="g-steps">
						{#each aiVoiceRules as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="ai-tools" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-toolbox"></i>Web search, fetch and images</h2>
					<p class="g-sec-lead">
						Three optional tools the AI reaches for on its own: searching the live web, reading a page it was linked to, and drawing a picture. Each is a
						separate URL, model and key on the bot panel under the AI tab, so they can point at different providers. Any OpenAI-compatible gateway works.
						Restart the bot after saving.
					</p>
					<div class="g-fieldlist">
						{#each aiToolFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">How it works</h3>
					<div class="g-steps">
						{#each aiToolRules as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="ai-wikis" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-book"></i>Wiki knowledge</h2>
					<p class="g-sec-lead">
						Without this, the AI answers game questions from memory and gets them wrong. Add a wiki and it looks the answer up instead. Set this on the bot
						panel under the Wikis tab. It applies to chat and voice alike, and to every server the bot is in.
					</p>
					<div class="g-fieldlist">
						{#each aiWikiFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">How it works</h3>
					<div class="g-steps">
						{#each aiWikiRules as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">When a wiki blocks your server</h3>
					<p class="g-sec-lead">
						A few wiki hosts refuse traffic coming from servers, so the bot gets turned away even though the address is right. A relay fixes this: it forwards
						the lookup from somewhere the wiki does accept. Only the wikis you point at it are affected, everything else keeps connecting directly.
					</p>
					<div class="g-steps">
						{#each aiWikiRelaySteps as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="shop" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-store"></i>Set up the items shop</h2>
					<p class="g-sec-lead">
						Two parts: enable the module per server, then create items in the admin catalog. Items are shared across every server that turns Items on.
					</p>
					<div class="g-steps">
						{#each shopSteps as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="discord" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fab fa-discord"></i>The Discord menu</h2>
					<p class="g-sec-lead">
						Members click the Menu button in the menu channel. Every button is always shown — if a feature is off or needs a role, clicking it explains why.
					</p>
					<div class="g-fieldlist">
						{#each discordMenu as d}
							<div class="g-field">
								<span class="g-field-key">{d.label}</span>
								<span class="g-field-val">{d.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="selfhost" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-server"></i>Self-host setup</h2>
					<p class="g-sec-lead">The project is open source under MIT. Run your own instance with Node, MySQL and optional Redis.</p>
					<div class="g-steps">
						{#each selfhostSteps as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
					<h3 class="g-sub-head">Environment variables</h3>
					<p class="g-sec-lead">Copy <code>.env.example</code> to <code>.env</code> and fill these in.</p>
					<div class="g-fieldlist">
						{#each envVars as e}
							<div class="g-field">
								<span class="g-field-key">{e.label}<span class="g-field-tag g-field-tag--{e.req === 'optional' ? 'opt' : 'req'}">{e.req}</span></span>
								<span class="g-field-val">{e.desc}</span>
							</div>
						{/each}
					</div>
				</section>
			</div>
		</div>
	</main>

	<MainFooter />
</div>
