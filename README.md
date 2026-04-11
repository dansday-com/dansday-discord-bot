# Dansday Discord Bot

**Dansday** is an all-in-one Discord server management platform: a modern web control panel plus an official bot (and optional self-bot workflows) so you configure automation, moderation, and integrations in one place instead of scattering slash commands across channels.

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

| Area             | Technologies                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| App & UI         | [SvelteKit](https://kit.svelte.dev/), [Svelte 5](https://svelte.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/) |
| Bots             | [discord.js](https://discord.js.org/) v14, [discord.js-selfbot-v13](https://www.npmjs.com/package/discord.js-selfbot-v13) (optional)         |
| Data             | [MySQL](https://www.mysql.com/) via [mysql2](https://github.com/sidorares/node-mysql2), [Drizzle ORM](https://orm.drizzle.team/)             |
| Cache / sessions | [Redis](https://redis.io/) (optional)                                                                                                        |
| Email            | [Nodemailer](https://nodemailer.com/) (optional)                                                                                             |
| Observability    | [OpenTelemetry](https://opentelemetry.io/) (optional OTLP log export)                                                                        |
| Runtime          | Node.js 22                                                                                                                                   |

---

## Configuration

Environment variables drive database credentials, sessions, captcha, mail, Redis, and bot tokens. Copy **`.env.example`** to **`.env`** and adjust for your deployment.

---

## License

MIT · Author: Akbar Yudhanto · Version: 8.1.0
