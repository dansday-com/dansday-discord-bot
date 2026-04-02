/**
 * $lib layout:
 *
 * - **Root** — `database.ts`, `drizzle.ts`, `schema.*`, `migrations/`, `redis.ts`, `botProcesses.ts`, `leaderboard/`.
 *
 * - **`utils/`** — Shared helpers (`datetime`, `sanitize`, `discordChannels`, `slug`, `rateLimit`, `session`,
 *   `logger`, …). **Import only from the barrel** `$lib/utils/index.js` (or `./utils/index.js` under `src/lib`;
 *   bots: `…/utils/index.js` relative to `src/lib`). Rename or split implementation files freely; update
 *   `utils/index.ts` re-exports only.
 *
 * - **frontend/** — Svelte UI, toasts, redirects, panel email.
 *
 * - **backend/** — Discord runtime only: `config.ts`, `bots/**` (official bot UI strings: `bots/official-bot/i18n.ts` + `official-bot/locales/`).
 */
