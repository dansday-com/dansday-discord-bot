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
- **Assets market (XP paper-trading)** ⭐ _new_ - Members invest earned XP in real-world crypto at live prices (via CoinGecko). XP is locked into a position and tracks the real market; sell any time to realize gains or losses. Search thousands of coins, browse the top 50, gainers and losers, and watch a live portfolio with per-position and total profit/loss. No real money and no real coins — purely an XP game. Designed to extend to other asset types later.
- **Minigames** ⭐ _new_ - Enabled as a sub-toggle under Public statistics (with its own channel), where members wager XP on games — no items or tickets, free to play. The first game is 🎲 **Gamble**: pick your own multiplier up to 10× and the win chance is set fairly from it (100 ÷ multiplier, so 2× = 50%, 4× = 25%). You can only wager XP earned above your current level, so a loss never drops your level. Wins and losses post to the minigames channel and feed a dedicated Minigames leaderboard. Built to add more games over time.
- **Leveling & XP** - Message and voice activity feed a full XP system with levels, role rewards, and leaderboards.
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

- **Public statistics** - The master switch for all public pages: server statistics, leaderboard, members, and the per-member account (Overview, History, Guide). Items, Minigames and Assets are enabled as sub-toggles here — turn public statistics off and everything public goes dark; with the three sub-features off, the account still shows Overview and History.

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

---

## License

MIT · Author: Akbar Yudhanto · Version: 26.3.0
