## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>" --undirected` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- The graph is built undirected, so `graphify path` without `--undirected` reports "no directed path found" even when the two nodes are connected.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- A post-commit git hook rebuilds the graph on every commit, so the graph is current as of the last commit. Run `graphify update .` only to pick up uncommitted edits (AST-only, no API cost).
- `.svelte` files log "syntax errors" during extraction — expected, not breakage: tree-sitter parses the JS grammar and cannot read the markup layer, so a regex fallback rescues the imports. Symbol-level detail inside components is thinner than for plain `.ts`.

## Code practices

These rules are mandatory for every change. They include all 50 rules of [TypeScript Best Practices](https://github.com/andredesousa/typescript-best-practices) by andredesousa, adapted to this codebase, so there is no need to open the source. `(#n)` is the rule's number in the source's table of contents. Where this file and the source differ, this file wins. **Lint** marks a rule `npm run build:lint` enforces; the others are checked in review and are just as binding.

### Gates

- `npm run build:lint` must pass. It is the required `Lint` check on `master` (`.github/workflows/lint.yml` plus the `Lint` ruleset), so a pull request with lint errors cannot merge. Never add an `eslint-disable` comment, and never add a file to an exemption (`numericDataModules` or the `src/lib/frontend/fx/**` override in `eslint.config.js`) to get around a rule. (#1)
- Run `npm run build:format` after every edit. Prettier rewrites files on disk, so skipping it makes the next exact-string edit fail against reformatted source. The conventions are `.prettierrc` (tabs, single quotes, no trailing commas, 160 columns) plus `eslint.config.js`; where neither decides, match the surrounding code. (#1)
- New logic in `src/lib` gets a test: `tests/<module>.test.ts` using `node:test` and `node:assert/strict`, importing from `../src/lib/<module>.ts`. `npm run build:test` must pass before you finish. (#2)
- `tsconfig.json` keeps `strict`, `noImplicitReturns`, `noUnusedLocals`, `noFallthroughCasesInSwitch` and `forceConsistentCasingInFileNames` on. Never loosen them. (#3)

### Types

- No `any` (**Lint**). Annotate what TypeScript cannot infer. A value from outside is `unknown` until narrowed. (#4)
- A string with a fixed set of values is a union type. When the values are also needed at runtime, derive the type from an `as const` list: `type EffectFamily = (typeof EFFECT_FAMILIES)[number]`. (#5)
- Derive types instead of restating shapes: `Partial`, `Pick`, `Omit`, `Readonly`, `Record`, `ReturnType`, Drizzle's `$inferSelect`. Split a type only where the domain splits. (#7)

### Naming

- A name says what a thing means, not its value or how it is computed: `isLegalAge`, not `isOverEighteen`; `REASON_MAX_LENGTH`, not `TWO_HUNDRED`. English, no cryptic abbreviations, no sentence-long names. (#6)
- Booleans start with `is`/`has`/`are`/`can`/`should`/`did`/`was`/`will`/`does` (**Lint**). (#26)

### Functions

- At most three parameters; pass an object for more (**Lint**). (#15)
- Nest at most four blocks deep (**Lint**). Return early rather than wrapping the rest in `else`. (#13)
- Under 80 lines (**Lint**). 80 is the cap, not the target: a function does one job, and a function with distinct steps becomes a function per step. Split by responsibility, not by line count. (#14)
- No boolean flag parameters. A boolean that changes what a function does means two functions. (#16)
- Optional parameters take default values and come last (**Lint**). (#22)
- Keep logic pure: compute from inputs and return a value. Database, Discord API, Redis, file and network calls sit in a thin outer layer that calls the pure functions, which is also what makes them testable. (#30, #32)

### Variables and syntax

- `const` by default, `let` only when reassigned, never `var` (**Lint**). (#8)
- `===` and `!==` (**Lint**). `== null` is the one allowed loose comparison, for null-or-undefined. (#9)
- Literals, never constructors: `{}`, `[]`, `''`, regex literals; no `new Object`, `new Array`, `new String`, `new Number`, `new Boolean` or `new Function` (**Lint**). (#10)
- Every `if`, `else`, `for` and `while` body has braces, one-liners included (**Lint**). (#21)
- Spread, rest and object destructuring instead of `apply`, `arguments`, `Object.assign` and `const name = user.name` (**Lint**). (#23)
- Template literals, never `+` concatenation (**Lint**). (#24)
- File order: imports, then module constants and types, then functions. Inside a function, declare what it works with before the logic that uses it. (#27)
- Initialise every variable where it is declared (**Lint**). (#28)
- None of the language's traps: `eval`, string `setTimeout`/`setInterval`, `new Function`, `void`, `with`, `__proto__`, `arguments.caller`, `javascript:` URLs, extending built-in prototypes, chained assignment, or writing to an array's `length` (use `splice`) (**Lint**). (#37)

### Control flow

- Every `switch` ends with a `default` (**Lint**). (#25)
- An `if`/`switch` chain keyed on a kind becomes a lookup table, as `PROGRAMS`, `READY` and `EFFECTS` are, so adding a kind is one entry rather than another branch. No `else` after `return`, and no lone `if` inside an `else` (**Lint**). (#34)

### Data

- Array methods (`map`, `filter`, `reduce`, `find`, `some`, `flatMap`) chained without intermediate variables by default. An indexed `for` loop only where speed is measured to matter: per-frame canvas code in `src/lib/frontend/fx/` and large server-side batches. (#18, #19)
- Data that arrives in pages or as a stream (paged Discord or platform APIs, database batches) is exposed as a generator or async generator and consumed with `for...of` or `for await...of`. (#29)
- Never reassign or mutate a parameter (**Lint**). Return a new object or array built with spread, and mark tables `as const` or `readonly`. (#31)
- Trust no input. Request bodies, URL and query params, form data, Discord interaction and modal values, and external API responses stay `unknown` until validated and narrowed; `normalizeEffect` in `effects.ts` is the pattern. Check permission on the server for every action: hiding a control in the panel or the bot is not a check. (#20)

### Errors and async

- Throw and reject only `Error` instances (**Lint**), and no `catch` that only rethrows (**Lint**). Member-facing failures go through `errorReason` (see Discord UI). (#35)
- `async`/`await` instead of callbacks and `.then` chains. Wrap a callback API in a promise once, in a helper. (#36)

### Numbers and constants

- No magic numbers (**Lint**; `-1`, `0`, `1` and `2` are allowed). Use a shared constant first: `utils/time.ts` (`SECOND_MS`, `MINUTE_MS`, `DAY_MS`, `formatElapsed`), `http.ts` (`HTTP.NOT_FOUND`, `isHttpSuccess`), `discordLimits.ts` (`DISCORD_LIMITS`, `truncateToLimit`, `embedFieldText`), `utils/numbers.ts` (`PERCENT`, `HEX_RADIX`, `roundTo`, `QUARTER_PERCENTS`). Otherwise add a module-level constant named for what the number means (`REASON_MAX_LENGTH`), never for its value. Data tables are objects (`{ amount: 6, unit: 'hour' }`) or generated lists, not bare tuples. Only the modules in `numericDataModules` in `eslint.config.js` are exempt. (#33)
- Prefer library constants to raw values: discord.js `MessageFlags.Ephemeral`, `RESTJSONErrorCodes`, `ChannelType`, and `svelte/easing`.

### Comments

- The codebase has no comments, and new code adds none: no explanations, no TODOs, no commented-out code. If code seems to need a comment, rename or split it until it doesn't. Delete dead code; git keeps the history. Before finishing, check your diff for added `//` and `/*` comments. (#17, stricter than the source)

### Modules and reuse

- Reuse before writing. Check `src/lib/utils/` (time, numbers, format, rgb, random, datetime, mentions, discordChannels, guildSyncDebounce), `discordAvatars.ts`, `accounts.ts`, `frontend/eventStream.server.ts`, `frontend/toast.svelte.ts` (`TOAST_MS`) and `components/public/reel.ts` for an existing helper. When logic or a constant would exist twice, move it to a shared module instead of copying it. (#45)
- No globals: no implicit globals (**Lint**) and no writes to `window` or `globalThis`. State lives in a module and is exported from it. (#11)
- No unused imports, variables or functions (**Lint**), and one import statement per module, with type imports allowed separately (**Lint**). (#44)
- Don't add a dependency for what the platform (`Intl`, array methods, `structuredClone`) or an existing dependency already does. (#43)
- Bot code (`src/lib/backend/bots/**` and everything it imports) uses relative imports, because the bot build has no `$lib` alias. Panel code uses `$lib/`.

### Configuration and translation

- Member-facing text is never hard-coded; it goes through the locale files in all 12 languages (see Discord UI). Per-server behaviour is a setting in the bot configuration panel, per-environment values are env variables listed in `.env.example`, and tunable values are named constants at the top of their module. (#41)

### Frontend and performance

- Each concern stays in its layer: data loading and mutations in `+page.server.ts`, `+layout.server.ts` and `+server.ts`; markup in `.svelte`; styling as Tailwind/DaisyUI classes and the stylesheets below. Inline `style` only carries values computed at runtime. (#12)
- Build on web standards. Feature-detect, never sniff the user agent, and add vendor prefixes only where a supported browser needs them (the iOS rules under Theme effects). (#38)
- Leave script loading to SvelteKit. Don't add `<script>` tags to `app.html` or `<svelte:head>`; a third-party script that has to be there gets `defer` or `async`. (#39)
- Let Svelte own the DOM. In a component, render elements in markup and reach them with `bind:this`, not `document.querySelector` or `createElement`. `document` is for what lies outside any component, such as a `<link>` in the head or an offscreen canvas. Canvas effects draw a whole frame per `requestAnimationFrame`. (#40)
- Pages work before JavaScript loads: navigation is an `<a href>`, forms are `<form>` elements, and `goto()` is only for navigating after an action completes (save, delete, sign-out). (#42)
- Load heavy modules where they are used with `await import()`, as `GlobeScene.svelte` does with `three` and `redis.ts` with `redis`. (#46)
- `adapter-node` precompresses assets with gzip and brotli by default; keep `precompress` on. (#47)
- `vite build` minifies the output; never disable minification or ship unbuilt sources. (#48)
- After a change to what a public page loads (homepage, server statistics, leaderboard, members), run Lighthouse on it and don't regress its scores. (#49)
- CPU-heavy work runs off the main thread: `worker_threads` in the bot, as `wakeWordWorker.ts` does, and a Web Worker in the browser. (#50)

## Discord UI

Every message, button, select and form the bot sends follows Discord's own developer guidance: the DevRel talk "Discord App Best Practices: UI/UX for Developers" and "Deep Dive: New Message Components". Apply these without being asked, and check existing screens against them when you touch a feature.

**Button colours carry meaning.** At most one Primary (blue) button per message, for its single most common action. Everything else is Secondary (grey), including navigation between equal choices such as the menu and its categories. Danger (red) only for actions that cannot be undone: delete, ban, ending a giveaway early, leaving the creator programme. Success (green) only for the positive half of a decision pair such as Approve/Reject. Link buttons for anything that leaves Discord.

**Pick the control from the kind of choice.** Yes/No in a form is a checkbox; in a message it is one toggle button whose label is the action ("Allow Multiple Entries"), with the current state shown as text beside it. Two to ten fixed choices are a radio group (forms only). Many items, or users, roles and channels, are a select menu; for "choose several" use a multi-select with the current picks as defaults. Images or files are a file upload. Never make someone type a value from a fixed set: durations are radio presets built with `durationField` in `interface/formFields.ts`, whose labels come from `Intl.NumberFormat` units in the member's language.

**Use the fewest steps.** Forms hold up to five labelled components, including string/user/role selects, radio groups, checkboxes and file uploads, so a chain of message screens that ends in a form usually belongs in one form. Staff rating is the reference. Filter the options before showing the form so a submit cannot fail on something already knowable (yourself, a staff member still on cooldown), and still re-check on submit.

**Show only what works here, on every screen.** A button appears only if clicking it can succeed for this member on this server right now: the feature is switched on and set up, and the member has the permission. `featureAvailable(guildId, feature)` in `interface/availability.ts` is the one check for "on and set up"; its `READY` map holds each feature's setup requirement (giveaway and feedback channels, notification channels, staff rating config plus staff roles, creator admission channel plus creator role). Add an entry when a feature gains one. The menu applies it through `availableMenuItems`, together with member permissions (Staff is staff-only, the supporter role needs supporter or creator). Hub screens apply it to each of their own buttons (Notifications, Content Creator). Audit every screen a feature can reach, not just the menu. A "turned off" or "not set up" reply should only ever be reached by a stale button.

**Personal screens show this member's data.** A list opened from a member's own menu (alert history, follows, quests) is filtered to what that member follows or owns, and to the alert types they chose. Recent creator alerts uses `listMemberCreatorContents` for this. Server-wide lists belong on the public pages. Hide a button whose screen would always be empty for this member, such as Recent when they follow no one.

**Disable or remove.** Disable a component that can become useful again; remove it once it never will (an ended giveaway, a decided review card).

**Keep public messages small.** A message in a channel carries one or two actions; everything else opens privately, as the channel panel's single Menu button opens an ephemeral menu.

**Errors say what happened and how to fix it.** Never put `error.message` in a member-facing string. Pass `await errorReason(error, guildId, userId)` from `i18n.ts`, or `errorReasonFor(tr, error)` when you hold a translator; it maps Discord API error codes to a localised cause and fix. Log the raw error separately. A fix only an admin can make says "ask a server admin … in the bot configuration panel". No path fails silently: permission denials and catch blocks reply too.

**Components V2 or classic embeds.** A message sent or edited with `IsComponentsV2` can never switch back, so every screen that edits it in place must be V2 as well. The menu is one ephemeral message that every feature screen edits, so the menu and those screens stay classic; never convert one screen of a flow on its own. V2 has no inline columns, so side-by-side stats need classic embed fields. If a whole flow is rebuilt in V2, build every screen natively in V2, as in Discord's Pokédex demo (list, then detail, then Back to the same page).

**Every new string ships in all 12 locale files.** Reuse each language's existing terms (its word for channel, panel, giveaway, and its form of "you"), and write line breaks as a literal `\n`, which `t()` in `localeStore.ts` expands.

## Stylesheets

- `src/theme.css` holds the Tailwind/DaisyUI theme and is imported by both entry stylesheets.
- `src/app.css` is the full app stylesheet, loaded by `src/routes/(app)/+layout.svelte`, `src/routes/server/[serverSlug]/account/+layout.svelte` and `src/routes/+error.svelte`.
- `src/home.css` is the homepage-only stylesheet, and `src/server.css` covers the public server pages (statistics, leaderboard, members). Each scans only the files in its `@source` lines, so a component newly rendered on one of those pages must be added there or its classes will be missing. `server.css`'s list is the import closure of those three pages.
- Both are under `inlineStyleThreshold` and ship inside the HTML.
- SvelteKit never unloads a stylesheet, and hover-preloading a link injects the destination's CSS into the current page, so a smaller sheet loaded after `app.css` overrides it (the homepage dropped to its mobile layout when a server link was hovered). `stylesheetOf()` in `src/routes/+layout.svelte` maps a URL to its stylesheet family. Links to another family get `data-sveltekit-reload` on pointer or focus, which disables preloading and forces a full load. `beforeNavigate` catches programmatic and back/forward navigation. A route that adopts a new stylesheet must be added to `stylesheetOf()`.

## Theme effects

Every member card effect renders through one `<canvas>` per card. Families are listed in `EFFECT_FAMILIES` (`src/lib/effects.ts`) and each maps to a program in `PROGRAMS` (`src/lib/frontend/fx/programs.ts`); the engine lives alongside it in `src/lib/frontend/fx/`, and `ThemeEffect.svelte` is just the host. There are no hand-drawn SVG paths and none should be added — if something needs a shape, generate it (recursive branches, seeded masks, noise), don't author path data.

**The current program is the baseline.** Read it before changing it, and don't regress it. When an effect looks wrong, work out what it is meant to be from the thing itself — which way sandstorm blows, whether sparkle moves — and never invent the behaviour.

**Simulate the mechanism, don't draw the appearance.** Fire is heat rising through a grid with random decay, so it looks like fire from any angle at any size. A CRT is a beam sweeping down and phosphor decaying behind it. A meteor is a rock that falls until it hits something. Start from what is physically happening and let the picture fall out of it; an effect assembled from shapes that merely resemble the subject will read as fake, and no amount of tuning fixes that.

**Everything must cause something.** Meteors stop at the ground and throw their own impact at that x. Cinders leave the crater the cone is drawn from. Flakes land on the drift they build. Leaves fall from the crowns of the trees that are drawn. A set of independent loops playing side by side is the signature of a low-effort effect — if nothing in the frame responds to anything else, it is not finished.

**Build in layers.** A subject alone, floating in empty space, always looks cheap. Most effects need a surface it happens on or over (ground, water, wall, cone, ridge), the subject itself, and atmosphere tying them together (haze, glow, cloud, dust, light spill). An effect with one layer is a first draft.

**Nothing is a bare pixel.** A single dot is not a heart, a leaf, a rock or a firefly. Give it real form — a pixel sprite, a glow with falloff, a streak with a tail, an irregular seeded mask — and make sure it still reads at a small card size, where one canvas pixel is about 2 CSS pixels.

**The card itself reacts.** `[data-fx-host='<family>']` in `src/lib/frontend/fx/fx.css` is part of the effect, not decoration: earthquake shakes the card, a black hole scales it inward, meteor kicks it on impact, eclipse darkens it. Every family should do something at the card level, and it must read at rest as well as mid-animation — a paused keyframe is what off-screen cards freeze at, so a `0%` frame that looks like no effect means the effect vanishes.

**Every effect must vary by seed** on at least three of `hue`, `dir`, `speed`, `drift`, `tilt`, plus seeded _structure_ — tree count and positions, crack sites, hole count, tube bends, moon phase, constellation. Every seed in `SEED_RANGE` must give a distinct card.

**Seeded structure must not depend on canvas size.** The same member's card renders at three sizes — wallet, member card, leaderboard row — and the spin is a gacha, so the prize must be the same object on all of them. `mulberry32(seed + salt)` is a _sequence_: if `init` makes a number of draws that depends on `s.w`, `s.h` or `s.n`, every value drawn afterwards shifts and the structure silently differs per surface. Draw identity — counts, positions, phases, palettes, periods — from a fixed number of pulls, store positions normalised 0..1, and multiply by `w`/`h` only at draw time. Anything sized by the canvas (particle counts, column counts) gets its own separate stream, seeded from the same seed, so it can vary freely without shifting identity. Per-column or per-cell properties come from a fixed-size table indexed by position, never from a loop bounded by the canvas. Size-derived _magnitudes_ may scale; seeded _identity_ may not.

**Blend mode is derived, never hand-set.** `BLEND` in `programs.ts` is generated from each family's program chain. Under `mix-blend-mode: screen` black is invisible, so anything painting darkness or an opaque silhouette (ground, trunk, water, cone, horizon, holes) must composite `normal`. Add a surface wrapper and regenerate the map.

**Particles must fade to zero before they wrap**, via `edge()` from `engine.ts`. A particle that teleports at full opacity is the "jumping" artefact.

**Canvas resolution comes from card height**, so one canvas pixel is ~2 CSS px on the hero card, a leaderboard row and a member card alike. Never hardcode `rows`.

**iOS:** never put `filter` and `mix-blend-mode` on the same element — on iOS 26 the element fills with flat opaque colour. Split them across a wrapper. Prefix `backdrop-filter` and `mask-image` with `-webkit-`.

**Audit before claiming done**, across every family — not just the one you touched. Check for: a family with no program, fewer than three seed axes, black painted under screen blend, an opaque surface drawn in screen mode, particles popping on respawn, seeded identity that shifts when the canvas is resized, and two families sharing a program chain. State the counts; don't assert it's clean.

An audit catches mechanical faults only. Whether an effect looks right, reads as its own thing, or carries real effort is a judgement only the user can make — show the work rather than declaring it done.

**Adding a family:** add the id to `EFFECT_FAMILIES` and an entry to `EFFECTS` (`src/lib/effects.ts`), a palette pair in `PALETTE`, a program in `PROGRAMS`, then regenerate `BLEND` from the chain. Removing one means the same list plus the `docs.ts` effect sentence and both locale files. Run the audit either way.
