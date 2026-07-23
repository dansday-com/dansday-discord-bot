<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import Button from '$lib/frontend/components/Button.svelte';

	const officialBotInviteUrl = 'https://discord.com/oauth2/authorize?client_id=1446572985849876640';

	const sections = [
		{ id: 'start', icon: 'fa-flag-checkered', label: 'Get started' },
		{ id: 'bots', icon: 'fa-robot', label: 'Bot vs selfbot' },
		{ id: 'setup-command', icon: 'fa-terminal', label: '/setup' },
		{ id: 'accounts', icon: 'fa-user-plus', label: 'Accounts & staff' },
		{ id: 'roles', icon: 'fa-users-gear', label: 'Who can do what' },
		{ id: 'permissions', icon: 'fa-user-shield', label: 'Permissions' },
		{ id: 'modules', icon: 'fa-toggle-on', label: 'Modules' },
		{ id: 'shop', icon: 'fa-store', label: 'Items shop' },
		{ id: 'discord', icon: 'fa-discord', label: 'Discord menu' },
		{ id: 'selfhost', icon: 'fa-server', label: 'Self-host' }
	];

	const shopSteps = [
		{
			icon: 'fa-toggle-on',
			title: 'Enable Items',
			desc: 'On the server Public statistics config page, turn on the Items toggle. This shows the account link in the bot menu and unlocks buy and use actions. Public statistics must be on.'
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

	const envVars = [
		{ label: 'BASE_URL', req: 'required', desc: 'Public base URL of your site, e.g. https://bot.example.com.' },
		{
			label: 'DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME',
			req: 'required',
			desc: 'MySQL connection. Or provide a single DATABASE_URL instead (mysql://user:pass@host:port/db).'
		},
		{ label: 'MAIL_HOST / MAIL_USERNAME / MAIL_PASSWORD', req: 'required', desc: 'SMTP for account emails and OTP. MAIL_PORT is optional (defaults to 587).' },
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
		{ icon: 'fa-discord', title: 'Add the bot', desc: 'Invite the bot to your server. It joins instantly and is ready to run /setup.' },
		{
			icon: 'fa-terminal',
			title: 'Run /setup',
			desc: 'In Discord, run /setup. It builds a menu category of channels and posts the bot interface. Owner or Administrator only.'
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
			desc: 'Pick an invite type (Owner or Staff), choose Discord members, and the bot DMs them a registration link that expires 10 minutes after creation.'
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
		{ label: 'Member Roles', desc: 'Only members with these roles are eligible to earn leveling XP.' }
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
					desc: 'XP awarded per eligible message (5 to 100). The message must pass the cooldown and the member must have a member role.'
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
			fields: [{ label: 'AFK module', desc: 'When off, the AFK button is hidden and all AFK behavior is disabled.' }]
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
			what: 'The master switch for all public pages: server statistics, leaderboard, members, and the per-member account (Overview, History, Guide). Items, Minigames and Assets are enabled here as sub-toggles.',
			fields: [
				{ label: 'Public statistics module', desc: 'Master switch. When off, every public page and the in-Discord account link are disabled.' },
				{
					label: 'Items / Minigames / Assets',
					desc: 'Sub-toggles under public statistics. Each enables its account tab (and channel, for Items/Minigames). With all three off, the account still shows Overview and History; only Guide hides.'
				},
				{ label: 'Public URL', desc: 'The generated public address, shown when enabled. Derived from the server name.' }
			]
		}
	];

	const discordMenu = [
		{ label: '📋 Menu', desc: 'The main button in the menu channel. Opens the feature menu, showing only what a member has permission for.' },
		{ label: '💎 Custom Supporter Role', desc: 'Opens a modal to create or edit a personal role (name, color, icon).' },
		{ label: '🎉 Create Giveaway', desc: 'Starts the giveaway flow: pick an eligibility role, then fill the details form.' },
		{ label: '⏸️ Set AFK Status', desc: 'Opens the AFK modal, or shows your current AFK status with a Remove AFK button.' },
		{ label: '💬 Submit Feedback', desc: 'Opens the feedback modal with a message field and an anonymous option.' },
		{ label: '🛡️ Staff Rating', desc: 'Pick a staff member, choose a 1 to 5 score and category, and submit a rating.' },
		{ label: '🎬 Content Creator', desc: 'Shows the creator list and an Apply button (TikTok username plus reason).' },
		{ label: '🔔 Notifications', desc: 'Opens a selector to subscribe to the notification channels you enabled.' },
		{ label: '🌐 Select Language', desc: 'Switches the Discord interface language (English or Indonesian).' },
		{ label: '🌐 Statistics', desc: 'Link to the public stats page (shown when Public statistics is on).' },
		{ label: '👤 Account', desc: 'Link to the member account (Overview, Items, Minigames, Assets, History, Guide) — shown when Public statistics is on.' }
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

<div class="m-root text-lb-text relative flex flex-col overflow-x-hidden">
	<div class="m-blob m-blob-1 pointer-events-none fixed z-0 h-[420px] w-[420px] rounded-full opacity-14"></div>
	<div class="m-blob m-blob-2 pointer-events-none fixed z-0 h-[320px] w-[320px] rounded-full opacity-14"></div>
	<div class="m-blob m-blob-3 pointer-events-none fixed z-0 h-[260px] w-[260px] rounded-full opacity-14"></div>

	<MainHeader />

	<main class="m-main flex-1 overflow-y-auto">
		<div class="m-inner relative z-1 mx-auto my-0 max-w-[1280px] px-8 pt-8 pb-16">
			<div class="g-wrap gap-8 px-0 pt-1 pb-9">
				<header class="g-hero px-1 pt-3 pb-0 text-center" use:reveal>
					<div class="g-hero-badge h-14 h-16 w-14 w-16 rounded-2xl text-xl"><i class="fas fa-book-open"></i></div>
					<h1 class="g-hero-title text-lb-text mx-0 mt-0 mb-2 font-extrabold">Set up {APP_NAME} Bot</h1>
					<p class="g-hero-sub text-lb-text-muted mx-auto my-0 max-w-[540px] text-base">
						From adding the bot to configuring every module, field by field. Everything is set in the browser; members use it through the Discord menu.
					</p>
					<Button href={officialBotInviteUrl} variant="primary" class="g-docs-cta mt-4" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						Add the bot to start
					</Button>
				</header>

				<nav class="g-docs-nav mx-0 mt-0 mb-7 flex flex-wrap justify-center gap-2" aria-label="Sections">
					{#each sections as s}
						<a
							href="#{s.id}"
							class="g-docs-navlink text-lb-text-muted inline-flex items-center gap-2 rounded-full px-3 py-2 text-base font-bold whitespace-nowrap"
							><i class="fas {s.icon}"></i>{s.label}</a
						>
					{/each}
				</nav>

				<section id="start" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-flag-checkered"></i>Get started</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">Three steps take you from nothing to a configurable server.</p>
					<div class="g-steps grid gap-3">
						{#each startSteps as s, i}
							<div class="g-step relative overflow-hidden rounded-2xl px-4 pt-4 pb-4" style="--d: {i * 80}ms">
								<span class="g-step-num text-4xl">{i + 1}</span>
								<span class="g-step-ic text-yacht-teal mb-2 inline-grid h-10 w-10 place-items-center rounded-[11px] text-base"
									><i class="fas {s.icon}"></i></span
								>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="bots" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-robot"></i>Official bot vs selfbot</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">
						The official bot runs everything. A selfbot is optional and only needed for two features.
					</p>
					<div class="g-modules grid items-start">
						{#each botKinds as b, i}
							<article class="g-mod relative rounded-2xl p-4" style="--ac: {b.accent}; --d: {i * 60}ms">
								<div class="g-mod-head mb-4 flex items-start gap-3">
									<span class="g-mod-ic inline-grid h-10 w-10 flex-none place-items-center rounded-[11px] text-base"><i class="fas {b.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{b.title}</h3>
										<p>{b.what}</p>
									</div>
								</div>
								<div class="g-fieldlist flex flex-col gap-0 overflow-hidden rounded-xl">
									{#each b.fields as f}
										<div class="g-field flex-row gap-3">
											<span class="g-field-key text-lb-text max-w-[240px] flex-[0_0_38%] text-base font-extrabold">{f.label}</span>
											<span class="g-field-val text-lb-text-muted flex-1 text-base">{f.desc}</span>
										</div>
									{/each}
								</div>
							</article>
						{/each}
					</div>
				</section>

				<section id="setup-command" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-terminal"></i>The /setup command</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">
						Run <code>/setup</code> in Discord (owner or Administrator only). It creates a <strong>{APP_NAME} Menu</strong> category with these channels and posts
						the bot interface in the menu channel. If no owner account exists yet, it hands you a registration link to claim ownership.
					</p>
					<div class="g-fieldlist flex flex-col gap-0 overflow-hidden rounded-xl">
						{#each setupChannels as c}
							<div class="g-field flex-row gap-3">
								<span class="g-field-key text-lb-text max-w-[240px] flex-[0_0_38%] text-base font-extrabold">{c.name}</span>
								<span class="g-field-val text-lb-text-muted flex-1 text-base">{c.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="accounts" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-user-plus"></i>Accounts &amp; staff</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">
						Sign in with Discord. The person who claims the first invite is the owner; they bring in helpers from the Accounts page.
					</p>
					<div class="g-fieldlist flex flex-col gap-0 overflow-hidden rounded-xl">
						{#each accountFields as f}
							<div class="g-field flex-row gap-3">
								<span class="g-field-key text-lb-text max-w-[240px] flex-[0_0_38%] text-base font-extrabold">{f.label}</span>
								<span class="g-field-val text-lb-text-muted flex-1 text-base">{f.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="roles" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-users-gear"></i>Who can do what</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">
						Account tiers control who manages the panel. They are separate from the Discord permission roles below, which control who can use features in
						Discord.
					</p>
					<div class="g-modules grid items-start">
						{#each tiers as t, i}
							<article class="g-mod relative rounded-2xl p-4" style="--ac: {t.accent}; --d: {i * 60}ms">
								<div class="g-mod-head mb-4 flex items-start gap-3">
									<span class="g-mod-ic inline-grid h-10 w-10 flex-none place-items-center rounded-[11px] text-base"><i class="fas {t.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{t.title}</h3>
										<p>{t.what}</p>
									</div>
								</div>
								<ul class="g-cando m-0 flex flex-col gap-2 p-0">
									{#each t.can as c}
										<li>{c}</li>
									{/each}
								</ul>
							</article>
						{/each}
					</div>
				</section>

				<section id="permissions" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-user-shield"></i>Permissions</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">Map Discord roles to what they unlock. Set these on the Permissions page.</p>
					<div class="g-fieldlist flex flex-col gap-0 overflow-hidden rounded-xl">
						{#each permissionRoles as r}
							<div class="g-field flex-row gap-3">
								<span class="g-field-key text-lb-text max-w-[240px] flex-[0_0_38%] text-base font-extrabold">{r.label}</span>
								<span class="g-field-val text-lb-text-muted flex-1 text-base">{r.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="modules" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-toggle-on"></i>Modules, field by field</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">
						Each module has a master toggle plus its own settings. Turn on only what you need.
					</p>
					<div class="g-modules grid items-start">
						{#each modules as m, i}
							<article id="mod-{m.id}" class="g-mod relative rounded-2xl p-4" style="--ac: {m.accent}; --d: {(i % 4) * 60}ms">
								<div class="g-mod-head mb-4 flex items-start gap-3">
									<span class="g-mod-ic inline-grid h-10 w-10 flex-none place-items-center rounded-[11px] text-base"><i class="fas {m.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{m.title}</h3>
										<p>{m.what}</p>
									</div>
								</div>
								<div class="g-fieldlist flex flex-col gap-0 overflow-hidden rounded-xl">
									{#each m.fields as f}
										<div class="g-field flex-row gap-3">
											<span class="g-field-key text-lb-text max-w-[240px] flex-[0_0_38%] text-base font-extrabold">{f.label}</span>
											<span class="g-field-val text-lb-text-muted flex-1 text-base">{f.desc}</span>
										</div>
									{/each}
								</div>
							</article>
						{/each}
					</div>
				</section>

				<section id="shop" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-store"></i>Set up the items shop</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">
						Two parts: enable the module per server, then create items in the admin catalog. Items are shared across every server that turns Items on.
					</p>
					<div class="g-steps grid gap-3">
						{#each shopSteps as s, i}
							<div class="g-step relative overflow-hidden rounded-2xl px-4 pt-4 pb-4" style="--d: {i * 80}ms">
								<span class="g-step-num text-4xl">{i + 1}</span>
								<span class="g-step-ic text-yacht-teal mb-2 inline-grid h-10 w-10 place-items-center rounded-[11px] text-base"
									><i class="fas {s.icon}"></i></span
								>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="discord" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fab fa-discord"></i>The Discord menu</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">
						Members click the Menu button in the menu channel. It shows only the features they have permission for.
					</p>
					<div class="g-fieldlist flex flex-col gap-0 overflow-hidden rounded-xl">
						{#each discordMenu as d}
							<div class="g-field flex-row gap-3">
								<span class="g-field-key text-lb-text max-w-[240px] flex-[0_0_38%] text-base font-extrabold">{d.label}</span>
								<span class="g-field-val text-lb-text-muted flex-1 text-base">{d.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="selfhost" class="g-sec" use:reveal>
					<h2 class="g-sec-head mx-0 mt-0 mb-2 flex items-center gap-2 text-base"><i class="fas fa-server"></i>Self-host setup</h2>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">
						The project is open source under MIT. Run your own instance with Node, MySQL and optional Redis.
					</p>
					<div class="g-steps grid gap-3">
						{#each selfhostSteps as s, i}
							<div class="g-step relative overflow-hidden rounded-2xl px-4 pt-4 pb-4" style="--d: {i * 80}ms">
								<span class="g-step-num text-4xl">{i + 1}</span>
								<span class="g-step-ic text-yacht-teal mb-2 inline-grid h-10 w-10 place-items-center rounded-[11px] text-base"
									><i class="fas {s.icon}"></i></span
								>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
					<h3 class="g-sub-head text-lb-text mx-0 mt-6 mb-1 text-base font-extrabold">Environment variables</h3>
					<p class="g-sec-lead text-lb-text-muted mx-0 mt-0 mb-4 text-base">Copy <code>.env.example</code> to <code>.env</code> and fill these in.</p>
					<div class="g-fieldlist flex flex-col gap-0 overflow-hidden rounded-xl">
						{#each envVars as e}
							<div class="g-field flex-row gap-3">
								<span class="g-field-key text-lb-text max-w-[240px] flex-[0_0_38%] text-base font-extrabold"
									>{e.label}<span
										class="g-field-tag g-field-tag--{e.req === 'optional' ? 'opt' : 'req'} ml-2 rounded-full px-2 py-0 text-xs font-extrabold uppercase"
										>{e.req}</span
									></span
								>
								<span class="g-field-val text-lb-text-muted flex-1 text-base">{e.desc}</span>
							</div>
						{/each}
					</div>
				</section>
			</div>
		</div>
	</main>

	<MainFooter />
</div>
