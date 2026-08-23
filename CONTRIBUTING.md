# Contributing

Thanks for taking the time to help. This project is a SvelteKit panel plus the Discord bot processes it spawns, and contributions of every size are welcome — a typo fix in the panel copy counts.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are accepted under the [MIT License](LICENSE).

## Before you start

- **Security issues do not belong in issues or pull requests.** Email **security@dansday.com** — see [SECURITY.md](SECURITY.md).
- Open an issue first for anything that adds a module, changes the database schema, or reshapes a panel tab. A short discussion beats a rejected branch.
- Small, obvious fixes (typos, broken links, a wrong label) can go straight to a pull request.

## Local setup

You need Node.js 25 (the version the Docker images pin), MySQL and — for voice, sessions and AI chat memory — Redis. Docker Compose covers all three.

```bash
git clone https://github.com/dansday-com/dansday-discord-bot.git
cd dansday-discord-bot
npm install
cp .env.example .env   # fill in database, session, captcha, mail and Redis values
npm run dev            # panel on http://localhost:5173
```

Or run the whole stack in containers:

```bash
make up        # build and start
make logs      # follow output
make down      # stop
```

Enable the **Server Members** and **Message Content** privileged intents in the Discord Developer Portal, or the bot will not start. AI, voice, tools and wikis are configured per bot in the panel, not in `.env`.

## Project layout

| Path                       | What lives there                                                              |
| -------------------------- | ----------------------------------------------------------------------------- |
| `src/routes`               | Panel pages, public server pages and API routes                               |
| `src/lib/frontend`         | Shared Svelte components, stores and panel helpers                            |
| `src/lib/backend`          | Bot runtime — gateway handlers, modules, tasks, AI and voice                  |
| `.../official-bot/locales` | `en.json` and `id.json`, the bot's message translations                       |
| `src/lib/schema.ts`        | Drizzle schema; `src/lib/migrations` holds the migrations                     |
| `bots/`                    | Build output only — `tsc -p tsconfig.bots.json` compiles `src/lib` to JS here |
| `static`                   | Icons, images and other assets served as-is                                   |

Never edit `bots/` by hand. It is generated and gitignored; change the TypeScript in `src/lib` instead. Bot processes are spawned with their working directory set to the bot directory, so resolve asset paths from the module, not from `process.cwd()`.

## Making a change

1. Branch off `master`: `git checkout -b my-change`.
2. Keep the change focused. One concern per pull request.
3. Match the surrounding code — same naming, same idiom, same structure. The codebase avoids inline comments; make the code and the UI copy explain themselves.
4. Touching bot-facing strings? Update **both** locale files — `src/lib/backend/bots/official-bot/locales/en.json` and `id.json` — so no key is left orphaned, and delete the keys for any feature you remove.
5. Changing the schema? Add a migration under `src/lib/migrations` rather than editing an existing one.
6. Format and verify before pushing:

```bash
npm run build:format   # prettier --write then --check
npm run build:sync     # svelte-kit sync
npm run build          # production build
npx svelte-check       # type and Svelte diagnostics
```

7. Run the panel and click through the parts you changed. Screenshots help a lot on UI work.

## Commit messages

Short, imperative subject describing the effect — `Fix voice reconnect after gateway resume`, not `changes`. Reference an issue with `Fixes #123` when one exists.

## Pull requests

Open it against `master` and include:

- What changed and why, in a couple of sentences.
- How you tested it, including anything you could not test.
- Screenshots or a short clip for panel and embed changes.
- A note if it needs a migration, a new `.env` key, or a bot restart to take effect.

Draft pull requests are fine for work in progress. Expect review comments — they are about the code, not about you.

## Reporting bugs

Include the version from `package.json`, whether you are on the hosted bot or self-hosting, the steps to reproduce, what you expected, what happened, and any relevant panel or bot log output. Redact tokens, keys and database credentials.

## Feature requests

Describe the problem before the solution: what you are trying to do in your server, why the current modules do not cover it, and how you imagine it appearing in the panel.
