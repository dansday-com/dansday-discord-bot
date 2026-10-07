import { EFFECTS, EFFECT_SPIN_COST } from './effects.js';
import { APP_URL } from './frontend/panelServer.js';
import { imageSizeLabel } from './images.js';
import { serverLanguageList } from './languages.js';
import { MESSAGE_LIMITS, MESSAGE_VIDEO_FORMATS_LABEL, messageUploadLimit } from './messages.js';

export const DOCS_TITLE = 'Bot documentation';
export const DOCS_URL = `${APP_URL}/docs`;

const EFFECT_NAMES = EFFECTS.map((e) => e.label)
	.join(', ')
	.replace(/, ([^,]*)$/, ' or $1');

export const DOCS_HERO = {
	heading: 'Set up {app} Bot',
	lead: 'From adding the bot to configuring every module, field by field. Everything is set in the browser; members use it through the Discord menu.',
	cta: 'Add the bot to start'
};

export const sections = [
	{
		id: 'start',
		icon: 'fa-flag-checkered',
		label: 'Get started',
		heading: 'Get started',
		iconClass: 'fas fa-flag-checkered',
		lead: 'Three steps take you from nothing to a configurable server.'
	},
	{
		id: 'setup-command',
		icon: 'fa-terminal',
		label: '/setup',
		heading: 'The /setup command',
		iconClass: 'fas fa-terminal',
		lead: 'Run /setup in Discord (owner or Administrator only) and pick the server language first. It creates a menu category with these channels named in that language, wires each one to its module and posts the bot interface. Running it again with a different language renames the channels. If no owner account exists yet, it hands you a registration link to claim ownership.'
	},
	{
		id: 'accounts',
		icon: 'fa-user-plus',
		label: 'Accounts & staff',
		heading: 'Accounts & staff',
		iconClass: 'fas fa-user-plus',
		lead: 'Sign in with Discord. The person who claims the first invite is the owner; they bring in helpers from the Accounts page.'
	},
	{
		id: 'roles',
		icon: 'fa-users-gear',
		label: 'Who can do what',
		heading: 'Who can do what',
		iconClass: 'fas fa-users-gear',
		lead: 'Account tiers control who manages the panel. They are separate from the Discord permission roles below, which control who can use features in Discord.'
	},
	{
		id: 'permissions',
		icon: 'fa-user-shield',
		label: 'Permissions',
		heading: 'Permissions',
		iconClass: 'fas fa-user-shield',
		lead: 'Map Discord roles to what they unlock. Each group lives with the module it belongs to.'
	},
	{
		id: 'modules',
		icon: 'fa-toggle-on',
		label: 'Modules',
		heading: 'Modules, field by field',
		iconClass: 'fas fa-toggle-on',
		lead: 'Each module has a master toggle plus its own settings. Turn on only what you need.'
	},
	{
		id: 'ai-chat',
		icon: 'fa-robot',
		label: 'AI chat',
		heading: 'AI chat',
		iconClass: 'fas fa-robot',
		lead: 'Members mention the bot to talk to it, or reply to one of its messages to keep going without mentioning again. Set this on the admin panel under the AI tab, not per bot or per server, so every bot and every server shares one configuration. Each member keeps their own conversation in each server. Restart the bot after saving.'
	},
	{
		id: 'ai-tools',
		icon: 'fa-toolbox',
		label: 'Search, fetch, images',
		heading: 'Web search, fetch and images',
		iconClass: 'fas fa-toolbox',
		lead: 'Three optional tools the AI reaches for on its own: searching the live web, reading a page it was linked to, and drawing a picture. Server data needs none of these. Each is a separate URL, model and key on the admin panel under the AI tab, so they can point at different providers. Any OpenAI-compatible gateway works. Restart the bot after saving.'
	},
	{
		id: 'ai-wikis',
		icon: 'fa-book',
		label: 'Wiki knowledge',
		heading: 'Wiki knowledge',
		iconClass: 'fas fa-book',
		lead: 'Without this, the AI answers game questions from memory and gets them wrong. Add a wiki and it looks the answer up instead. Set this on the admin panel under the Wikis tab. It applies to chat and voice alike, on every bot and every server.'
	},
	{
		id: 'ai-server',
		icon: 'fa-database',
		label: 'Server knowledge',
		heading: 'Server knowledge',
		iconClass: 'fas fa-database',
		lead: 'The AI can read this server\'s own live data, so "what is in the shop", "who is number one" and "what are my tasks" get real answers instead of guesses. It works as soon as AI chat is on — there is nothing extra to configure.'
	},
	{
		id: 'ai-assistant',
		icon: 'fa-wand-magic-sparkles',
		label: 'Panel assistant',
		heading: 'Panel assistant',
		iconClass: 'fas fa-wand-magic-sparkles',
		lead: 'A chat behind the Ask AI button in the bottom right corner of every panel page. Say what you want and it sets it up for you instead of you clicking through the forms. It runs on the AI you set up on the admin panel under the AI tab, with no extra key.'
	},
	{
		id: 'shop',
		icon: 'fa-store',
		label: 'Items shop',
		heading: 'Set up the items shop',
		iconClass: 'fas fa-store',
		lead: 'Two parts: enable the module per server, then create items in the admin catalog. Items are shared across every server that turns Items on.'
	},
	{
		id: 'discord',
		icon: 'fa-discord',
		label: 'Discord menu',
		heading: 'The Discord menu',
		iconClass: 'fa-brands fa-discord',
		lead: 'Members click the Menu button in the menu channel. Every button is always shown — if a feature is off or needs a role, clicking it explains why.'
	},
	{
		id: 'selfhost',
		icon: 'fa-server',
		label: 'Self-host',
		heading: 'Self-host setup',
		iconClass: 'fas fa-server',
		lead: 'The project is open source under the GNU AGPL-3.0. Run your own instance with Node, MySQL and optional Redis.'
	}
];

export const sectionLead = (id: string): string => sections.find((s) => s.id === id)?.lead ?? '';

export const sectionHeading = (id: string): string => sections.find((s) => s.id === id)?.heading ?? '';

export const sectionIcon = (id: string): string => sections.find((s) => s.id === id)?.iconClass ?? '';

export const subSections: Record<string, { heading: string; lead?: string }> = {
	'ai-voice': { heading: 'Voice: how it behaves', lead: 'Everyone in the channel is heard by one shared session.' },
	'ai-tools-how': { heading: 'How it works' },
	'ai-server-how': { heading: 'How it works' },
	'ai-assistant-how': { heading: 'How it works' },
	'ai-wiki-how': { heading: 'How it works' },
	'ai-wiki-relay': {
		heading: 'When a wiki blocks your server',
		lead: 'A few wiki hosts refuse traffic coming from servers, so the bot gets turned away even though the address is right. A relay fixes this: it forwards the lookup from somewhere the wiki does accept. Only the wikis you point at it are affected, everything else keeps connecting directly.'
	},
	'selfhost-env': { heading: 'Environment variables', lead: 'Copy .env.example to .env and fill these in.' }
};

export const subHeading = (id: string): string => subSections[id]?.heading ?? '';

export const subLead = (id: string): string => subSections[id]?.lead ?? '';

export const shopSteps = [
	{
		icon: 'fa-toggle-on',
		title: 'Enable Items',
		desc: 'On the server Public config page, turn on the Items toggle. This unlocks buy and use actions. Public must be on.'
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

export const aiChatFields = [
	{ label: 'Enable AI chat', req: 'required', desc: 'When off, mentions are ignored. The URL, key and model must all be set before it can be turned on.' },
	{ label: 'API URL', req: 'required', desc: 'Any OpenAI-compatible endpoint. A trailing slash or a full /chat/completions URL both work.' },
	{ label: 'API key', req: 'required', desc: 'Stored per panel and never sent back to the browser. Leave blank when saving to keep the current key.' },
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
	{ label: 'Voice model', req: 'optional', desc: 'A Gemini Live model, for example gemini-3.8-live. Only needed when voice AI is on.' },
	{
		label: 'Thinking',
		req: 'optional',
		desc: 'Low, Medium or High background reasoning, for extended thinking voice models such as gemini-3.8-live-extended-thinking. Other Live models think too, they just pick their own level.'
	},
	{
		label: 'Voice',
		req: 'optional',
		desc: 'Which of the 30 Gemini voices the bot speaks with. Listen to them in Google AI Studio first. Leave on Default to use the model default.'
	},
	{
		label: 'Voice API URL, key and system prompt',
		req: 'optional',
		desc: 'Voice has its own Google AI key and personality, separate from chat. Both are required to turn voice on. Always Gemini Live, so no endpoint to set.'
	},
	{
		label: 'Per-server override',
		req: 'optional',
		desc: 'Each server sets its own chat prompt, voice prompt and voice on Configuration → AI. Whatever it leaves blank falls back to what you set here.'
	}
];

export const aiToolFields = [
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

export const aiToolRules = [
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

export const aiVoiceRules = [
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

export const aiServerRules = [
	{ icon: 'fa-plug', title: 'Nothing to set up', desc: 'Comes with AI chat. No extra URL, model or key.' },
	{ icon: 'fa-toggle-on', title: 'Follows your modules', desc: 'A module you turn off disappears from the AI too.' },
	{ icon: 'fa-user-lock', title: 'Own account only', desc: 'Members read their own bag, tasks and history, never anyone else.' },
	{ icon: 'fa-eye', title: 'Public stays public', desc: 'Leaderboards, shop, giveaways and quests are open to everyone.' },
	{ icon: 'fa-mask', title: 'Disguise still hides', desc: 'Disguised members stay off every list the AI can read.' },
	{ icon: 'fa-microphone', title: 'Works in voice', desc: 'The same answers, spoken short instead of listed.' }
];

export const aiServerTopics = [
	{ icon: 'fa-chart-pie', title: 'Server stats', desc: 'Members, XP, messages, voice minutes and every module total.' },
	{ icon: 'fa-ranking-star', title: 'Leaderboards', desc: 'Any metric, any period — XP, chat, voice, steals, gambling.' },
	{ icon: 'fa-store', title: 'Shop', desc: 'Prices, what each item does, how long it lasts, what is coming.' },
	{ icon: 'fa-star', title: 'XP rates', desc: 'This server\'s own rates, so "how much XP for an hour in voice" is exact.' },
	{ icon: 'fa-gift', title: 'Giveaways & quests', desc: 'What is running, the prize and how long is left.' },
	{ icon: 'fa-book-open', title: 'How the game works', desc: 'The same guide members read, so answers match the site.' },
	{ icon: 'fa-user', title: 'Their account', desc: 'Level, bag, assets, minigames, history, tasks and streak.' }
];

export const aiAssistantTopics = [
	{ icon: 'fa-palette', title: 'Messages', desc: 'Ask from any page. It opens the builder and fills in text, embeds, buttons, role actions and translations.' },
	{ icon: 'fa-database', title: 'Live server data', desc: 'Leaderboards, statistics, leveling rules, giveaways and the shop, read live.' },
	{ icon: 'fa-book', title: 'Wikis', desc: 'Adds a wiki from its address, edits it or switches it off. Panel admin only.' },
	{ icon: 'fa-store', title: 'Shop items', desc: 'Creates, reprices, schedules or switches off items. Panel admin only.' },
	{ icon: 'fa-sliders', title: 'Panel settings', desc: 'Flips the switches on the Settings tab. Panel admin only.' }
];

export const aiAssistantRules = [
	{ icon: 'fa-toggle-on', title: 'Needs AI chat', desc: 'It works once AI chat is on with a URL, key and model.' },
	{ icon: 'fa-eye', title: 'You review messages', desc: 'A built message lands in the editor unsaved. You press Save or Send.' },
	{ icon: 'fa-rotate-left', title: 'Undo', desc: 'One click puts the message back the way it was before the change.' },
	{ icon: 'fa-language', title: 'Translations', desc: 'Ask for any languages. Only text you changed is translated again, the rest is kept.' },
	{ icon: 'fa-ban', title: 'Never deletes', desc: 'It adds and edits. Deleting stays a click of your own in the panel.' },
	{ icon: 'fa-user-lock', title: 'Own server only', desc: 'Owner and staff accounts reach their own server and nothing else.' },
	{ icon: 'fa-robot', title: 'Needs the bot online', desc: 'Live server data comes from the running bot.' }
];

export const aiWikiFields = [
	{ label: 'API URL', req: 'required', desc: 'The wiki api.php endpoint, usually /w/api.php or /api.php. Press Test to check it and fill in the name.' },
	{ label: 'Name', req: 'required', desc: 'What this wiki is called. Matched against questions, so name it after the game.' },
	{ label: 'Description', req: 'optional', desc: 'What the wiki covers. This is how a question is matched to the right wiki. Test fills it in.' },
	{ label: 'Site URL', req: 'optional', desc: 'The wiki home page, used when the bot links a page it read.' },
	{
		label: 'Relay URL',
		req: 'optional',
		desc: 'Only needed when a wiki blocks your server. Points at a relay.php you host somewhere the wiki does accept. Leave blank to connect straight to the wiki.'
	},
	{ label: 'Relay key', req: 'optional', desc: 'The secret set inside relay.php. Required whenever a relay URL is filled in.' },
	{ label: 'Enabled', req: 'optional', desc: 'Turn a wiki off without deleting it. Disabled wikis are ignored by chat and voice.' }
];

export const aiWikiRules = [
	{ icon: 'fa-plus', title: 'Add a wiki', desc: "Open the admin panel's Wikis tab and paste the api.php URL. Any MediaWiki site works, including Fandom." },
	{ icon: 'fa-check', title: 'Test it', desc: 'Test confirms the endpoint answers and is really a wiki, then fills in the name for you.' },
	{ icon: 'fa-comments', title: 'Ask normally', desc: 'Members just ask. Full questions work, not only exact page names.' },
	{ icon: 'fa-list', title: 'Real numbers', desc: 'Prices, weights and drop rates come from the wiki infobox, so stat answers are exact.' },
	{ icon: 'fa-file-lines', title: 'Reads the whole page', desc: 'Skin lists, tables and changelogs come through in full. Nothing is trimmed.' },
	{
		icon: 'fa-globe',
		title: 'Any wiki, any language',
		desc: 'No per-game rules. Ask in any language and it still finds the English page, then answers back in yours.'
	},
	{ icon: 'fa-bolt', title: 'Cached 10 minutes', desc: 'Repeat questions answer instantly and the wiki is not hammered.' },
	{
		icon: 'fa-check',
		title: 'Applies right away',
		desc: 'Chat picks up a new wiki on the next message. Voice picks it up on the next call. No restart needed.'
	}
];

export const aiWikiRelaySteps = [
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

export const envVars = [
	{ label: 'APP_NAME', req: 'required', desc: 'Brand name shown in the panel, emails and bot embeds. Read at build time.' },
	{ label: 'APP_URL', req: 'required', desc: 'Public base URL of your site, e.g. https://bot.example.com. Read at build time.' },
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
	{
		label: 'SECRET',
		req: 'required',
		desc: 'A long random secret. Signs public account card links and keys the demo login captcha. Rotating it invalidates every issued account link.'
	},
	{ label: 'REDIS_URL', req: 'optional', desc: 'Redis for sessions and caching, e.g. redis://default:pass@localhost:6379/0.' },
	{
		label: 'S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY',
		req: 'optional',
		desc: 'Store uploads in an S3 or R2 bucket instead of local disk. All three must be set; add S3_ENDPOINT for R2, or S3_REGION for the bucket region on AWS.'
	},
	{ label: 'BOT_ID', req: 'per bot process', desc: 'The database id of the bot this process runs. The token lives in the database, not in env.' },
	{
		label: 'OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_SERVICE_NAME',
		req: 'optional',
		desc: 'OpenTelemetry log export. Telemetry only turns on when the endpoint is set.'
	}
];

export const selfhostSteps = [
	{
		icon: 'fa-database',
		title: 'Provision MySQL',
		desc: 'Create a database. The app builds its schema and runs migrations automatically on first start. Redis is optional.'
	},
	{
		icon: 'fa-file-lines',
		title: 'Fill the .env',
		desc: 'Copy .env.example to .env and set APP_NAME, APP_URL, DB_*, MAIL_* and SECRET. Add REDIS_URL if you use Redis.'
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

export const startSteps = [
	{ icon: 'fa-brands fa-discord', title: 'Add the bot', desc: 'It joins and greets the server with the docs and support links.' },
	{
		icon: 'fa-terminal',
		title: 'Run /setup once',
		desc: 'Pick the server language, then it creates every channel, wires it to its module and posts the menu. Owner or Administrator only.'
	},
	{
		icon: 'fa-right-to-bracket',
		title: 'Open the panel',
		desc: 'After /setup, register the owner account from the link it gives you, then sign in to the web panel to configure everything.'
	}
];

export const setupChannels = [
	{ name: '「💻」menu', desc: 'Holds the main interface button members click to open the bot menu.' },
	{ name: '「⚙️」bot-updates', desc: 'Bot update notifications.' },
	{ name: '「🚪」welcome', desc: 'Where welcome messages post.' },
	{ name: '「👋」goodbye', desc: 'Where leave messages post.' },
	{ name: '「🚀」booster', desc: 'Where server boost messages post.' },
	{ name: '「🔨」moderation', desc: 'Numbered moderation case embeds.' },
	{ name: '「🆙」level', desc: 'Level and rank progress notifications.' },
	{ name: '「🎁」giveaway', desc: 'Giveaway posts and winner announcements.' },
	{ name: '「⭐」staff-rating', desc: 'Staff rating reports and updates.' },
	{ name: '「📜」discord-quest', desc: 'Discord Quest notifications.' },
	{ name: '「📽️」content-creator', desc: 'Content creator posts, TikTok LIVE alerts and YouTube, Twitch and TikTok creator alerts.' },
	{ name: '「👗」roblox-catalog', desc: 'Roblox catalog item alerts.' },
	{ name: '「🛍️」items', desc: 'Link to the items shop.' }
];

export const accountFields = [
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

export const tiers = [
	{
		icon: 'fa-crown',
		accent: '#d9a528',
		title: 'Owner',
		what: 'Full control of one server in the panel. The first owner claims the link from /setup.',
		can: [
			'Configure every module and permission for the server',
			'Invite, freeze and delete staff accounts (not other owners)',
			'Create and expire invite links',
			'Invite more owners',
			'See who changed what in the Change Log'
		]
	},
	{
		icon: 'fa-user-tie',
		accent: '#e43d12',
		title: 'Staff',
		what: 'Helper access invited by an owner. Every configuration change they save is logged under their name.',
		can: [
			'Configure every module for the server',
			'Moderate members and post messages as the bot from the panel',
			'Use staff features like the rating review queue',
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

export const permissionRoles = [
	{ label: 'Staff Roles', desc: 'Set on the Main page. Used for staff features and staff-related filtering.' },
	{ label: 'Content Creator Roles', desc: 'Set on the Content Creator module. Used for creator permissions and member filtering.' },
	{ label: 'Admin', desc: 'Not configured. Anyone with the Discord Administrator permission counts as a bot admin.' },
	{ label: 'Supporter', desc: 'Not configured. Anyone boosting the server counts as a supporter.' }
];

export const modules = [
	{
		id: 'main',
		icon: 'fa-gear',
		accent: '#2f8f4e',
		title: 'Main',
		what: 'How the bot looks and speaks in this server, plus the embed style and staff roles used everywhere.',
		fields: [
			{
				label: 'Server Language',
				desc: `${serverLanguageList('or')}. Names the setup channels and is used for the menu, approval posts, every public bot message and the AI chat and voice. Members who pick their own language still get private replies and DMs in it.`
			},
			{ label: 'Bot Nickname', desc: 'Name the bot shows in this server. Empty uses the default.' },
			{ label: 'Bot Avatar', desc: 'Profile picture in this server only. PNG, JPG or GIF up to 2MB.' },
			{ label: 'Bot Banner', desc: 'Profile banner in this server only. PNG, JPG or GIF up to 4MB.' },
			{ label: 'Bot Bio', desc: 'About Me in this server, up to 190 characters.' },
			{ label: 'Default Color & Footer', desc: 'Accent color and footer used on bot embeds.' },
			{ label: 'Moderation Logs Channel', desc: 'Optional channel for moderation cases; each one pings the member.' },
			{ label: 'Staff Roles', desc: 'Roles treated as staff across the bot.' }
		]
	},
	{
		id: 'leveling',
		icon: 'fa-star',
		accent: '#d9a528',
		title: 'Leveling & XP',
		what: 'Chat, voice and invites earn XP that feeds levels, role rewards and leaderboards.',
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
			{ label: 'Invite XP', desc: 'XP paid to the inviter per new member who stays (50 to 1000). Staff earn double.' },
			{
				label: 'Invite share',
				desc: "Share of an invited member's chat and voice XP that also goes to the inviter while they stay (off to 25%). Staff get double."
			},
			{ label: 'Invite hold time', desc: 'How long the new member must stay before the inviter is paid. Leaving earlier pays nothing.' },
			{ label: 'Minimum account age', desc: 'Accounts younger than this count as fake invites and pay no XP.' },
			{
				label: 'Members tab',
				desc: "Each member's page shows who invited them, who they invited and their bonus invites. Joins and Links list every join and invite link, and whether a personal or Discord link was used."
			},
			{
				label: 'Rewards tab',
				desc: 'Each reward is a goal and what reaching it gives. Goals are a level, messages, or voice, video and streaming hours. A reward is a role, an XP amount, or a custom reward with your own name and image that staff hand over and mark delivered. A reward can be limited to the first members who reach it. Choose whether a level lost to a steal takes a reward back, and whether a higher reward replaces the lower one. Members see the list on their Rewards tab.'
			},
			{ label: 'Level Progress Notification Channel', desc: 'Channel for level-up and rank notifications. A level-up that unlocks a reward names the role.' }
		]
	},
	{
		id: 'items',
		icon: 'fa-store',
		accent: '#d6536d',
		title: 'Items & economy',
		what: 'A per-server shop of PvP and utility items bought with XP. Items are created in the global admin Items page; each server enables the system from the Public config page (Items toggle + channel). Requires Public to be on.',
		fields: [
			{ label: 'Items toggle (under Public)', desc: 'When off, the Items tab and all buy/use actions are disabled for this server.' },
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
			{ label: 'Welcome Messages', desc: 'Your message templates. Placeholders: {user}, {server}, {memberCount}, {accountAge}, {inviter}, {inviteCount}.' }
		]
	},
	{
		id: 'leaver',
		icon: 'fa-door-open',
		accent: '#e8833a',
		title: 'Leaver',
		what: 'Says goodbye when a member leaves, in one or more channels.',
		fields: [
			{ label: 'Leaver module', desc: 'When off, leave messages are not sent.' },
			{ label: 'Leave Channels', desc: 'One or more channels leave messages post to.' },
			{ label: 'Leave Messages', desc: 'Your message templates. Placeholders: {username}, {user}, {server}, {memberCount}, {timeInServer}.' }
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
		accent: '#a52a0b',
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
		what: 'Members rate staff; approved ratings drive dynamic roles placed above your staff roles.',
		fields: [
			{ label: 'Staff rating module', desc: 'When off, staff rating flows and their Discord UI are disabled. Off until you pick staff roles in main config.' },
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
		what: 'Always on. Warn, time out, kick, ban and tempban members from the panel or the staff menu; every action is a numbered case.',
		fields: [
			{ label: 'Members tab', desc: 'Tick any members, then warn, time out, kick, ban or change roles in one go. Open a member for their full record.' },
			{ label: 'Warned, timed out, banned', desc: 'Filters on the Members tab for who is under an active action.' },
			{ label: 'Auto-escalation', desc: 'Set under Configuration, Moderation. Steps like 3 warnings = 1 hour timeout; the bot applies them itself.' },
			{ label: 'Warning expiry', desc: 'Warnings older than this stop counting; the record stays.' },
			{ label: 'Reason presets', desc: 'Saved reasons staff pick from; any case reason can be edited later.' },
			{ label: 'Moderation Logs Channel', desc: 'Set on the Main page. Each case pings the member; cases are always kept in the panel.' }
		]
	},
	{
		id: 'messages',
		icon: 'fa-envelope-open-text',
		accent: '#b5179e',
		title: 'Messages',
		what: 'Always on. Post as the bot from the Messages tab: plain posts, embeds, rules panels, reaction roles and dropdown roles, with a live preview.',
		fields: [
			{
				label: 'Standard message',
				desc: `Text, up to ${MESSAGE_LIMITS.attachments} photos or videos, up to ${MESSAGE_LIMITS.embeds} embeds and up to ${MESSAGE_LIMITS.rows} rows of buttons or dropdowns. Photos and videos are sent as real attachments, like a member uploading them.`
			},
			{
				label: 'Components V2',
				desc: 'A free layout instead: containers with a colored edge, text, sections with a small image or button beside them, image and video galleries, dividers, buttons and dropdowns.'
			},
			{
				label: 'Buttons and dropdowns',
				desc: `Each button or dropdown choice shows another saved message privately, changes a role, or both. Link buttons open a website. A row holds up to ${MESSAGE_LIMITS.buttons} buttons and a dropdown up to ${MESSAGE_LIMITS.options} choices.`
			},
			{
				label: 'Reaction roles',
				desc: 'Set a button to give or take a role: the first click gives it, the next takes it away. It can also only give or only take. The member gets a private confirmation, and each member can change roles once every 3 seconds, so nobody can spam a button.'
			},
			{
				label: 'Dropdown roles',
				desc: 'Give each dropdown choice its own role. Turn on picking several and a member applies many choices at once.'
			},
			{
				label: 'Role requirements',
				desc: 'The bot needs Manage Roles and its own role must sit above every role it hands out. Roles that can moderate or manage the server, and roles owned by an integration, can never be handed out by a button or dropdown. A member who clicks is told what to ask an admin to fix.'
			},
			{
				label: 'Languages',
				desc: 'Add a language and translate any text; anything left empty uses the main text. The posted message then gets a language button (a dropdown with three or more), so any member can read it privately in another language, whatever the server uses. Buttons in that copy keep the chosen language. It can be turned off in the language menu. When sending, pick which language the post itself uses.'
			},
			{
				label: 'Editing',
				desc: "The editor looks like a Discord channel. Type in the box at the bottom to write what the bot says, press + to add an embed, a photo or video, a button or a dropdown, then click anything in the message to change it. Emoji are picked from a list, including the server's own."
			},
			{
				label: 'Build with AI',
				desc: "Press Ask AI in the bottom right corner on any page and describe the message. It opens the builder and fills the editor for you: text, embeds, buttons, dropdowns and translations, using the server's live data when you ask for it. Nothing is saved or posted until you press Save or Send."
			},
			{
				label: 'Try it',
				desc: 'Switch from Edit to Try it and click the buttons and dropdowns to see the private reply or role result a member would get.'
			},
			{
				label: 'Send and edit',
				desc: 'Pick one or more channels and, if you want, roles to ping. Saving a message later edits every copy already posted. Each posted copy can be opened in Discord or deleted from it.'
			},
			{
				label: 'Deleting a message',
				desc: 'Posted copies stay in Discord, but their buttons and dropdowns are taken off because they would stop working. A message that another one shows has to be unlinked first.'
			},
			{
				label: 'Upload limit',
				desc: `Images (PNG, JPG, GIF, WEBP) and videos (${MESSAGE_VIDEO_FORMATS_LABEL}) up to Discord's limit for the server: ${imageSizeLabel(messageUploadLimit(0))}, ${imageSizeLabel(messageUploadLimit(2))} at boost level 2 and ${imageSizeLabel(messageUploadLimit(3))} at level 3.`
			},
			{ label: 'Placeholders', desc: '{server} becomes the server name and {year} the current year, in any text.' },
			{
				label: 'Global messages',
				desc: "For the panel admin. The same builder under Global Messages sends one message to every server on all bots, into each server's Bot Updates Channel and in that server's language. Saving edits every copy, and a copy can be deleted from one server or all. Buttons can open another global message; role buttons are left out because roles differ per server. Each server's Change Log shows which admin sent it."
			},
			{ label: 'Change Log', desc: 'Creating, editing, sending and deleting a message, and removing a posted copy, are recorded with who did it.' }
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
		what: 'Lets boosters create a personalized role, placed directly above the Server Booster role so its colour shows.',
		fields: [
			{
				label: 'Custom supporter role module',
				desc: 'On by default. When off, custom supporter role creation from the bot is disabled. The bot’s own role must sit above the Server Booster role.'
			}
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
		id: 'creator-alerts',
		icon: 'fa-tower-broadcast',
		accent: '#e11d48',
		title: 'Creator alerts',
		what: 'Each member follows their own YouTube, Twitch and TikTok creators and is tagged when they post.',
		fields: [
			{ label: 'Creator alerts module', desc: 'When off, creator polling, posts and the member menu are disabled.' },
			{
				label: 'Target Broadcast Channel',
				desc: 'Where new videos, live streams and posts are announced, tagging every member who follows that creator. Defaults to the content creator channel.'
			},
			{ label: 'No channel set', desc: 'Nothing is posted. Members see the last 20 alerts in Notifications instead.' },
			{ label: 'Per-member follows', desc: 'Members follow a creator from Notifications or Notify me under a post, and pick new video, live stream or post.' }
		]
	},
	{
		id: 'discord-quest-notifier',
		icon: 'fa-scroll',
		accent: '#5865f2',
		title: 'Discord Quest notifier',
		what: 'Posts Discord Quest alerts. Quest data is discovered by the accounts the operator has linked, so nothing per-server is needed for alerts.',
		fields: [
			{ label: 'Quest notifier module', desc: 'When off, quest polling and posts are disabled.' },
			{ label: 'Notification channel', desc: 'Where the official bot posts quest embeds.' },
			{
				label: 'Auto quest enrollment',
				desc: 'Instance-wide and off by default. Only the operator can turn it on; it is not a per-server setting. When on, the bot menu shows Discord Quest with a Claim all button that enrolls every open quest with the member’s own user token.'
			}
		]
	},
	{
		id: 'forwarder',
		icon: 'fa-share-from-square',
		accent: '#2f8f4e',
		title: 'Message forwarder',
		what: 'Forwards messages from a source channel the operator has linked into a channel in this server. Add as many forwarders as you need.',
		fields: [
			{ label: 'Forwarder module', desc: 'When off, message forwarding is disabled.' },
			{ label: 'Source account', desc: 'The linked account that forwards messages. The operator manages these; owners pick from what is available.' },
			{
				label: 'Server (where the account is)',
				desc: 'The server the linked account is connected to. Every server you can forward from is listed at /forwarder-servers.'
			},
			{ label: 'From Channels', desc: 'Messages from these source channels are forwarded.' },
			{ label: 'Target Channel', desc: 'Where forwarded messages post in this server.' },
			{ label: 'Role Pings (optional)', desc: 'Roles to mention on forwarded messages.' },
			{ label: 'Mention filter', desc: 'Only forward messages that mention the linked account.' },
			{
				label: 'Keywords (optional)',
				desc: 'Type a keyword and press Enter to add it. Only messages containing at least one keyword are forwarded; leave it empty to forward everything. Combines with the mention filter — a message must satisfy both. Keywords are matched against embeds too, not just plain text. Forwarders are independent: if two share a source channel, each one decides on its own keywords, so a catch-all forwarder and a filtered one can both receive the same message.'
			},
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
			{ label: 'Notification channel', desc: 'Where the bot posts Roblox catalog embeds.' },
			{
				label: 'Per-item alerts',
				desc: 'Members press Notify me under a post and pick what tags them: price, resale price, stock left or total supply. Only the changed field pings them.'
			}
		]
	},
	{
		id: 'public',
		icon: 'fa-chart-pie',
		accent: '#e43d12',
		title: 'Public',
		what: 'The public pages — server statistics, leaderboard, members, and the per-member account (Profile, History, Themes, Guide) — are always on. Items, Minigames, Market, Daily tasks and the server invite are enabled here as sub-toggles.',
		fields: [
			{
				label: 'Items / Minigames / Market',
				desc: 'Sub-toggles under Public. Each unlocks its account tab (and channel, for Items/Minigames). Tabs stay visible when off and explain that the feature is disabled.'
			},
			{
				label: 'Daily tasks',
				desc: 'Sub-toggle that adds the Tasks tab: 9 daily and 9 weekly auto-generated goals, a 7-day check-in, and streaks. Nothing to configure — goals are sized per member from their own recent activity, and tasks for a feature you turned off never appear. Item rewards come from your shop (needs Items on) and streak milestones post to the item events channel.'
			},
			{
				label: 'Themes',
				desc: `Always on, nothing to configure. Each member uploads a background image (PNG, JPG, GIF or WEBP) on their account Themes tab. Everything is re-encoded and resized to WebP — animated GIFs become animated WebP, keeping their frames and looping — and the stored result must land under 10MB. The accent colour is read from the image and can be overridden by hand. Animated effects — ${EFFECT_NAMES} — are won by spinning a reel for ${EFFECT_SPIN_COST.toLocaleString('en-US')} XP on the Themes tab, and each spin also rolls a one-of-a-kind variant, so no two members look the same. An effect can be disabled and re-enabled without spinning again, so turning it off never costs the XP already paid. Spins post to the minigames channel and appear in the member’s History, but are excluded from the Minigames leaderboard because they are a fixed-price roll, not a wager. All of it repaints that member’s account pages, wallet card, their row on the leaderboard and their card in the members list, so every visitor sees it. Themes are per server, and a disguised member is already hidden from the public leaderboard.`
			},
			{
				label: 'Server invite',
				desc: 'On by default. Shows a Join button on the public pages and an invite line in the bot menu, and lists the server join page (/join/server-name) in the sitemap. Off hides all three and the join page stops working. Members keep their own invite links either way. Joins through this link credit no member and are counted as Server link on the server overview.'
			},
			{
				label: 'Invite page theme',
				desc: 'Background image, tone and animated effect for the server join page. The image is re-encoded to WebP, the tone is picked from it and can be changed by hand, and the tone recolours the page buttons and accents.'
			},
			{ label: 'Public URL', desc: 'The generated public address, derived from the server name.' }
		]
	}
];

export const discordMenu = [
	{ label: '📋 Menu', desc: 'The main button in the menu channel. Open to every member; every feature button is always listed.' },
	{ label: '💎 Custom Supporter Role', desc: 'Opens a modal to create or edit a personal role (name, color, icon).' },
	{
		label: '🎉 Create Giveaway',
		desc: 'Starts the giveaway flow: choose whether members can enter more than once, pick eligibility roles, then fill the details form, including how many invites are needed to enter (0 for none).'
	},
	{ label: '⏸️ Set AFK Status', desc: 'Opens the AFK modal, or shows your current AFK status with a Remove AFK button.' },
	{ label: '💬 Submit Feedback', desc: 'Opens the feedback modal with a message field, up to three screenshots and an anonymous checkbox.' },
	{ label: '🛡️ Staff Rating', desc: 'Pick a staff member, choose a 1 to 5 score and category, and submit a rating.' },
	{
		label: '🎬 Content Creator',
		desc: 'Shows the approved creators, live first, with two choices: Apply as Content Creator (pending applications plus an Apply button for TikTok username and reason) and creator alerts (the creators a member follows and what each one alerts on).'
	},
	{
		label: '🔔 Notifications',
		desc: 'Opens three choices: channel notifications (subscribe to the channels you enabled), Roblox item notifications (the items a member follows, what each one alerts on, and a disable-all) and creator alerts (the creators a member follows and what each one alerts on).'
	},
	{
		label: '🌐 Select Language',
		desc: `Switches your own Discord interface language (${serverLanguageList('or')}), or follows the server language.`
	},
	{ label: '🌐 Statistics', desc: 'Link to the public stats page.' },
	{ label: '👤 Account', desc: 'Link to the member account (Profile, Tasks, Items, Minigames, Market, History, Themes, Guide).' }
];
