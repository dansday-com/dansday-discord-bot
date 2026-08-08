# &lt;/DANSDAY&gt; Discord Bot

Leveling, moderation, embed builder, Discord Quests, creator tools, public statistics pages and Roblox catalog alerts — all from a free web panel instead of slash commands. Self-host from GitHub or add the hosted bot. MIT licensed.

---

## Features

### Panel

- **Granular permissions** - Owner and staff tiers control who changes what.
- **Server accounts** - Invite owners and staff, with roles separate from Discord permissions.
- **Per-module toggles** - Enable or disable each feature per server.
- **Embed builder** - Rich embeds with live preview, placeholders and images.
- **Multi-language** - English and Indonesian for Discord buttons, selects and labels.

### Community & engagement

- **Items & XP economy** ⭐ _new_ - Per-server shop priced in XP, 50-slot bag, optional timed availability. Effects: 💰 steal, 💥 bomb, 🩸 leech, 🎯 bounty, 🛡️ shield, 🪞 reflect, 💵 insurance, ⚡ boost, 🎁 gift, 🔍 spy, 🎭 disguise, 🧼 purifier, 🍀 luck.
  - 🍀 **Luck** raises steal and bomb rolls, minigame odds, spy success, leech skim, friend boost and insurance refund, cuts gift tax and discounts prices. Timed buffs lock luck in on activation, so use luck first.
- **Assets market** ⭐ _new_ - Lock XP into real crypto positions at live CoinGecko prices and sell any time. Thousands of coins, top 50, gainers and losers, live portfolio. No real money.
- **Minigames** ⭐ _new_ - Wager XP. 🎲 **Gamble**: pick a multiplier up to 10×, win chance is 100 ÷ it. Only XP above your current level can be wagered, so a loss never costs a level.
- **Tasks, streaks & check-in** ⭐ _new_ - No admin setup; goals, difficulty and rewards generate per member.
  - 18 daily tasks (6 easy, 6 medium, 6 hard from a 96-goal catalog) and 18 weekly, on the member's local clock. No two members get the same list.
  - Goals are sized from that member's own last 7 days of the exact metric, capped by what the period physically allows, and graded as real effort rather than by rank.
  - Rewards are XP or a shop item at a 30% item chance. Tasks that cost XP always pay back more than they cost.
  - 🔥 **Streaks** - Clear all 18 daily for +2% reward XP per day up to +100%, milestones at 7 / 30 / 100 / 365. Two ❄️ freezes cover missed days, one back every 10 claims.
  - 📆 **Check-in** - 7-day cycle, one claim per local day, 1,000 → 50,000 XP, identical on every server. 50% chance of a shop item instead, rolled by rarity tier.
- **Leveling & XP** - Messages and voice feed levels, role rewards and leaderboards. Reactions are tracked for tasks.
- **Welcomer** - Custom welcome messages and embeds.
- **Giveaways** - Entries, winner selection and role-based eligibility.
- **AFK** - Members set a status; the bot warns anyone who mentions them.
- **Staff rating** - Structured staff evaluation tied to moderation.
- **Booster messages** - Thank Nitro boosters with configurable channels and templates.
- **Custom supporter roles** - Supporters personalize role name and color within your rules.
- **Feedback** - Collect suggestions through Discord flows.

### Safety & operations

- **Moderation** - Warnings, mutes, bans and staff actions from the panel.
- **Channel notifications** - Alerts for important channel activity.
- **Message forwarder** - Mirror or sync messages across channels.

### AI

- **Chat** - Mention the bot, or reply to one of its messages to continue without mentioning again. Private conversation per member per server, kept in a session that expires 30 minutes after they stop talking. Works with any OpenAI-compatible endpoint (Gemini, OpenAI, GLM, Qwen, DeepSeek, local models). Long replies are split across messages.
- **Voice** - Ask it in chat to join your voice channel, then talk out loud via the Gemini Live API. One call at a time; it leaves when nobody has called it for a few minutes or when the member who invited it leaves. Requires Redis.
  - Wakes on "hey stupid" via an on-device openWakeWord model, so a busy channel never sets it off and there is no extra API cost.
  - One speaker holds the conversation at a time; crosstalk, background noise and other bots are ignored.
  - Mutes itself when idle, stays unmuted while a lookup is still running, and clears a moderator's server mute or deafen.
  - Follows the inviter between channels, and only they can send it away.
  - Its own Google AI key, voice model and system prompt, none of them shared with chat.
- **Tools** - The model decides when to use these, in chat and voice alike. Each takes its own URL, model and key, and stays invisible until all three are set.
  - 🔍 **Web search** - The default lookup for any factual question: news, prices, versions, whether something is real.
  - 📄 **Web fetch** - Reads a page a member linked, or a search result whose snippet was too thin to answer from. Never invented URLs.
  - 🖼️ **Images** - Drawn on request and uploaded to Discord as files rather than linked, so nothing breaks when the provider's URL expires.
  - 📚 **Wikis** - Any MediaWiki site including Fandom, many per bot, managed in the panel. Reads the full rendered page with infoboxes, tables and changelogs, in any language, cached 10 minutes. Applies to chat and voice with no restart.
  - 🔗 **Chains instead of giving up** - A thin, empty or off-target result moves on to the next tool rather than reporting failure. Live values like timers and active events go straight to the web.

### Integrations

- **Discord Quest notifier** - Quest activity, with optional per-server enrollment automation.
- **Roblox catalog watch** - Post embeds when catalog items change, for trading and UGC communities.
- **Content creator / TikTok** - Creator applications and TikTok live digests tied to server channels.

### Public web pages

- **Public statistics** - Master switch for server statistics, leaderboard, members and the member account. Items, Minigames, Assets and Daily tasks are sub-toggles. Off means everything public goes dark.

### Advanced

- **Official bot (discord.js)** - Core automation, slash `/setup`, buttons and component interactions.
- **Optional self-bot path** - Panel-managed tokens for forwarder and quest flows. Use in line with Discord's terms and your own risk assessment.
- **Webhook server** - Incoming hooks for selected automation paths.

---

## Tech stack

Versions match `package.json` at release (caret ranges; run `npm ls` for the exact tree).

| Area                 | Technologies                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language & framework | [TypeScript](https://www.typescriptlang.org/) 6.0, [SvelteKit](https://kit.svelte.dev/) 2.57, [Svelte](https://svelte.dev/) 5.55, [Vite](https://vitejs.dev/) 8.0, adapter-node 5.5         |
| Styling              | [Tailwind CSS](https://tailwindcss.com/) 4.2, Prettier 3.8 with Svelte and Tailwind plugins                                                                                                 |
| Discord              | [discord.js](https://discord.js.org/) 14.26, discord-api-types 0.38; discord.js-selfbot-v13 3.7 on the optional user-token path                                                             |
| AI chat              | [openai](https://www.npmjs.com/package/openai) 7.1 SDK against any OpenAI-compatible endpoint, set per bot in the panel                                                                     |
| Voice AI             | [@google/genai](https://www.npmjs.com/package/@google/genai) 2.15 (Gemini Live API), @discordjs/voice 0.19, @discordjs/opus 0.10, sodium-native 5.1, prism-media 1.3, ffmpeg                |
| AI tools             | Native `fetch` to `/search`, `/web/fetch` and `/images/generations` on any OpenAI-compatible gateway; [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page) with cheerio 1.2 |
| Data                 | [MySQL](https://www.mysql.com/) via mysql2 3.22, [Drizzle ORM](https://orm.drizzle.team/) 0.45 and Drizzle Kit 0.31                                                                         |
| Cache & sessions     | [Redis](https://redis.io/) 5.12 for sessions, voice coordination and AI chat memory; optional, with an in-process fallback                                                                  |
| Everything else      | axios 1.15, bcryptjs 3.0, Luxon 3.7, Nodemailer 8.0, proxy-agent 8.0, rozod 6.6, tiktok-live-connector 2.1, dotenv 17.4, OpenTelemetry 1.9                                                  |

---

## Configuration

- Copy **`.env.example`** to **`.env`** and set the database, session, captcha, mail, Redis and bot token values.
- Enable the **Server Members** and **Message Content** privileged intents in the Discord Developer Portal, or the bot will not start.
- **AI, voice and the tools** are configured in the panel, not `.env`. Each needs its URL, model and key before it switches on, so a half-filled section is inactive rather than broken. Keys are stored per bot and never sent back to the browser. Restart the bot after changing them.
- **Voice** needs AI chat enabled first, plus its own Google AI key and voice model, plus Redis.
- **Wikis** live on the bot's **Wikis** tab. Add an `api.php` endpoint, press Test, done — no restart. If a wiki refuses your server (Miraheze sits behind a Cloudflare check that rejects most datacenter IPs), copy [`scripts/relay.php`](scripts/relay.php) to hosting it does accept, replace `RELAY_KEY` with a long random string, and fill in **Relay URL** and **Relay key** for that wiki.

---

MIT · Author: Akbar Yudhanto · Version: 26.5.5
