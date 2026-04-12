# Dansday Discord Bot

Run leveling, moderation, an embed builder, Discord Quests, quest enroll, self-bot options, creator tools, live public statistics pages, Roblox catalog alerts, and more from the free web panel in your browser. Configure in one place instead of flooding channels with slash commands. Free for everyone. Self-host from GitHub or add our hosted bot if you do not run your own servers.

The project is open source under the MIT license.

---

## Features

### Web control panel

- **Granular permissions** — Control who can change which settings. Owners and staff tiers let helpers contribute without full control of the server or bot.
- **Server accounts** — Invite owners and staff into the panel with roles separate from ordinary Discord chat/moderation permissions.
- **Per-module toggles** — Enable or disable major features per server so you only run what you need.
- **Multi-language UI (Discord flows)** — English and Indonesian strings for buttons, selects, and labels, with room to grow.
- **Embed builder** — Design rich embeds with live preview, placeholders, and images; send to channels from the browser.

### Community & engagement

- **Leveling & XP** — Message and voice activity feed a full XP system with levels, role rewards, and leaderboards.
- **Welcomer** — Custom welcome messages and embeds for new members.
- **Giveaways** — Entries, winner selection, and role-based eligibility.
- **AFK** — Members set AFK status and custom messages; the bot warns when someone is mentioned while away.
- **Feedback** — Collect and organize suggestions and feedback through Discord-facing flows.
- **Staff rating** — Structured staff evaluation tied to your moderation workflow.
- **Booster messages** — Thank Nitro boosters with configurable channels and templates (separate from custom supporter roles).
- **Custom supporter roles** — Let supporters personalize role name and color within rules you set.

### Safety & operations

- **Moderation** — Warnings, mutes, bans, and staff actions coordinated from the panel.
- **Channel notifications** — Alerts for important channel activity.
- **Message forwarder** — Mirror or sync messages across channels (and related self-bot paths where configured).

### Integrations & alerts

- **Discord Quest notifier** — Surface Discord Quest activity in your server; optional quest enrollment automation tuned per server.
- **Roblox catalog watch** — Post embeds when catalog items change — aimed at trading and UGC communities.
- **Content creator / TikTok** — Creator applications and TikTok live session digests tied to server channels.

### Public web pages

- **Public statistics** — Shareable pages with member insights, leaderboards, and live-oriented views for your community.

### Advanced

- **Official bot (discord.js)** — Core automation, slash `/setup`, buttons, and component interactions.
- **Optional self-bot path** — Panel-managed tokens and user-context features where supported (e.g. forwarder and quest flows); use in line with Discord’s terms and your own risk assessment.
- **Webhook server** — Incoming hooks for selected automation paths (see codebase for endpoints).

---

## Tech stack

Versions below match **`package.json`** / **`package-lock.json`** (semver ranges). The **Dockerfile** builds and runs on **Node 25** (Alpine); there is no `engines` field, so use a recent Node that matches your deploy (Docker, or Node 20+ for local dev if you prefer LTS).

| Area                       | Technologies                                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language                   | [TypeScript](https://www.typescriptlang.org/) 5                                                                                                                                                           |
| App framework              | [SvelteKit](https://kit.svelte.dev/) 2, [Svelte](https://svelte.dev/) 5                                                                                                                                   |
| Build & dev                | [Vite](https://vitejs.dev/) 8, [`@sveltejs/vite-plugin-svelte`](https://github.com/sveltejs/vite-plugin-svelte) 7                                                                                         |
| SSR / hosting              | [`@sveltejs/adapter-node`](https://svelte.dev/docs/kit/adapters#@sveltejs/adapter-node) (Node server)                                                                                                     |
| Styling                    | [Tailwind CSS](https://tailwindcss.com/) 4 ([`@tailwindcss/vite`](https://tailwindcss.com/docs/installation/framework-guides/sveltekit))                                                                  |
| Formatting (dev)           | [Prettier](https://prettier.io/) 3 + Svelte / Tailwind plugins                                                                                                                                            |
| Official bot               | [discord.js](https://discord.js.org/) 14, [discord-api-types](https://www.npmjs.com/package/discord-api-types)                                                                                            |
| User-token path (optional) | [discord.js-selfbot-v13](https://www.npmjs.com/package/discord.js-selfbot-v13)                                                                                                                            |
| HTTP client                | [axios](https://axios-http.com/)                                                                                                                                                                          |
| Database                   | [MySQL](https://www.mysql.com/) via [mysql2](https://github.com/sidorares/node-mysql2), [Drizzle ORM](https://orm.drizzle.team/) + [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) (migrations) |
| Password hashing           | [bcryptjs](https://www.npmjs.com/package/bcryptjs)                                                                                                                                                        |
| Dates & time               | [Luxon](https://moment.github.io/luxon/)                                                                                                                                                                  |
| Cache / sessions           | [Redis](https://redis.io/) client ([`redis`](https://www.npmjs.com/package/redis) for Node) — optional by configuration                                                                                   |
| Email                      | [Nodemailer](https://nodemailer.com/) — optional                                                                                                                                                          |
| Proxies                    | [proxy-agent](https://www.npmjs.com/package/proxy-agent) (where outbound HTTP uses a proxy)                                                                                                               |
| Observability              | [OpenTelemetry](https://opentelemetry.io/) — API, SDK logs, auto-instrumentations, OTLP HTTP log exporter (optional)                                                                                      |
| Integrations               | [TikTok Live Connector](https://www.npmjs.com/package/tiktok-live-connector) (creator / live flows)                                                                                                       |
| Config                     | [dotenv](https://www.npmjs.com/package/dotenv)                                                                                                                                                            |

---

## Configuration

Environment variables drive database credentials, sessions, captcha, mail, Redis, and bot tokens. Copy **`.env.example`** to **`.env`** and adjust for your deployment.

---

## License

MIT · Author: Akbar Yudhanto · Version: 8.1.1
