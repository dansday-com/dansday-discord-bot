## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Formatting

- Run `npm run build:format` after every edit. Prettier rewrites files on disk, so skipping it makes the next exact-string edit fail against reformatted source.

## Theme effects

Every member card effect renders through one `<canvas>` per card. Families are listed in `EFFECT_FAMILIES` (`src/lib/effects.ts`) and each maps to a program in `PROGRAMS` (`src/lib/frontend/fx/programs.ts`); the engine lives alongside it in `src/lib/frontend/fx/`, and `ThemeEffect.svelte` is just the host. There are no hand-drawn SVG paths and none should be added — if something needs a shape, generate it (recursive branches, seeded masks, noise), don't author path data.

**The current program is the baseline.** Read it before changing it, and don't regress it. When an effect looks wrong, work out what it is meant to be from the thing itself — which way sandstorm blows, whether sparkle moves — and never invent the behaviour.

**Simulate the mechanism, don't draw the appearance.** Fire is heat rising through a grid with random decay, so it looks like fire from any angle at any size. A CRT is a beam sweeping down and phosphor decaying behind it. A meteor is a rock that falls until it hits something. Start from what is physically happening and let the picture fall out of it; an effect assembled from shapes that merely resemble the subject will read as fake, and no amount of tuning fixes that.

**Everything must cause something.** Meteors stop at the ground and throw their own impact at that x. Cinders leave the crater the cone is drawn from. Flakes land on the drift they build. Leaves fall from the crowns of the trees that are drawn. A set of independent loops playing side by side is the signature of a low-effort effect — if nothing in the frame responds to anything else, it is not finished.

**Build in layers.** A subject alone, floating in empty space, always looks cheap. Most effects need a surface it happens on or over (ground, water, wall, cone, ridge), the subject itself, and atmosphere tying them together (haze, glow, cloud, dust, light spill). An effect with one layer is a first draft.

**Nothing is a bare pixel.** A single dot is not a heart, a leaf, a rock or a firefly. Give it real form — a pixel sprite, a glow with falloff, a streak with a tail, an irregular seeded mask — and make sure it still reads at a small card size, where one canvas pixel is about 2 CSS pixels.

**The card itself reacts.** `[data-fx-host='<family>']` in `app.css` is part of the effect, not decoration: earthquake shakes the card, a black hole scales it inward, meteor kicks it on impact, eclipse darkens it. Every family should do something at the card level, and it must read at rest as well as mid-animation — a paused keyframe is what off-screen cards freeze at, so a `0%` frame that looks like no effect means the effect vanishes.

**Every effect must vary by seed** on at least three of `hue`, `dir`, `speed`, `drift`, `tilt`, plus seeded _structure_ — tree count and positions, crack sites, hole count, tube bends, moon phase, constellation. Every seed in `SEED_RANGE` must give a distinct card.

**Blend mode is derived, never hand-set.** `BLEND` in `programs.ts` is generated from each family's program chain. Under `mix-blend-mode: screen` black is invisible, so anything painting darkness or an opaque silhouette (ground, trunk, water, cone, horizon, holes) must composite `normal`. Add a surface wrapper and regenerate the map.

**Particles must fade to zero before they wrap**, via `edge()` from `engine.ts`. A particle that teleports at full opacity is the "jumping" artefact.

**Canvas resolution comes from card height**, so one canvas pixel is ~2 CSS px on the hero card, a leaderboard row and a member card alike. Never hardcode `rows`.

**iOS:** never put `filter` and `mix-blend-mode` on the same element — on iOS 26 the element fills with flat opaque colour. Split them across a wrapper. Prefix `backdrop-filter` and `mask-image` with `-webkit-`.

**Audit before claiming done**, across every family — not just the one you touched. Check for: a family with no program, fewer than three seed axes, black painted under screen blend, an opaque surface drawn in screen mode, particles popping on respawn, and two families sharing a program chain. State the counts; don't assert it's clean.

An audit catches mechanical faults only. Whether an effect looks right, reads as its own thing, or carries real effort is a judgement only the user can make — show the work rather than declaring it done.

**Adding a family:** add the id to `EFFECT_FAMILIES` and an entry to `EFFECTS` (`src/lib/effects.ts`), a palette pair in `PALETTE`, a program in `PROGRAMS`, then regenerate `BLEND` from the chain. Removing one means the same list plus the `docs.ts` effect sentence and both locale files. Run the audit either way.
