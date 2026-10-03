<div align="center">

<img src="static/favicon.svg" alt="" width="72">

# &lt;/DANSDAY&gt;

**The free Discord leveling bot where members steal each other's XP — and fight to keep it.**

Steal, bomb and leech on one side, shield, reflect and insurance on the other. Per-member Roblox price alerts, AI chat and voice that answer from your server's own numbers, personal daily tasks and 70 animated card themes. Configured in a browser. Self-host it or add the hosted bot.

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-1a7f37?style=flat-square)](LICENSE)
[![Self-hostable](https://img.shields.io/badge/self--host-Docker%20%7C%20Node%2025-2b7489?style=flat-square)](#quick-start)
[![discord.js](https://img.shields.io/badge/discord.js-14.26-5865F2?style=flat-square)](https://discord.js.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.70-ff3e00?style=flat-square)](https://kit.svelte.dev/)
[![Chat on Discord](https://img.shields.io/badge/community-Discord-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/7fEqEDSur3)

**[Live demo](https://dansday.dev)** · **[Docs](https://dansday.dev/docs)** · **[Self-host](#quick-start)** · **[Discord](https://discord.gg/7fEqEDSur3)** · **[Contributing](CONTRIBUTING.md)**

![The web panel's landing page, listing every module](.github/screenshots/landing.gif)

</div>

---

## What makes it different

On most leveling bots, XP only ever goes up. Here **members take it from each other** and fight to keep it, and that gives them a reason to come back tomorrow.

- **Members steal XP.** A steal takes it, a bomb burns it and credits no one, a leech skims what the victim earns next. Shield, reflect and insure against it. Put a bounty on the leader, spy before you strike, disguise yourself off every public board. Luck tilts the rolls.
- **Roblox alerts per member.** A member taps 🔔 Notify me under any catalog post and gets tagged when that item's price, resale price, stock or total supply changes. Their own watchlist, not a channel-wide feed.
- **AI that reads your own server.** Chat and Gemini Live voice, woken by "hey stupid", that answer from your live statistics, leaderboards, shop prices and XP rates, and from any MediaWiki or Fandom wiki you add.
- **XP is a currency.** Spend it in a per-server shop, invest it in a market priced from live CoinGecko data, or wager it. Wagers only touch XP above your current level, so a bad bet never costs one. No real money anywhere.
- **Tasks nobody had to write.** 18 daily and 18 weekly per member from a 96-goal catalog, sized from their own last 7 days and priced against your shop. Streaks up to +100% and a 7-day check-in. Free, with zero admin setup.
- **Every member gets an account.** One tap on the Account button in the Discord menu opens their own page: where their XP came from, a 14-day flow, who they talk to in voice, their bag, tasks, portfolio, minigames and history. No signup, no password.
- **70 card themes to win.** Spin 1,000 XP for an animated effect, from fire and aurora to a black hole. It repaints their account, their leaderboard row and their members-list card.
- **One panel, every server, yours to run.** Every module is a tab in the browser, not a slash command. Multi-bot and multi-server from one login, AGPL-3.0, nothing held back behind a tier.

The basics are here too: leveling, role rewards, a welcomer, giveaways, moderation, and YouTube, Twitch and TikTok alerts. Free, in the same panel.

---

## Quick start

You need **Node.js 25**, **MySQL**, and **Redis** (optional — there is an in-process fallback, but voice needs it).

```bash
git clone https://github.com/dansday-com/dansday-discord-bot.git
cd dansday-discord-bot
npm install
cp .env.example .env   # database, session secret, mail, Redis
npm run dev            # panel on http://localhost:5173
```

Docker builds the panel image and expects MySQL and Redis to already exist — point `.env` at them, then:

```bash
make up     # build and start, serving on :80 behind your reverse proxy
make logs   # follow output
make down   # stop
```

Enable the **Server Members** and **Message Content** privileged intents in the Discord Developer Portal or the bot will not start. AI, voice, tools and wikis are set per bot **in the panel**, not in `.env`.

Prefer not to host anything? **[Add the hosted bot](https://dansday.dev)** — same features, nothing to run.

---

## Screenshots

<details>
<summary><b>Public directories</b> — servers, quests, Roblox catalog, items, tasks, wikis</summary>
<br>

No login needed. The site indexes every public server, quest, item, task, wiki and forwarder source in one place.

<table>
<tr>
<td width="33%"><img src=".github/screenshots/servers.png" alt="Server directory ranking every public server by XP, members and activity"></td>
<td width="33%"><img src=".github/screenshots/quests.png" alt="Discord Quests directory with game art, rewards and expiry dates"></td>
<td width="33%"><img src=".github/screenshots/roblox.png" alt="Roblox catalog directory with prices, stock and favourites"></td>
</tr>
<tr>
<td><strong>Servers</strong> — every public server, ranked by XP.</td>
<td><strong>Quests</strong> — live Discord Quests with rewards and expiry.</td>
<td><strong>Roblox catalog</strong> — 10.7K items, priced and ordered by favourites.</td>
</tr>
</table>

<table>
<tr>
<td width="33%"><img src=".github/screenshots/shop.png" alt="Item catalog listing every shop item with its effect and rarity"></td>
<td width="33%"><img src=".github/screenshots/tasks.png" alt="Task catalog listing every daily and weekly task with its reward"></td>
<td width="33%"><img src=".github/screenshots/wikis.png" alt="Wiki knowledge base explaining each module"></td>
</tr>
<tr>
<td><strong>Items</strong> — what every shop item does, before you buy it.</td>
<td><strong>Tasks</strong> — every daily and weekly task and its reward.</td>
<td><strong>Wikis</strong> — how each module works, in plain language.</td>
</tr>
</table>

</details>

<details>
<summary><b>The panel</b> — overview and per-module configuration</summary>
<br>

<table>
<tr>
<td width="50%"><img src=".github/screenshots/panel-overview.png" alt="Panel overview with live totals for members, XP, shop, PvP, market and minigames"></td>
<td width="50%"><img src=".github/screenshots/bot-configuration.png" alt="Per-bot configuration with one tab per module"></td>
</tr>
<tr>
<td><strong>Overview</strong> — every bot and server at a glance: members, XP, voice hours, shop, PvP, market, minigames.</td>
<td><strong>Configuration</strong> — one tab per module. Set embed style, colors and channels without slash commands.</td>
</tr>
</table>

</details>

<details>
<summary><b>Public server pages</b> — statistics, leaderboard, members</summary>
<br>

Every server gets its own live pages at `/server/<slug>`.

<table>
<tr>
<td width="33%"><img src=".github/screenshots/public-statistics.png" alt="Public statistics with members, channels, leveling, voice activity, market, items, minigames and giveaways"></td>
<td width="33%"><img src=".github/screenshots/leaderboard.gif" alt="Leaderboard podium and rankings, filterable by XP, chat, voice, video, streaming, items and minigames"></td>
<td width="33%"><img src=".github/screenshots/members.png" alt="Members directory with per-member level, messages, activity and XP"></td>
</tr>
<tr>
<td><strong>Statistics</strong> — live server totals across every module.</td>
<td><strong>Leaderboard</strong> — all time, month or week, on any metric.</td>
<td><strong>Members</strong> — searchable directory with levels and roles.</td>
</tr>
</table>

</details>

<details>
<summary><b>Member accounts</b> — overview, tasks, shop, market, minigames, themes</summary>
<br>

Each member signs in to their own account on those same pages.

<table>
<tr>
<td width="33%"><img src=".github/screenshots/account-overview.png" alt="Account overview with lifetime XP sources, 14-day XP flow, activity split, voice buddies and asset portfolio"></td>
<td width="33%"><img src=".github/screenshots/tasks-streaks.png" alt="Daily and weekly tasks with streak counter and seven-day check-in"></td>
<td width="33%"><img src=".github/screenshots/shop-items.png" alt="XP shop with steal, bomb, boost and shield items, prices and timed availability"></td>
</tr>
<tr>
<td><strong>Overview</strong> — where their XP came from, and who they earn it with.</td>
<td><strong>Tasks & streaks</strong> — 18 daily and 18 weekly, plus check-in.</td>
<td><strong>Shop</strong> — buy and activate items priced in XP.</td>
</tr>
</table>

<table>
<tr>
<td width="33%"><img src=".github/screenshots/assets-market.png" alt="Assets market listing top 50 coins at live prices with sparklines"></td>
<td width="33%"><img src=".github/screenshots/minigames.png" alt="Minigames tab with the Gamble wager game"></td>
<td width="33%"><img src=".github/screenshots/history.png" alt="History feed of task rewards, chat and voice XP, gambles and item activations"></td>
</tr>
<tr>
<td><strong>Assets</strong> — live CoinGecko prices, no real money.</td>
<td><strong>Minigames</strong> — wager XP above your current level.</td>
<td><strong>History</strong> — every XP event, filterable by source.</td>
</tr>
</table>

<table>
<tr>
<td width="50%"><img src=".github/screenshots/account-themes.gif" alt="Themes tab with animated card effects unlocked by spinning"></td>
<td width="50%"><img src=".github/screenshots/account-guide.png" alt="Guide tab walking through XP, tasks, items and the market"></td>
</tr>
<tr>
<td><strong>Themes</strong> — animated card effects, won from a spin.</td>
<td><strong>Guide</strong> — how to earn, spend and compete, one step at a time.</td>
</tr>
</table>

</details>

<details>
<summary><b>Documentation</b></summary>
<br>

<table>
<tr>
<td width="100%"><img src=".github/screenshots/docs.png" alt="Setup documentation for adding and configuring the bot"></td>
</tr>
<tr>
<td><strong>Docs</strong> — add the bot, connect a server, configure each module.</td>
</tr>
</table>

</details>

---

## Features

### Member accounts

- **Account page** - The Account button in the Discord menu opens the member's own page. XP sources, a 14-day XP flow, voice buddies, bag, tasks, portfolio, minigames and history. No signup, no password.
- **Member themes** - Each member sets a background image and an accent colour read from it, then spins 1,000 XP for an animated effect. It repaints their account, cards, their leaderboard row and their members-list card.
- **Public** - Master switch for server statistics, leaderboard, members and the member account. Items, Minigames, Assets, Daily tasks and Server invite are sub-toggles, all on by default. The server join page takes its own background image, tone and animated effect. Off means everything public goes dark.

### XP economy & PvP

- **Items & XP economy** - Per-server shop priced in XP, 50-slot bag, optional timed availability. Effects: 💰 steal, 💥 bomb, 🩸 leech, 🎯 bounty, 🛡️ shield, 🪞 reflect, 💵 insurance, ⚡ boost, 🎁 gift, 🔍 spy, 🎭 disguise, 🧼 purifier, 🍀 luck.
  - 🍀 **Luck** raises steal and bomb rolls, minigame odds, spy success, leech skim, friend boost and insurance refund, cuts gift tax and discounts prices. Timed buffs lock luck in on activation, so use luck first.
- **Assets market** - Lock XP into real crypto positions at live CoinGecko prices and sell any time. Thousands of coins, top 50, gainers and losers, live portfolio. No real money.
- **Minigames** - Wager XP. 🎲 **Gamble**: pick a multiplier up to 10×, win chance is 100 ÷ it. Only XP above your current level can be wagered, so a loss never costs a level.

### Tasks, streaks & check-in

- **No admin setup** - Goals, difficulty and rewards generate per member.
  - 18 daily tasks (6 easy, 6 medium, 6 hard from a 96-goal catalog) and 18 weekly, on the member's local clock. No two members get the same list.
  - Goals are sized from that member's own last 7 days of the exact metric, capped by what the period physically allows, and graded as real effort rather than by rank.
  - Rewards are XP or a shop item at a 30% item chance. Tasks that cost XP always pay back more than they cost.
  - 🔥 **Streaks** - Clear all 18 daily for +2% reward XP per day up to +100%, milestones at 7 / 30 / 100 / 365. Two ❄️ freezes cover missed days, one back every 10 claims.
  - 📆 **Check-in** - 7-day cycle, one claim per local day, 1,000 → 50,000 XP, identical on every server. 50% chance of a shop item instead, rolled by rarity tier.

### AI

- **Chat** - Mention the bot, or reply to one of its messages to continue without mentioning again. Private conversation per member per server, kept in a session that expires 30 minutes after they stop talking. Works with any OpenAI-compatible endpoint (Gemini, OpenAI, GLM, Qwen, DeepSeek, local models). Long replies are split across messages.
- **Voice** - Ask it in chat to join your voice channel, then talk out loud via the Gemini Live API. One call at a time; it leaves when nobody has called it for a few minutes or when the member who invited it leaves. Requires Redis.
  - Wakes on "hey stupid" via an on-device openWakeWord model, so a busy channel never sets it off and there is no extra API cost.
  - One speaker holds the conversation at a time; crosstalk, background noise and other bots are ignored.
  - Mutes itself when idle, stays unmuted while a lookup is still running, and clears a moderator's server mute or deafen.
  - Follows the inviter between channels, and only they can send it away.
  - Its own Google AI key, voice model and system prompt, none of them shared with chat.
- **Tools** - The model decides when to use these, in chat and voice alike. Web search, fetch and images each take their own URL, model and key, and stay invisible until all three are set.
  - 🔍 **Web search** - The default lookup for any factual question: news, prices, versions, whether something is real.
  - 📄 **Web fetch** - Reads a page a member linked, or a search result whose snippet was too thin to answer from. Never invented URLs.
  - 🖼️ **Images** - Drawn on request and uploaded to Discord as files rather than linked, so nothing breaks when the provider's URL expires.
  - 📚 **Wikis** - Any MediaWiki site including Fandom, many per bot, managed in the panel. Reads the full rendered page with infoboxes, tables and changelogs, in any language, cached 10 minutes. Applies to chat and voice with no restart.
  - 🔗 **Chains instead of giving up** - A thin, empty or off-target result moves on to the next tool rather than reporting failure. Live values like timers and active events go straight to the web.
  - 📊 **Server knowledge** - Reads this server's own live data with no extra key: statistics, leaderboards on any metric, a member's public profile, staff ratings, running giveaways, active quests, the shop with prices and timings, and the XP guide. Follows your module toggles, so anything you switch off disappears from the AI too.
  - ⭐ **XP rates** - Reads your server's own leveling configuration, so "how much XP for an hour in voice", "how much per message" and "how much XP to reach level 10" get exact answers off your settings, not guesses. Covers voice, AFK voice, video, streaming and chat rates, the message cooldown, the friend and luck bonuses, and the level-up formula.
  - 🎒 **Their own account** - Level, bag, assets, minigames, history, tasks and streak — always the asker's own and never anyone else's, so "what is in my bag" works and "what is in theirs" does not.

### Panel

- **One-command setup** - `/setup` creates every channel and wires it to its module. Nothing to pick by hand.
- **Granular permissions** - Owner and staff tiers control who changes what.
- **Change log** - Every configuration save records who changed which setting, before and after. Embeds sent from the builder, invite edits and panel moderation are logged with who did them too.
- **Server accounts** - Invite owners and staff, with roles separate from Discord permissions.
- **Per-module toggles** - Enable or disable each feature per server.
- **Greetings** - The join greeting sends itself. Only the first of your bots greets a shared server; resend from the panel.
- **Embed builder** - Rich embeds with live preview, placeholders and images.
- **Bot appearance** - Own nickname, avatar, banner and bio per server, set on the Main page.
- **Multi-language** - English, Indonesian, German, Spanish, Arabic, Malay and Simplified Chinese for Discord buttons, selects and labels.

### Community

- **Leveling & XP** - Messages and voice feed levels, role rewards and leaderboards. Reactions are tracked for tasks.
- **Invite tracking** - Every join is credited to the inviter's link, and they earn XP once the new member stays past a hold time. After that they also get a share of that member's chat and voice XP, up to 25%, for as long as the member stays. Staff earn double on both. New accounts, own links and rejoins never pay. Each member gets a personal invite link from the Discord menu, with its own public page at `/join/their-name` that search engines can index (each public server gets `/join/server-name` for its own invite, which no member can claim and whose joins the server overview counts separately), and invites have their own leaderboard, staff bonus adjustments and a weekly task. Personal links and links a member makes in Discord both count; the panel's Invites tab and the welcome message show which one each new member used.
- **Welcomer** - Custom welcome messages and embeds.
- **Giveaways** - Entries, winner selection, role-based eligibility and an optional invite minimum.
- **AFK** - Members set a status; the bot warns anyone who mentions them.
- **Staff rating** - Members rate staff; approved ratings drive roles placed automatically above your staff roles.
- **Booster messages** - Thank Nitro boosters with configurable channels and templates.
- **Custom supporter roles** - Boosters pick their own role name and color, placed automatically above the Server Booster role so the color shows.
- **Feedback** - Collect suggestions through Discord flows.

### Safety & operations

- **Moderation** - Warn, time out, kick, ban and tempban from the panel or the staff menu, each logged as a numbered case that pings the member.
  - Remove one warning or clear them all; tempbans lift themselves.
  - The panel lists every member with checkboxes: tick any of them and warn, time out, kick, ban or change roles in one go. Tabs show who is warned, timed out or banned, and each member opens to their full record.
  - Auto-escalation turns a warning count into a timeout, kick or ban; warnings can expire after a set number of days, and reasons come from saved presets and stay editable.
  - Bans, kicks and timeouts done directly in Discord are recorded too.
- **Channel notifications** - Alerts for important channel activity.
- **Message forwarder** - Pull messages out of servers the operator has linked, into your own channels. Filter by keyword, matched against embeds too. Forwarders are independent, so a catch-all and a filtered one can both take the same message. Available sources are listed at `/forwarder-servers`.

### Integrations

- **Discord Quest notifier** - Quest activity, with optional per-server enrollment automation.
- **Roblox catalog watch** - Post embeds when catalog items change, for trading and UGC communities. Each member taps 🔔 Notify me on an item to be tagged when its price, resale price, stock or total supply moves.
- **Content creator / TikTok** - Creator applications and TikTok live digests tied to server channels.
- **Creator alerts** - Each member follows their own YouTube, Twitch and TikTok creators and is tagged on new videos, live streams and posts, from the Content Creator or Notifications menu.

### Advanced

- **Official bot (discord.js)** - Core automation, slash `/setup`, buttons and component interactions.
- **Webhook server** - Incoming hooks for selected automation paths.

---

## Tech stack

Versions match `package.json` at release (caret ranges; run `npm ls` for the exact tree).

| Area                 | Technologies                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language & framework | [TypeScript](https://www.typescriptlang.org/) 6.0, [SvelteKit](https://kit.svelte.dev/) 2.70, [Svelte](https://svelte.dev/) 5.55, [Vite](https://vitejs.dev/) 8.2, adapter-node 5.5                                             |
| Styling              | [Tailwind CSS](https://tailwindcss.com/) 4.2 with [DaisyUI](https://daisyui.com/) 5.7, Prettier 3.8 with Svelte and Tailwind plugins                                                                                            |
| Discord              | [discord.js](https://discord.js.org/) 14.26, discord-api-types 0.38                                                                                                                                                             |
| AI chat              | [openai](https://www.npmjs.com/package/openai) 7.1 SDK against any OpenAI-compatible endpoint, set per bot in the panel                                                                                                         |
| Voice AI             | [@google/genai](https://www.npmjs.com/package/@google/genai) 2.15 (Gemini Live API), @discordjs/voice 0.19, @discordjs/opus 0.10, sodium-native 5.1, prism-media 1.3, ffmpeg, onnxruntime-node 1.27 for the on-device wake word |
| AI tools             | Native `fetch` to `/search`, `/web/fetch` and `/images/generations` on any OpenAI-compatible gateway; [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page) with cheerio 1.2                                     |
| Data                 | [MySQL](https://www.mysql.com/) via mysql2 3.22, [Drizzle ORM](https://orm.drizzle.team/) 0.45 and Drizzle Kit 0.31                                                                                                             |
| Cache & sessions     | [Redis](https://redis.io/) 5.12 for sessions, voice coordination and AI chat memory; optional, with an in-process fallback                                                                                                      |
| Everything else      | axios 1.19, bcryptjs 3.0, Luxon 3.7, Nodemailer 9.0, rozod 6.6, tiktok-live-connector 2.1, dotenv 17.4, OpenTelemetry 1.9                                                                                                       |

---

## Configuration

- Copy **`.env.example`** to **`.env`** and set the database, session, captcha, mail, Redis and bot token values.
- **Uploads** are written to local disk by default. Set `S3_BUCKET` and both S3 keys to store them in an S3 or R2 bucket instead — add `S3_ENDPOINT` for R2, or set `S3_REGION` to the bucket's region on AWS. Images are still served through the app, so the bucket stays private.
- Enable the **Server Members** and **Message Content** privileged intents in the Discord Developer Portal, or the bot will not start.
- **AI, voice and the tools** are configured in the panel, not `.env`. Each needs its URL, model and key before it switches on, so a half-filled section is inactive rather than broken. Keys are stored per bot and never sent back to the browser. Restart the bot after changing them.
- **Voice** needs AI chat enabled first, plus its own Google AI key and voice model, plus Redis.
- **Wikis** live on the bot's **Wikis** tab. Add an `api.php` endpoint, press Test, done — no restart. If a wiki refuses your server (Miraheze sits behind a Cloudflare check that rejects most datacenter IPs), copy [`scripts/relay.php`](scripts/relay.php) to hosting it does accept, replace `RELAY_KEY` with a long random string, and fill in **Relay URL** and **Relay key** for that wiki.

## Contributing

Issues and pull requests are welcome — a typo fix in the panel copy counts. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and the project layout, and the [Code of Conduct](CODE_OF_CONDUCT.md).

Questions, ideas or just want to see it running? **[Join the Discord](https://discord.gg/7fEqEDSur3)**.

## Security

Found a vulnerability? Email **security@dansday.dev** instead of opening an issue. See [SECURITY.md](SECURITY.md).

---

<div align="center">

**[Live demo](https://dansday.dev)** · **[Docs](https://dansday.dev/docs)** · **[Discord](https://discord.gg/7fEqEDSur3)**

AGPL-3.0 · Author: Akbar Yudhanto · Version: 26.8.0

</div>
