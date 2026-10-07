## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>" --undirected` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- The graph is built undirected, so `graphify path` without `--undirected` reports "no directed path found" even when the two nodes are connected.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- A post-commit git hook rebuilds the graph on every commit, so the graph is current as of the last commit. Run `graphify update .` only to pick up uncommitted edits (AST-only, no API cost).
- `.svelte` files log "syntax errors" during extraction — expected, not breakage: tree-sitter parses the JS grammar and cannot read the markup layer, so a regex fallback rescues the imports. Symbol-level detail inside components is thinner than for plain `.ts`.

## Formatting

- Run `npm run build:format` after every edit. Prettier rewrites files on disk, so skipping it makes the next exact-string edit fail against reformatted source.

## Discord UI

Every message, button, select and form the bot sends follows Discord's own developer guidance: the DevRel talk "Discord App Best Practices: UI/UX for Developers" and "Deep Dive: New Message Components". Apply these without being asked, and check existing screens against them when you touch a feature.

**Button colours carry meaning.** At most one Primary (blue) button per message, for its single most common action. Everything else is Secondary (grey), including navigation between equal choices such as the menu and its categories. Danger (red) only for actions that cannot be undone: delete, ban, ending a giveaway early, leaving the creator programme. Success (green) only for the positive half of a decision pair such as Approve/Reject. Link buttons for anything that leaves Discord.

**Pick the control from the kind of choice.** Yes/No in a form is a checkbox; in a message it is one toggle button whose label is the action ("Allow Multiple Entries"), with the current state shown as text beside it. Two to ten fixed choices are a radio group (forms only). Many items, or users, roles and channels, are a select menu; for "choose several" use a multi-select with the current picks as defaults. Images or files are a file upload. Never make someone type a value from a fixed set: durations are radio presets built with `durationField` in `interface/formFields.ts`, whose labels come from `Intl.NumberFormat` units in the member's language.

**Use the fewest steps.** Forms hold up to five labelled components, including string/user/role selects, radio groups, checkboxes and file uploads, so a chain of message screens that ends in a form usually belongs in one form. Staff rating is the reference. Filter the options before showing the form so a submit cannot fail on something already knowable (yourself, a staff member still on cooldown), and still re-check on submit.

**Show only what works here.** Hide features the server switched off (`availableMenuItems` in `interface.ts`) and things this member cannot use (Staff is staff-only), rather than showing a button that then errors.

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
