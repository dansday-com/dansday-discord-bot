# &lt;/DANSDAY&gt; Discord Bot

Leveling, moderation, an embed builder, Discord Quests, creator tools, public statistics pages, Roblox catalog alerts and more — all from a free web panel instead of slash commands. Self-host from GitHub or add the hosted bot.

Open source under the MIT license.

---

## Features

### Web control panel

- **Granular permissions** - Owner and staff tiers control who can change which settings.
- **Server accounts** - Invite owners and staff into the panel, with roles separate from Discord permissions.
- **Per-module toggles** - Enable or disable major features per server.
- **Multi-language UI (Discord flows)** - English and Indonesian strings for buttons, selects and labels.
- **Embed builder** - Rich embeds with live preview, placeholders and images, sent from the browser.

### Community & engagement

- **Items & XP economy** ⭐ _new_ - Spend earned XP in a per-server shop on PvP and utility items, each with its own cost, effect and optional timed availability. Purchases sit in a 50-slot bag and are used through Discord. Effects:
  - 💰 **Steal** - take a slice of another member's XP (with cooldown and post-hit immunity).
  - 💥 **Bomb** - destroy a slice of a member's XP outright.
  - 🩸 **Leech** - siphon a percentage of a target's XP for a set duration.
  - 🎯 **Bounty** - put XP on a member's head; whoever robs them next collects it.
  - 🛡️ **Shield** - block incoming steals, bombs, and leeches while active.
  - 🪞 **Reflect** - bounce the next attack back at the attacker.
  - 💵 **Insurance** - refund your XP the next time you're robbed.
  - ⚡ **Boost** - multiply your XP earnings for a set duration.
  - 🎁 **Gift** - send XP to another member (with optional tax).
  - 🔍 **Spy** - reveal a member's bag, active effects, cooldowns, and bounty.
  - 🎭 **Disguise** - go anonymous and drop off the leaderboard for a set duration.
  - 🧼 **Purifier** - wipe all of your own active effects at once.
  - 🍀 **Luck** - a % boost that improves steal and bomb rolls, minigame odds, spy success, leech skim, friend boost and insurance refund, cuts gift tax and discounts shop prices. Timed buffs lock in your luck on activation, so use luck first.
- **Assets market (XP paper-trading)** ⭐ _new_ - Members lock XP into real crypto positions at live CoinGecko prices and sell any time for gains or losses. Search thousands of coins, browse top 50, gainers and losers, track a live portfolio. No real money — purely an XP game.
- **Minigames** ⭐ _new_ - Free-to-play games where members wager XP, under the Public statistics toggle with its own channel. First game is 🎲 **Gamble**: pick a multiplier up to 10×, win chance is 100 ÷ it. Only XP earned above your current level can be wagered, so a loss never drops your level. Feeds a Minigames leaderboard.
- **Tasks, streaks & check-in** ⭐ _new_ - A Task tab on the member account, under the Daily tasks sub-toggle. No admin setup — goals, difficulty and rewards generate per member.
  - ☀️ **Daily tasks** - 18 a day (6 easy, 6 medium, 6 hard) from a catalog of 96 goals. No two members get the same list.
  - 📅 **Weekly tasks** - 18 hard tasks, Monday to Sunday on the member's local clock.
  - 🎯 **Goals sized to the member** - Built from that member's own last 7 days of the exact metric, not their level, and capped by what the period physically allows.
  - 💬 **Activity goals** - Chat, reactions and voice / video / streaming cap at 50 a day and 200 a week: 17 / 33 / 50 daily, 67 / 133 / 200 weekly.
  - ⚖️ **Honest difficulty** - Every goal is priced as real effort and graded, never assigned by rank. Activity goals grade against their daily cap, everything else against the server's earn rate.
  - 🎁 **Rewards** - XP or a shop item, 30% item chance, priced 0.85× to 1× the task value. Tasks that cost XP always pay back more than they cost.
  - 🔥 **Streaks** - Clear all 18 daily tasks for +2% reward XP per day, up to +100%. Milestones at 7, 30, 100 and 365 days. Two ❄️ **freezes** cover missed days, one back every 10 claims.
  - 📆 **Daily check-in** - 7-day cycle, one claim per local day: 1,000 → 2,500 → 5,000 → 9,000 → 15,000 → 25,000 → 50,000 XP, identical on every server. Miss a day, restart at day 1.
  - 🎰 **Check-in gacha** - 50% chance of a shop item instead of XP, rolled by rarity tier. Day 1 is 50 / 24 / 14 / 8 / 3 / 1% common to mythic; every tier above common climbs 0.5 a day, reaching 4% mythic by day 7. Unstocked tiers redistribute to the ones the shop sells.
  - 🧾 **Reward history** - XP lands in level history as **Task Reward** / **Daily Reward**, items in item history. Reward XP never counts toward the activity totals that size future goals.
- **Leveling & XP** - Messages and voice feed levels, role rewards and leaderboards. Reactions are tracked for tasks.
- **Welcomer** - Custom welcome messages and embeds for new members.
- **Giveaways** - Entries, winner selection and role-based eligibility.
- **AFK** - Members set an AFK status; the bot warns anyone who mentions them.
- **Feedback** - Collect suggestions through Discord flows.
- **Staff rating** - Structured staff evaluation tied to moderation.
- **Booster messages** - Thank Nitro boosters with configurable channels and templates.
- **Custom supporter roles** - Supporters personalize role name and color within your rules.

### Safety & operations

- **Moderation** - Warnings, mutes, bans and staff actions from the panel.
- **Channel notifications** - Alerts for important channel activity.
- **Message forwarder** - Mirror or sync messages across channels.

### Integrations & alerts

- **AI chat** - Mention the bot to talk to it, or reply to one of its messages to continue without mentioning again. Every member keeps a private conversation per server, with older turns summarized as they age out. Configured per bot in the panel: API URL, key, model, reasoning effort and system prompt. Works with any OpenAI-compatible endpoint (Gemini, OpenAI, GLM, Qwen, DeepSeek, local models). Replies over Discord's limit are split across messages.
- **Discord Quest notifier** - Surface Discord Quest activity, with optional per-server enrollment automation.
- **Roblox catalog watch** - Post embeds when catalog items change, for trading and UGC communities.
- **Content creator / TikTok** - Creator applications and TikTok live digests tied to server channels.

### Public web pages

- **Public statistics** - Master switch for all public pages: server statistics, leaderboard, members and the member account (Overview, History, Guide). Items, Minigames, Assets and Daily tasks are sub-toggles here. Off means everything public goes dark.

### Advanced

- **Official bot (discord.js)** - Core automation, slash `/setup`, buttons and component interactions.
- **Optional self-bot path** - Panel-managed tokens for forwarder and quest flows. Use in line with Discord's terms and your own risk assessment.
- **Webhook server** - Incoming hooks for selected automation paths.

---

## Tech stack

Versions match `package.json` at release (caret ranges; run `npm ls` for the exact tree).

| Area                       | Technologies                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language                   | [TypeScript](https://www.typescriptlang.org/) 6.0                                                                                                                                                                        |
| App framework              | [SvelteKit](https://kit.svelte.dev/) 2.57, [Svelte](https://svelte.dev/) 5.55                                                                                                                                            |
| Build & dev                | [Vite](https://vitejs.dev/) 8.0, [`@sveltejs/vite-plugin-svelte`](https://github.com/sveltejs/vite-plugin-svelte) 7.0, [svelte-check](https://www.npmjs.com/package/svelte-check) 4.4                                    |
| SSR / hosting              | [`@sveltejs/adapter-node`](https://svelte.dev/docs/kit/adapters#@sveltejs/adapter-node) 5.5 (Node server)                                                                                                                |
| Styling                    | [Tailwind CSS](https://tailwindcss.com/) 4.2 ([`@tailwindcss/vite`](https://tailwindcss.com/docs/installation/framework-guides/sveltekit) 4.2)                                                                           |
| Formatting (dev)           | [Prettier](https://prettier.io/) 3.8 + Svelte / Tailwind plugins                                                                                                                                                         |
| Official bot               | [discord.js](https://discord.js.org/) 14.26, [discord-api-types](https://www.npmjs.com/package/discord-api-types) 0.38                                                                                                   |
| User-token path (optional) | [discord.js-selfbot-v13](https://www.npmjs.com/package/discord.js-selfbot-v13) 3.7                                                                                                                                       |
| HTTP client                | [axios](https://axios-http.com/) 1.15                                                                                                                                                                                    |
| AI chat                    | [openai](https://www.npmjs.com/package/openai) 7.1 SDK, pointed at any OpenAI-compatible endpoint (URL, key and model set per bot in the panel)                                                                          |
| Roblox catalog API         | [rozod](https://www.npmjs.com/package/rozod) 6.6 (typed catalog fetch alongside axios thumbnails)                                                                                                                        |
| Database                   | [MySQL](https://www.mysql.com/) via [mysql2](https://github.com/sidorares/node-mysql2) 3.22, [Drizzle ORM](https://orm.drizzle.team/) 0.45 + [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) 0.31 (migrations) |
| Password hashing           | [bcryptjs](https://www.npmjs.com/package/bcryptjs) 3.0                                                                                                                                                                   |
| Dates & time               | [Luxon](https://moment.github.io/luxon/) 3.7                                                                                                                                                                             |
| Cache / sessions           | [Redis](https://redis.io/) client ([`redis`](https://www.npmjs.com/package/redis) 5.12 for Node), optional by configuration                                                                                              |
| Email                      | [Nodemailer](https://nodemailer.com/) 8.0, optional                                                                                                                                                                      |
| Proxies                    | [proxy-agent](https://www.npmjs.com/package/proxy-agent) 8.0 (where outbound HTTP uses a proxy)                                                                                                                          |
| Observability              | [OpenTelemetry](https://opentelemetry.io/) `@opentelemetry/api` 1.9, logs SDK & auto-instrumentations 0.214, OTLP HTTP log exporter (optional)                                                                           |
| Integrations               | [TikTok Live Connector](https://www.npmjs.com/package/tiktok-live-connector) 2.1 (creator / live flows)                                                                                                                  |
| Config                     | [dotenv](https://www.npmjs.com/package/dotenv) 17.4                                                                                                                                                                      |

---

## Configuration

Copy **`.env.example`** to **`.env`** and set database, session, captcha, mail, Redis and bot token values.

The bot requests the Guilds, Message Content, Server Members, Moderation, Voice States and Message Reactions intents. **Server Members** and **Message Content** are privileged — enable both in the Discord Developer Portal or the bot will not start.

AI chat is not configured through `.env`. Open the bot in the panel and set the API URL, key, model and reasoning effort there — the key is stored per bot and never sent back to the browser. Enabling AI chat requires the URL, key and model to all be set. Restart the bot after changing these values.

---

## License

MIT · Author: Akbar Yudhanto · Version: 26.5.0
