# &lt;/DANSDAY&gt; Discord Bot

Run leveling, moderation, an embed builder, Discord Quests, quest enroll, self-bot options, creator tools, live public statistics pages, Roblox catalog alerts, and more from the free web panel in your browser. Configure in one place instead of flooding channels with slash commands. Free for everyone. Self-host from GitHub or add our hosted bot if you do not run your own servers.

The project is open source under the MIT license.

---

## Features

### Web control panel

- **Granular permissions** - Control who can change which settings. Owners and staff tiers let helpers contribute without full control of the server or bot.
- **Server accounts** - Invite owners and staff into the panel with roles separate from ordinary Discord chat/moderation permissions.
- **Per-module toggles** - Enable or disable major features per server so you only run what you need.
- **Multi-language UI (Discord flows)** - English and Indonesian strings for buttons, selects, and labels, with room to grow.
- **Embed builder** - Design rich embeds with live preview, placeholders, and images; send to channels from the browser.

### Community & engagement

- **Items & XP economy** ⭐ _new_ - Spend earned XP in a per-server shop on PvP and utility items, each with a configurable cost, effect, and optional timed/recurring availability. Members keep purchases in a bag (capacity 50) and use them through Discord flows; outcomes are announced in the progress channel. Effects:
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
  - 🍀 **Luck** - a configurable % boost for a set duration that raises the top end of your steal and bomb rolls and improves your minigame odds, spy success, leech skim, friend boost, and insurance refund, cuts your gift tax, and discounts every shop price while active. Timed buffs lock in your luck when you activate them, so activate luck first.
- **Assets market (XP paper-trading)** ⭐ _new_ - Members invest earned XP in real-world crypto at live prices (via CoinGecko). XP is locked into a position and tracks the real market; sell any time to realize gains or losses. Search thousands of coins, browse the top 50, gainers and losers, and watch a live portfolio with per-position and total profit/loss. No real money and no real coins — purely an XP game. Designed to extend to other asset types later.
- **Minigames** ⭐ _new_ - Enabled as a sub-toggle under Public statistics (with its own channel), where members wager XP on games — no items or tickets, free to play. The first game is 🎲 **Gamble**: pick your own multiplier up to 10× and the win chance is set fairly from it (100 ÷ multiplier, so 2× = 50%, 4× = 25%). You can only wager XP earned above your current level, so a loss never drops your level. Wins and losses post to the minigames channel and feed a dedicated Minigames leaderboard. Built to add more games over time.
- **Tasks, streaks & check-in** ⭐ _new_ - Enabled as the Daily tasks sub-toggle under Public statistics, adding a Task tab to the member account. No admin setup at all — goals, difficulty and rewards are generated per member.
  - ☀️ **Daily tasks** - 9 tasks a day (3 easy, 3 medium, 3 hard), drawn from a catalog of 90 goals built on activity you already track: messages, reactions, voice / video / streaming / AFK minutes, XP earned by source, gambling, steals, bombs, leeches, spying, item buys and uses, specific-item goals, asset trades, and social ones like grinding voice with friends or staying un-leeched. No two members get the same list.
  - 📅 **Weekly tasks** - 9 hard tasks per week, sized against a 7-day activity window so goals and rewards scale up with the longer period. Weeks start Monday on the member's local clock.
  - 🎯 **Goals sized to the member** - Targets come from that member's own last 7 days of activity for the exact metric the task measures, not their level — someone who gambles twice a day gets a 1–3 round goal where a heavy player gets 14–50. Goals are also capped by what is physically possible in the period (bag size, item cooldowns and durations, other members present), and a task never appears for a feature the server has turned off.
  - ⚖️ **Honest difficulty** - The Easy / Medium / Hard label is measured, not assigned by rank: every goal is priced as real effort (XP spent plus the time each repetition costs) and graded against the server's earn rate, so a 38-item discard can never be labelled Easy. Slots draw only from tasks that can genuinely reach their band. Events other players inflict on you — being robbed, bombed or leeched, bounty payouts — stay at small goals unless your own history shows they actually happen.
  - 🎁 **Rewards** - XP or a shop item, with a 30% item chance per task; the item drawn is priced from 0.85× up to the task's XP value. Tasks that cost XP to complete (buying or using items, gambling, gifting) always pay back more than they cost. Rewards run from 1,000 XP up to a ceiling set by the priciest item in the shop.
  - 🔥 **Streaks** - Clear all 9 daily tasks to extend a streak, worth +2% reward XP per day up to +100%. Milestones at 7, 30, 100 and 365 days are announced in the items channel. Two ❄️ **freezes** cover missed days automatically, and members earn one back every 10 daily claims.
  - 📆 **Daily check-in** - A 7-day claim cycle in the Task tab, one claim per local day, scaled to 25% of the member's average daily XP earnings. Day 7 is a jackpot (25× weighted, 25,000 XP minimum) and every day has a 50% chance of drawing a rarity-weighted item instead of XP. Miss a day and the cycle restarts at day 1.
  - 🧾 **Reward history** - Task and daily check-in payouts are recorded: XP lands in level history as **Task Reward** / **Daily Reward**, items in item history. Reward XP is deliberately excluded from the activity totals that size future goals, so claiming a reward never inflates your own targets.
- **Leveling & XP** - Message and voice activity feed a full XP system with levels, role rewards, and leaderboards. Reactions are tracked too, feeding the task system.
- **Welcomer** - Custom welcome messages and embeds for new members.
- **Giveaways** - Entries, winner selection, and role-based eligibility.
- **AFK** - Members set AFK status and custom messages; the bot warns when someone is mentioned while away.
- **Feedback** - Collect and organize suggestions and feedback through Discord-facing flows.
- **Staff rating** - Structured staff evaluation tied to your moderation workflow.
- **Booster messages** - Thank Nitro boosters with configurable channels and templates (separate from custom supporter roles).
- **Custom supporter roles** - Let supporters personalize role name and color within rules you set.

### Safety & operations

- **Moderation** - Warnings, mutes, bans, and staff actions coordinated from the panel.
- **Channel notifications** - Alerts for important channel activity.
- **Message forwarder** - Mirror or sync messages across channels (and related self-bot paths where configured).

### Integrations & alerts

- **Discord Quest notifier** - Surface Discord Quest activity in your server; optional quest enrollment automation tuned per server.
- **Roblox catalog watch** - Post embeds when catalog items change, aimed at trading and UGC communities.
- **Content creator / TikTok** - Creator applications and TikTok live session digests tied to server channels.

### Public web pages

- **Public statistics** - The master switch for all public pages: server statistics, leaderboard, members, and the per-member account (Overview, History, Guide). Items, Minigames, Assets and Daily tasks are enabled as sub-toggles here — turn public statistics off and everything public goes dark; with the four sub-features off, the account still shows Overview and History.

### Advanced

- **Official bot (discord.js)** - Core automation, slash `/setup`, buttons, and component interactions.
- **Optional self-bot path** - Panel-managed tokens and user-context features where supported (e.g. forwarder and quest flows); use in line with Discord’s terms and your own risk assessment.
- **Webhook server** - Incoming hooks for selected automation paths (see codebase for endpoints).

---

## Tech stack

Versions match `package.json` at release (caret ranges; run `npm ls` for the exact tree).

| Area                       | Technologies                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language                   | [TypeScript](https://www.typescriptlang.org/) 5.9                                                                                                                                                                        |
| App framework              | [SvelteKit](https://kit.svelte.dev/) 2.50, [Svelte](https://svelte.dev/) 5.54                                                                                                                                            |
| Build & dev                | [Vite](https://vitejs.dev/) 8.0, [`@sveltejs/vite-plugin-svelte`](https://github.com/sveltejs/vite-plugin-svelte) 7.0, [svelte-check](https://www.npmjs.com/package/svelte-check) 4.4                                    |
| SSR / hosting              | [`@sveltejs/adapter-node`](https://svelte.dev/docs/kit/adapters#@sveltejs/adapter-node) 5.5 (Node server)                                                                                                                |
| Styling                    | [Tailwind CSS](https://tailwindcss.com/) 4.2 ([`@tailwindcss/vite`](https://tailwindcss.com/docs/installation/framework-guides/sveltekit) 4.2)                                                                           |
| Formatting (dev)           | [Prettier](https://prettier.io/) 3.8 + Svelte / Tailwind plugins                                                                                                                                                         |
| Official bot               | [discord.js](https://discord.js.org/) 14.26, [discord-api-types](https://www.npmjs.com/package/discord-api-types) 0.38                                                                                                   |
| User-token path (optional) | [discord.js-selfbot-v13](https://www.npmjs.com/package/discord.js-selfbot-v13) 3.7                                                                                                                                       |
| HTTP client                | [axios](https://axios-http.com/) 1.14                                                                                                                                                                                    |
| Roblox catalog API         | [rozod](https://www.npmjs.com/package/rozod) 6.6 (typed catalog fetch alongside axios thumbnails)                                                                                                                        |
| Database                   | [MySQL](https://www.mysql.com/) via [mysql2](https://github.com/sidorares/node-mysql2) 3.20, [Drizzle ORM](https://orm.drizzle.team/) 0.45 + [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) 0.31 (migrations) |
| Password hashing           | [bcryptjs](https://www.npmjs.com/package/bcryptjs) 3.0                                                                                                                                                                   |
| Dates & time               | [Luxon](https://moment.github.io/luxon/) 3.7                                                                                                                                                                             |
| Cache / sessions           | [Redis](https://redis.io/) client ([`redis`](https://www.npmjs.com/package/redis) 5.11 for Node), optional by configuration                                                                                              |
| Email                      | [Nodemailer](https://nodemailer.com/) 8.0, optional                                                                                                                                                                      |
| Proxies                    | [proxy-agent](https://www.npmjs.com/package/proxy-agent) 8.0 (where outbound HTTP uses a proxy)                                                                                                                          |
| Observability              | [OpenTelemetry](https://opentelemetry.io/) `@opentelemetry/api` 1.9, logs SDK & auto-instrumentations 0.214, OTLP HTTP log exporter (optional)                                                                           |
| Integrations               | [TikTok Live Connector](https://www.npmjs.com/package/tiktok-live-connector) 2.1 (creator / live flows)                                                                                                                  |
| Config                     | [dotenv](https://www.npmjs.com/package/dotenv) 17.3                                                                                                                                                                      |

---

## Configuration

Environment variables drive database credentials, sessions, captcha, mail, Redis, and bot tokens. Copy **`.env.example`** to **`.env`** and adjust for your deployment.

The official bot requests the Guilds, Message Content, Server Members, Moderation, Voice States and Message Reactions gateway intents. **Server Members** and **Message Content** are privileged — enable both on your application in the Discord Developer Portal or the bot will fail to start.

---

## License

MIT · Author: Akbar Yudhanto · Version: 26.4.1
