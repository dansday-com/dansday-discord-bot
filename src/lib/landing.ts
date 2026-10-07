import { BRAND_TAGLINE } from './brand.js';
import { APP_NAME, APP_NAME_PLAIN } from './frontend/panelServer.js';
import { serverLanguageList } from './languages.js';
import type { AggregatedPanelStats } from './frontend/public/statistics/aggregate.js';

type Totals = AggregatedPanelStats;
export type Live = { label: string; value: string; live?: boolean };
export type Feature = { icon: string; title: string; desc: string; more: string; stat?: (s: Totals) => Live[] };

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));

export const LANDING_TITLE = `${APP_NAME_PLAIN}: ${BRAND_TAGLINE} — Open-Source Discord Bot`;
export const LANDING_DESCRIPTION = `${APP_NAME_PLAIN} — ${BRAND_TAGLINE.toLowerCase()}. Free, open-source Discord bot: leveling, XP economy, moderation, giveaways. A MEE6 alternative with no premium tier.`;

export const LANDING_FACTS = ['No premium tier', 'Open source, AGPL-3.0', 'Hosted or self-hosted', 'Ten minute demo, no signup'];

export const features: Feature[] = [
	{
		icon: 'fa-user',
		title: 'Member accounts',
		desc: 'Every member gets their own page, one tap from the Discord menu.',
		more: 'XP sources, bag, tasks, history and portfolio. No signup.'
	},
	{
		icon: 'fa-store',
		title: 'Items & XP economy',
		desc: 'XP becomes a currency: a per-server shop, a 50-slot bag and items that hit other members.',
		more: 'Thirteen effects: steal, bomb, leech, bounty, shield, reflect, insurance, boost, gift, spy, disguise, purifier and luck.',
		stat: (s: Totals): Live[] => [
			{ label: 'Activations', value: fmt(s.items_activations) },
			{ label: 'XP stolen', value: fmt(s.items_stolen) },
			{ label: 'Biggest steal', value: fmt(s.items_biggest_steal) }
		]
	},
	{
		icon: 'fa-crosshairs',
		title: 'Bounties',
		desc: "Put XP on a member's head and let the server come collect.",
		more: 'Land the hit yourself before someone else cashes in.',
		stat: (s: Totals): Live[] => [
			{ label: 'Placed', value: fmt(s.bounties_placed) },
			{ label: 'Collected', value: fmt(s.bounties_collected) },
			{ label: 'XP pooled', value: fmt(s.bounties_pooled) }
		]
	},
	{
		icon: 'fa-user-secret',
		title: 'Spy & disguise',
		desc: 'Scout a target before you attack, or hide your own name from every public list.',
		more: 'A lucky spy can still unmask a disguise.',
		stat: (s: Totals): Live[] => [{ label: 'Spies', value: fmt(s.items_spies) }]
	},
	{
		icon: 'fa-clover',
		title: 'Luck',
		desc: 'Raises steal and bomb rolls, minigame odds, spy success, leech skim and insurance refunds.',
		more: 'Cuts gift tax and discounts prices. Timed buffs lock luck in on activation, so use luck first.'
	},
	{
		icon: 'fa-list-check',
		title: 'Daily & weekly tasks',
		desc: 'Eighteen daily and eighteen weekly, generated per member from a 96-goal catalog.',
		more: "Sized from that member's own last seven days, so no two lists match. No admin setup."
	},
	{
		icon: 'fa-fire',
		title: 'Streaks',
		desc: 'Clear all eighteen daily for two percent more reward XP a day, up to double.',
		more: 'Milestones at 7, 30, 100 and 365. Two freezes cover missed days.'
	},
	{
		icon: 'fa-calendar-check',
		title: 'Daily check-in',
		desc: 'A seven-day cycle, one claim per local day, up to 50,000 XP.',
		more: 'Fifty percent chance of a shop item instead, rolled by rarity tier.'
	},
	{
		icon: 'fa-swatchbook',
		title: 'Card themes',
		desc: 'Spin 1,000 XP for one of 70 animated effects, from fire to a black hole.',
		more: 'It repaints their account, their leaderboard row and their members-list card.'
	},
	{
		icon: 'fa-id-badge',
		title: 'Shareable member card',
		desc: 'Members render their own card and download it as an image.',
		more: 'Straight to Instagram, X, Facebook or Discord.'
	},
	{
		icon: 'fa-coins',
		title: 'Market',
		desc: 'Lock XP into positions priced from live market data and sell any time.',
		more: 'Thousands of coins, top 50, gainers and losers, live portfolio. No real money.',
		stat: (s: Totals): Live[] => [
			{ label: 'Open positions', value: fmt(s.assets_open_positions), live: true },
			{ label: 'Traders', value: fmt(s.assets_traders) },
			{ label: 'Trades', value: fmt(s.assets_trade_count) }
		]
	},
	{
		icon: 'fa-dice',
		title: 'Minigames',
		desc: 'Gamble picks a multiplier up to 10x, and the win chance is 100 divided by it.',
		more: 'Only XP above your current level can be wagered, so a loss never costs a level.',
		stat: (s: Totals): Live[] => [
			{ label: 'Plays', value: fmt(s.minigames_plays) },
			{ label: 'Wins', value: fmt(s.minigames_wins) },
			{ label: 'Biggest win', value: fmt(s.minigames_biggest_win) }
		]
	},
	{
		icon: 'fa-chart-line',
		title: 'Leveling & XP',
		desc: 'Messages, voice, video and streaming time all earn XP.',
		more: 'Drives levels, level-up messages, role rewards and leaderboards. Reactions are tracked for tasks.',
		stat: (s: Totals): Live[] => [
			{ label: 'XP earned', value: fmt(s.leveling_total_xp) },
			{ label: 'Top level', value: fmt(s.leveling_max_level) },
			{ label: 'Voice hours', value: fmt(s.leveling_total_voice_minutes / 60) }
		]
	},
	{
		icon: 'fa-user-plus',
		title: 'Invite tracking',
		desc: 'See who invited every member and through which link, and pay the inviter XP once the new member stays.',
		more: "Inviters keep a share of that member's XP while they stay, staff earn double, and the server's own /join link counts its joins too."
	},
	{
		icon: 'fa-trophy',
		title: 'Role rewards',
		desc: 'Hand out roles automatically as members hit the levels you set.',
		more: 'No manual role assignment.'
	},
	{
		icon: 'fa-ranking-star',
		title: 'Leaderboard',
		desc: 'All time, month or week, on any metric.',
		more: 'XP, chat, voice, video, streaming, invites, items, minigames.'
	},
	{
		icon: 'fa-users',
		title: 'Members directory',
		desc: 'A searchable directory with levels, roles and activity.',
		more: 'Disguised members stay off it.',
		stat: (s: Totals): Live[] => [
			{ label: 'Tracked members', value: fmt(s.members_with_levels) },
			{ label: 'Messages', value: fmt(s.leveling_total_chat) }
		]
	},
	{
		icon: 'fa-chart-pie',
		title: 'Public statistics',
		desc: 'Live server totals across every module, at a public URL.',
		more: 'No login. Search engines can index it.',
		stat: (s: Totals): Live[] => [
			{ label: 'Live pages', value: fmt(s.servers_counted), live: true },
			{ label: 'Members listed', value: fmt(s.members_total) },
			{ label: 'Channels', value: fmt(s.channels_total) }
		]
	},
	{
		icon: 'fa-sliders',
		title: 'Web dashboard',
		desc: 'Every module configured in the browser, with live bot and server state where it applies.',
		more: 'No slash command trees to memorise.',
		stat: (s: Totals): Live[] => [{ label: 'Servers configured', value: fmt(s.servers_counted) }]
	},
	{
		icon: 'fa-terminal',
		title: 'One-command setup',
		desc: '/setup creates every channel in your server language and wires it to the module that uses it.',
		more: 'Pick the language once. Nothing else to name or pick by hand.',
		stat: (s: Totals): Live[] => [{ label: 'Channels wired', value: fmt(s.channels_total) }]
	},
	{
		icon: 'fa-toggle-on',
		title: 'Per-module toggles',
		desc: 'Every feature has its own switch, per server.',
		more: 'Turn a module off and it disappears everywhere, including from the AI.'
	},
	{
		icon: 'fa-robot',
		title: 'Multiple bots',
		desc: 'Run as many bots as you like from one panel, each with its own token and servers.',
		more: 'Start, stop and restart any of them from the browser.'
	},
	{
		icon: 'fa-shield-halved',
		title: 'Panel permissions',
		desc: 'Owner and staff tiers control who can change what.',
		more: 'Every configuration change is logged with who made it.',
		stat: (s: Totals): Live[] => [{ label: 'Roles mapped', value: fmt(s.roles_total) }]
	},
	{
		icon: 'fa-id-card',
		title: 'Server accounts',
		desc: 'Invite owners and staff into the panel with roles that fit your team.',
		more: 'Separate from who can chat or moderate in Discord.'
	},
	{
		icon: 'fa-circle-dot',
		title: 'Bot presence',
		desc: "Set each bot's status and activity from the panel.",
		more: 'Applies live, no restart.'
	},
	{
		icon: 'fa-user-pen',
		title: 'Bot appearance',
		desc: 'Give the bot its own name, avatar, banner and bio in each server.',
		more: 'Every server sees its own profile, no extra bot needed.'
	},
	{
		icon: 'fa-boxes-stacked',
		title: 'Global item catalog',
		desc: 'Build items once and push them to every server you run.',
		more: 'Per-server pricing and availability on top.'
	},
	{
		icon: 'fa-palette',
		title: 'Message & embed builder',
		desc: 'Post as the bot from the browser: text, photos, videos, embeds or a Components V2 layout, with a live preview.',
		more: 'Buttons and dropdowns open another message privately. Translate it per language, reuse it as a template, and update a posted copy with one click.'
	},
	{
		icon: 'fa-user-tag',
		title: 'Reaction roles',
		desc: 'Role buttons members click to give themselves a role, and click again to drop it.',
		more: 'Built in the Messages tab with a private confirmation for the member. No second bot.'
	},
	{
		icon: 'fa-list-check',
		title: 'Dropdown roles',
		desc: 'A dropdown menu where every choice hands out its own role.',
		more: 'Members can tick several at once, and the menu sits on any message or rules panel you build.'
	},
	{
		icon: 'fa-tower-broadcast',
		title: 'Global messages',
		desc: "Write one message and send it to every server at once, in each server's own language.",
		more: 'For announcements and downtime notices. Update it everywhere with one click, or pull it back from one server or all.'
	},
	{
		icon: 'fa-language',
		title: 'Multi-language',
		desc: `Each server picks its language: ${serverLanguageList('or')}.`,
		more: 'Channel names, the menu, every public post and the AI follow it. Members can still pick their own language for private replies.'
	},
	{
		icon: 'fa-hand',
		title: 'Welcomer',
		desc: 'Greet new members with your own message and a rich embed.',
		more: 'Placeholders for the member, the server, the member count, account age and who invited them.'
	},
	{
		icon: 'fa-door-open',
		title: 'Leaver',
		desc: 'Say goodbye when a member leaves, in a channel you choose.',
		more: 'Placeholders for the member, the server, the member count and how long they stayed.'
	},
	{
		icon: 'fa-hand-sparkles',
		title: 'Join greeting',
		desc: 'The bot introduces itself when it joins, with your docs and support links.',
		more: 'Only the first of your bots greets a shared server. Resend it any time.'
	},
	{
		icon: 'fa-gift',
		title: 'Giveaways',
		desc: 'Entry tracking, winner selection, role-based eligibility and an invite minimum.',
		more: 'Requirements are checked for you when you draw.',
		stat: (s: Totals): Live[] => [
			{ label: 'Running now', value: fmt(s.giveaways_active), live: true },
			{ label: 'Entrants', value: fmt(s.giveaways_entrants) },
			{ label: 'Winners drawn', value: fmt(s.giveaways_winners) }
		]
	},
	{
		icon: 'fa-gavel',
		title: 'Moderation',
		desc: 'Warnings, timeouts, kicks and bans from the panel or the staff menu.',
		more: 'Every action is a numbered case that pings the member. Tick any members to act on them together, and warnings can escalate on their own.'
	},
	{
		icon: 'fa-clipboard-check',
		title: 'Staff rating',
		desc: 'Structured staff evaluation tied to moderation.',
		more: 'Ratings and reviews stay with the staff member.',
		stat: (s: Totals): Live[] => [
			{ label: 'Reviews', value: fmt(s.staff_reviews) },
			{ label: 'Average', value: s.staff_avg_rating > 0 ? s.staff_avg_rating.toFixed(1) : '—' }
		]
	},
	{
		icon: 'fa-moon',
		title: 'AFK',
		desc: 'Members set an AFK status with their own message.',
		more: 'The bot warns anyone who mentions them.',
		stat: (s: Totals): Live[] => [{ label: 'Away now', value: fmt(s.afk_active), live: true }]
	},
	{
		icon: 'fa-gem',
		title: 'Boost messages',
		desc: 'Thank Nitro boosters in a channel you choose.',
		more: 'Placeholders for the member, the boost tier and the boost count.',
		stat: (s: Totals): Live[] => [{ label: 'Boosters', value: fmt(s.members_unique_boosters) }]
	},
	{
		icon: 'fa-star',
		title: 'Custom supporter roles',
		desc: 'Supporters create and personalise their own role.',
		more: 'They pick the name and colour, inside the rules you set.',
		stat: (s: Totals): Live[] => [{ label: 'Custom roles', value: fmt(s.members_with_custom_roles) }]
	},
	{
		icon: 'fa-comment-dots',
		title: 'Feedback',
		desc: 'Collect suggestions and feature requests through Discord flows.',
		more: 'Everything lands in one place instead of scattered threads.',
		stat: (s: Totals): Live[] => [{ label: 'Submissions', value: fmt(s.feedback_submissions) }]
	},
	{
		icon: 'fa-bell',
		title: 'Channel notifications',
		desc: 'Alerts for the channel activity that actually matters.',
		more: 'Pick the events and the channel they post to.'
	},
	{
		icon: 'fa-tower-broadcast',
		title: 'Creator alerts',
		desc: 'Members follow their own YouTube, Twitch and TikTok creators.',
		more: 'Tagged on new videos, live streams and posts.'
	},
	{
		icon: 'fa-video',
		title: 'Content creator',
		desc: 'Creator applications, approvals and TikTok live session digests.',
		more: 'Tied to the channels you nominate.',
		stat: (s: Totals): Live[] => [
			{ label: 'Live now', value: fmt(s.streams_live_now), live: true },
			{ label: 'Creators', value: fmt(s.streams_creators) },
			{ label: 'Peak viewers', value: fmt(s.streams_peak_viewers) }
		]
	},
	{
		icon: 'fa-scroll',
		title: 'Discord Quest notifier',
		desc: 'Quest activity brought into your server as it appears, with banner and thumbnail.',
		more: 'Enough context to know what to run next.',
		stat: (s: Totals): Live[] => [
			{ label: 'Live quests', value: fmt(s.quests_active), live: true },
			{ label: 'Posted', value: fmt(s.quests_posted) },
			{ label: 'Claimed', value: fmt(s.quests_claimed) },
			{ label: 'Participants', value: fmt(s.quests_participants) }
		]
	},
	{
		icon: 'fa-wand-magic-sparkles',
		title: 'Quest enroll',
		desc: 'Optional per-server automation that enrolls members in quests.',
		more: 'Game items, Nitro trials, in-game currency, whatever the quest pays.'
	},
	{
		icon: 'fa-cube',
		title: 'Roblox catalog watch',
		desc: 'Watch the catalog and post rich embeds when items change.',
		more: 'Members tap Notify on an item to get tagged the moment it moves.',
		stat: (s: Totals): Live[] => [
			{ label: 'Items watched', value: fmt(s.roblox_items_watched), live: true },
			{ label: 'Embeds posted', value: fmt(s.roblox_items_posted) },
			{ label: 'Notifications', value: fmt(s.roblox_notifications) }
		]
	},
	{
		icon: 'fa-forward',
		title: 'Message forwarder',
		desc: 'Mirror or sync messages across channels and servers.',
		more: 'Keeps announcements aligned across communities.'
	},
	{
		icon: 'fa-comments',
		title: 'AI chat',
		desc: 'Optional. Mention the bot, or reply to keep going without mentioning again.',
		more: 'Any OpenAI-compatible endpoint. Off until you supply URL, model and key.'
	},
	{
		icon: 'fa-microphone',
		title: 'Voice AI',
		desc: 'Optional. Ask it into a voice channel and talk out loud.',
		more: 'Wakes on a phrase, one speaker at a time, mutes itself when idle.'
	},
	{
		icon: 'fa-database',
		title: 'Server knowledge',
		desc: "The AI reads your server's own live data with no extra key.",
		more: "Statistics, leaderboards, the shop, XP rates and the asker's own account only."
	},
	{
		icon: 'fa-book',
		title: 'Wiki knowledge',
		desc: 'Point the bot at any MediaWiki or Fandom site from the panel.',
		more: 'Reads the rendered page with infoboxes and tables, in any language.'
	},
	{
		icon: 'fa-magnifying-glass',
		title: 'Search, fetch & images',
		desc: 'Web search, page reading and image generation, each on its own key.',
		more: 'Invisible until configured. The model decides when to use them.'
	},
	{
		icon: 'fa-wand-sparkles',
		title: 'Panel assistant',
		desc: 'Tell the dashboard what you want and it sets it up: messages with buttons and translations, wikis, shop items.',
		more: 'Reads your live server data, never deletes anything, and each account only reaches its own servers.'
	},
	{
		icon: 'fa-code-branch',
		title: 'Self-host',
		desc: 'AGPL-3.0 on GitHub, with Docker Compose and a Node adapter.',
		more: 'Or use the hosted bot and skip the infrastructure.'
	},
	{
		icon: 'fa-plug',
		title: 'Webhook server',
		desc: 'Incoming hooks for selected automation paths.',
		more: 'For wiring the bot into what you already run.'
	}
];

export const faq = [
	{
		q: `Is ${APP_NAME} Bot a free MEE6 alternative?`,
		a: 'Yes. Leveling, role rewards, welcome messages, moderation, giveaways and YouTube, Twitch and TikTok alerts are all free, with no premium tier. The code is open source under AGPL-3.0, so you can read it, change it or run it yourself.'
	},
	{
		q: `How is ${APP_NAME} Bot different from MEE6?`,
		a: "Nothing costs extra, the code is open, and members get more to do: they steal and defend each other's XP, clear daily tasks made for them, and get their own account page."
	},
	{
		q: `Does ${APP_NAME} Bot have reaction roles and an embed builder?`,
		a: 'Yes, both free. The Messages tab builds embeds, plain posts with photos and videos, and Components V2 layouts with a live preview, then posts them as the bot. Any button or dropdown can give or take a role, so reaction roles and dropdown roles need no second bot.'
	},
	{
		q: 'Is there a web dashboard?',
		a: 'Yes. Every module is configured in the browser instead of slash commands, with owner and staff access per server. /setup builds the channels once.'
	},
	{
		q: `Can I self-host ${APP_NAME} Bot?`,
		a: 'Yes. The source is on GitHub with Docker Compose and a Node adapter. Or add the hosted bot and skip the infrastructure.'
	},
	{
		q: 'What do members actually get?',
		a: 'Their own account page, one tap from the Discord menu: a bag of items, eighteen daily and eighteen weekly tasks, a streak, a check-in, a market portfolio and an animated card. No signup.'
	},
	{
		q: `Is ${APP_NAME} Bot an economy bot?`,
		a: 'Yes. XP is the currency. Members buy items with it, wager it, invest it in a market priced from live crypto data and steal it from each other. No real money.'
	},
	{
		q: 'Do I have to write the tasks?',
		a: 'No. Tasks generate per member, sized from their own last seven days, so every list fits the member and nobody on staff maintains them.'
	},
	{
		q: 'Does the AI know my server?',
		a: 'Yes. Chat and Gemini Live voice answer from your live leaderboards, shop prices, XP rates and statistics, and from any MediaWiki or Fandom wiki you add.'
	},
	{
		q: `Can ${APP_NAME} Bot alert on Roblox item prices?`,
		a: "Yes, per member. Anyone can tap Notify me under a catalog post and get tagged when that item's price, resale price, stock or total supply changes."
	}
];
