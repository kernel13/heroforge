# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

HeroForge is a web application for creating and maintaining D&D 3.5 character sheets. It does not
merely digitise the paper form — it **derives** the arithmetic the paper sheet asks you to do by
hand (ability modifiers, AC, saves, skill totals, grapple, initiative, encumbrance). Deriving those
values is the product.

**The source of truth is `docs/superpowers/specs/2026-07-25-heroforge-design.md`.** Read it before
any non-trivial work. This file carries only the architecture summary and the conventions that are
easy to get wrong; it does not restate the spec's column tables or endpoint list.

**Current state: phase 1 is implemented.** Rules engine, API, React sheet, Docker Compose
deployment, and CI are all in place and green.

## Architecture

Caddy terminates TLS, serves the built React bundle, and reverse-proxies `/api/*` to uvicorn.
PostgreSQL 16 behind the api container. Alembic migrations run on api container start.

Three layers inside the api container, depending only downward:

```
heroforge/api/      routers, auth, request/response schemas   (FastAPI, Pydantic v2)
        │
heroforge/db/       SQLAlchemy models, repositories, Alembic  (async SQLAlchemy 2.0)
        │
heroforge_rules/    pure functions over Pydantic models — no I/O
```

`heroforge_rules/` is the load-bearing decision. It is a **separately installable package** and
imports nothing from FastAPI, SQLAlchemy, or I/O modules. That is what makes the whole body of D&D
arithmetic testable without a database and what allows `POST /api/derive` to be fast.

Module layout inside the engine: `models.py`, `abilities.py`, `defense.py`, `saves.py`, `combat.py`,
`skills.py`, `encumbrance.py`, and `sheet.py` — which holds the single public entry point:

```python
def derive(character: CharacterInput, skills: list[SkillDefinition]) -> DerivedSheet: ...
```

Skill definitions are **passed in, never fetched**. The API layer loads the ~40-row `skills` table
once at startup into an in-memory cache and supplies it to every `derive()` call; `sqladmin` edits
invalidate that cache. This is why `/api/derive` touches no database on the per-keystroke path.

## Rules-engine invariants

These are the things a well-meaning change will break. Each is pinned by the golden-character test.

- **Armour check penalties are stored as non-positive integers.** Full plate is `-5`, not `5`. The
  engine therefore **adds** the summed penalty. Swim (`acp_double`) adds it **twice**.
- **A rank is a whole number and counts toward a check in full.** The SRD's fraction of a rank
  exists because a cross-class rank costs two skill points, and this application models no
  skill-point cost; the other half the SRD writes, the cross-class maximum, is rounded down here
  (next bullet). Neither route to a half rank is open. `ranks` is an `int` from `SkillEntry`
  through to the `character_skills` column, and `3.5` is refused at the Pydantic boundary rather
  than stored as something the engine would then have to floor. Nothing here floors ranks: a
  reintroduced `effective_ranks` would be a field that can never differ from `ranks`, which is
  exactly the hook someone uses to put the flooring back.
- **The rank maximum is `character_level + 3` for a class skill and half that, rounded down, for a
  cross-class one.** `max_ranks(character_level, *, is_class_skill)` — the flag is keyword-only and
  has **no default**, because a caller that omitted it would silently receive the class ceiling,
  the more permissive of the two and so the one whose wrongness raises no warning to be noticed by.
  `character_level` is the sum of every class level, so a Rogue 4 / Fighter 3 caps at 10 on a class
  skill and 5 cross-class. Rounding down is the engine's one departure from the SRD, which writes
  the halved maximum as a value that can be fractional (2½ at level 2); rounding it down is what
  keeps every cap an integer and so keeps whole ranks coherent. The `kind` of skill also reaches
  the over-maximum warning's params, so `is_class_skill` is load-bearing in two places.
- **`grapple_size_modifier` ≠ `ac_size`.** A Small creature has +1 AC but −4 to grapple. Separate
  columns; never conflate them.
- **`body_weight`** is the character's own weight from the identity line. **`carried_weight`** is
  derived from possessions and armour and drives encumbrance. Unrelated.
- `effective_dex_bonus` reaches `armor_class` and `touch_ac`. **Flat-footed is `total_ac` minus
  it** — `defense.py:73`, pinned by `test_flat_footed_removes_the_capped_bonus`. The `max(…, 0)`
  there is the load-bearing part: a character with a Dexterity *penalty* is no easier to hit
  flat-footed. (This bullet previously read "applied to all three alike", which the engine has
  never done.)
- Ability modifiers use temporary scores where present, otherwise base scores.
- The Strength carrying-capacity table is a constant inside `encumbrance.py`, not database data.
- **The engine never raises.** It is given input already validated at the Pydantic boundary.
- **The engine has no locale.** `RuleWarning.message` is English and stays English. Alongside it,
  `RuleWarning.params` carries the same facts as **tokens** — `skill_id`, `ranks`, `max_ranks`, and
  a `kind` of `"class"` or `"cross_class"`, never the English word "cross-class" — so a client can
  write the sentence in its own language. Adding a warning means adding its params; splicing
  `message` apart on the client is the failure this exists to prevent.

### Phase 1 does not derive everything

`base_attack_bonus`, the three base saves, and each attack's `attack_bonus` / `damage` are
**user-entered text**, not derived. Deriving them needs class progression tables and weapon
reference data, which are phase 2+. Do not "helpfully" compute them.

The spell block is the same: **spells known, save DC, spells per day, and bonus spells are typed**,
one row per spell level, and so is the class each block belongs to. Spells per day comes from class
progression tables and a save DC from `10 + level + ability modifier` for an ability the engine
would first have to be told which class casts with — and `class_levels` holds free text, so nothing
can read "Wizard 4 / Rogue 3" and know which half of it prepares spells. A `10 + …` anywhere in
`Spells.tsx` or the export is the rule this paragraph exists to prevent.

Phase 2 adds class/race reference data, phase 3 structured feats, phase 4 spellcasting. Explicitly
never planned: dice rolling, party/DM features, character sharing, a character *builder*.

## Cross-cutting rules

- **No rules math in the frontend** — not even `Math.floor((score - 10) / 2)`. Once a formula exists
  in both Python and TypeScript they drift. Every derived number displayed comes from a
  `DerivedSheet`.
- **Rules violations are warnings on `DerivedSheet`, not errors.** Ranks over maximum, Dex bonus
  over armour's `max_dex` — house rules and homebrew are normal play. The application reports; it
  does not refuse.
- **Another user's character returns 404, not 403.** A 403 confirms the identifier exists. Every
  character route filters by `owner_id`.
- **A `PATCH` carrying a stale `version` returns 409.** One character open in two tabs is realistic.
- **The portrait is outside the versioned document.** `PUT`/`GET`/`DELETE
  /api/characters/{id}/portrait` are their own routes, they never touch `version`, and `PATCH`
  never touches their three columns. It is uploaded from the character *list*, and a bump there
  would 409 a sheet the same user has open in another tab on its next autosave. The image is a raw
  request body under its own `Content-Type` rather than multipart — one file and no fields, and
  `python-multipart` stays the transitive dependency of `fastapi-users` that it is. SVG is refused
  on both sides: it is a document that can carry script, served back from this origin.
  `portrait_data` is `deferred`, so no ordinary character read drags an image out of the database;
  `CharacterSummary` carries only `portrait_updated_at`, which tells the card whether to draw the
  glyph *and* cache-busts the image URL. Without the buster a replaced portrait keeps rendering
  from the browser's own cache, and `updated_at` will not do instead — it moves on every write to
  the row, so it would re-fetch the picture each time the name was edited. An upload *does* move
  `updated_at`, which reorders the list by recency; that is the row's `onupdate` and is fine,
  because nothing keys a conflict on it.
  **The sheet only ever *shows* it.** `PortraitFrame` draws the picture beside page one's identity
  fields; adding, replacing and removing stay on the list, for the 409 reason above. It reads the
  stamp from `CharacterWithDerived`, which carries `portrait_updated_at` **beside** the character
  and deliberately not on `CharacterRead`: that model is what the client hands straight back as a
  `PATCH` body, `CharacterBody` is `extra="forbid"`, and `draftOf()` returns a variable rather than
  an object literal — so an extra key riding along type-checks cleanly and then 422s every autosave
  *and* every `/api/derive`. With no portrait the frame stays, holding the list's glyph and a line
  saying where a picture comes from.
- **API errors are RFC 7807 `application/problem+json`**, from a global exception handler.
- **Autosave failure shows a persistent banner, never a toast.** A notice that vanishes after four
  seconds is how a user loses an evening of character building.
- **The interface is English and French; nothing user-visible is a literal in a component.** See
  the internationalisation section below. The backend has no locale — not the engine, not the API.
- Normalise what the engine reasons about; JSONB for what it only stores or sums (`possessions`,
  `feats`, `special_abilities`, `languages`, `spells_raw`).
- **`spells_raw` has a shape, and it lives in `web/src/lib/spells.ts` alone.** The column is still
  `dict[str, Any]` server-side — spellcasting is phase 4 and the freedom is the point — so the
  client is the only thing that knows a `casters` array of blocks sits in there beside the
  free-text `notes`. `readSpellBook()` therefore trusts *nothing*: it pads every caster to ten
  spell levels and reads every field through a string check, because a character saved by an older
  build, or `PATCH`ed by hand, arrives here too. `writeSpellBook()` **carries the keys it did not
  recognise back out** — dropping somebody's data is the one outcome nothing recovers from — and
  the notes paragraph predates the blocks, so it is edited beside them rather than replaced by
  them. Every figure is a **string**: a blank box is a real value on this form, and a `number`
  would write a `0` into fifty boxes nobody filled in.

## Technology guidelines

### FastAPI + Pydantic v2

- Pydantic models are the engine's interface; keep `CharacterInput` / `DerivedSheet` in
  `heroforge_rules/models.py` and have the API layer's request/response schemas compose them rather
  than duplicate their fields.
- All validation lives at the Pydantic boundary: ability scores 1–99, ranks ≥ 0, weights ≥ 0,
  levels ≥ 1. Use `field_validator` / `model_validator` with `mode="after"`, `Annotated[...]` with
  constraint types, and `model_config = ConfigDict(...)` — not the v1 `class Config` / `@validator`
  spellings.
- Routes are `async def`. Never call blocking I/O inside them; the engine is pure and CPU-cheap, so
  calling `derive()` inline is fine.
- Dependencies via `Depends`, including the current user and the startup skills cache. The cache is
  populated in a lifespan handler, not at import time.
- Response models must be declared (`response_model=` or a return annotation) — the OpenAPI schema
  is a build input for the frontend, not documentation.

### SQLAlchemy 2.0 (async) + Alembic

- **Implicit lazy loading does not work under asyncio.** Every character read pulls
  `character_skills`, `character_armor`, `character_attacks`, and `character_class_levels`, so load
  relationships eagerly with `selectinload()`. An unexpected `MissingGreenlet` means a lazy load
  slipped in.
- Use `select()` with `session.execute()` / `session.scalars()`. Do not use the legacy `Query` API.
- Declarative models use `Mapped[...]` / `mapped_column()` typing.
- One session per request, provided by a dependency; commit at the edge, never inside repositories.
- Every schema change gets an Alembic revision. Review autogenerated migrations by hand —
  autogenerate misses constraint and enum changes, including the `character_skills` check
  constraint that exactly one of `skill_id` and `custom_name` is non-null.
- `POST /api/characters` **eagerly** inserts one zeroed `character_skills` row per SRD skill (with
  the paper sheet's repeat count for Craft/Knowledge/Perform/Profession). Do not switch to lazy
  creation — it forces reconciliation logic into both the list endpoint and the sheet component.
- **The attack blocks are not a fixed five.** The paper form prints five because paper cannot grow
  a sixth; this sheet adds and removes them, so `ATTACK_BLOCKS` seeds **two** and `AttacksBlock`
  carries an add button and a per-block remove, as `ClassLevelsBlock` does. Two consequences are
  load-bearing. `replace_attacks` renumbers `ordinal` **from the position sent** rather than
  keeping the row's own — `Character.attacks` is `order_by` that column, and a client that removes
  the middle of three blocks and adds one would otherwise send two rows both claiming ordinal 2 and
  get them back in either order, which reads as one attack's damage under another's name. And the
  blocks are **rows in the draft**, never a count of how many of five to draw: a rendered list that
  disagrees with `draft.attacks` puts a keystroke in the wrong block, which is the skills table's
  sorted-position hazard exactly. Characters made before this keep their five rows — there is no
  migration, and the remove button is how they are trimmed.

### Auth (`fastapi-users`) and rate limiting (`slowapi`)

- Argon2id password hashing. Session cookies are httpOnly + Secure + SameSite=Lax.
- Email verification is required before first login.
- `slowapi` limits on register, login, and password reset. `/api/derive` **requires a valid session**
  and carries a generous per-session limit — high enough never to interfere with typing, low enough
  not to serve as free compute.
- CORS restricted to the deployment origin.

### Reference-data admin (`sqladmin`)

- Superuser-only. It exists to curate SRD reference tables (`skills` now, class/race tables in
  phase 2) without hand-building CRUD screens.
- Reference data is seeded from a **versioned YAML file** and is read-only at runtime otherwise.
  Any write through `sqladmin` must invalidate the startup skills cache.
- **Translated names are columns on the reference row**, not interface copy: `skills.name_fr`
  beside `skills.name`. It is nullable, so a skill curated here before anyone has translated it
  still reaches a French sheet under its English name. Adding a language means a column, a
  migration, and a seed edit — not a frontend release.

### Internationalisation (`web/src/i18n/`)

English and French, chosen by the reader. **The backend has no locale**: the engine reports
warnings in tokens, the API serves every name it holds, and the client decides what to show.

- **Interface copy lives in `en.ts` and `fr.ts`, never in a component.** Keys are flat and dotted;
  `Dictionary` is `typeof en`, so a key added to English and not to French fails `tsc` and
  therefore CI. `{placeholder}` interpolates. Reach for `t()` through `useT()` or `useI18n()`.
- **A sentence containing an element is one key, interpolated with `interpolate()`** — not cut into
  "text before the link" and "text after". French puts the link somewhere else, and a component
  that concatenates has already made that decision for the translator.
- **Skill names are reference data and are not in the dictionaries.** They come from
  `GET /api/skills` as `name` and `name_fr`; `useI18n().skillName(definition)` picks and falls back.
  `name` remains the row's identity — it is what `derive()` is handed — so English never reads
  `name_fr`.
- **The skills table is ordered by name in the language on screen**, by `sortBySkillName()` in
  `i18n/skillOrder.ts` — shared with the PDF, because an export that disagreed with the screen it
  came from is drift nobody notices until a player is reading the printout. It uses `Intl.Collator`
  for the locale: naive code-point ordering strands *Équilibre*, *Équitation*, and *Évasion* in a
  block after Z. **The sort is display only.** A row is identified by its position
  in `draft.skills`, and that position both pairs it with its `DerivedSkill` and is what a write
  targets — so `SkillsTable` sorts a list of *positions* and everything downstream still uses the
  stored index. Letting the sorted position reach either path shows one skill's total on another
  row and types a rank into the wrong one, and both look like the engine is broken. Vitest pins it.
- **Custom rows sort last, and the sort key is the definition's name, never the row's label.**
  Otherwise a row re-sorts itself on each keystroke and jumps out from under the cursor of the
  person naming it, or typing a Craft specialisation moves the row being typed into. Repeat rows
  (Craft, Knowledge, Perform, Profession) compare equal and stay in stored order — `sort` is
  stable.
- **The unit a weight is *read* in is the reader's; the unit it is *stored* in is the engine's.**
  English shows the SRD's pounds, French shows kilograms, and `translatorFor()`'s `weight()` /
  `weightNumber()` are the only place that converts — on the translator rather than in a hook,
  because `web/src/pdf/` renders outside the provider tree and a printout that disagreed with the
  screen about what a load weighs is exactly the drift the shared skill ordering exists to prevent.
  The factor is **0.5, not 0.45359237**: the reader has the French rulebooks open beside the sheet
  and those print the halving, so full plate is 25 kg there and a physically exact 22,7 would read
  as an arithmetic fault in the thing that exists to do the arithmetic. `Intl.NumberFormat` writes
  the separator, for the `Intl.Collator` reason.
  **Typed weights convert too, and only through `weightInput` / `weightToPounds`.** Gear `weight`
  and each possession's `weight` are *read* in the reader's unit and *stored* in pounds — the draft,
  a `PATCH` and a `/api/derive` body carry pounds and nothing else, so `weightToPounds` is the last
  thing that runs before a value reaches any of them. `markerFraction` in `DerivedRail` stays on raw
  pounds because a ratio is unit-invariant.
  *(This paragraph used to forbid converting typed fields outright, on the grounds that "a 5 lb item
  round-tripped through a float returns 4.9". That is true of the physical 0.45359237 and **false of
  the 0.5 this application uses**: a power of two is exact in IEEE 754 and `String(number)`
  round-trips a double losslessly, so `weightToPounds(weightInput(x)) === x` for every finite `x` —
  pinned in `i18n.test.ts` down to `0.0001`. The prohibition was guarding a hazard this factor does
  not have, at the cost of a French gear panel that asked for pounds directly beneath a total in
  kilograms. **The rule still holds for any factor that is not a power of two**; changing the factor
  means restoring it.)*
  **`weight()` and `weightNumber()` may not be used in an editable control** — they carry
  `maximumFractionDigits: 1`, so a field reformatted through them would silently truncate what the
  player typed. That rounding is fine for a derived figure and fatal for a typed one, which is why
  the two paths are separate functions rather than one with a flag.
  **`WeightField` / `WeightInput` buffer what is being typed.** A controlled input re-derived from
  the draft on every keystroke fights the typist: `2,5` passes through `2,`, which parses as 2,
  stores 4 lb and re-renders as `2`, deleting the comma from under the cursor. The buffer holds the
  raw text while the field has focus and is dropped on blur; the draft still updates per keystroke.
  **`body_weight` is the deliberate exception.** It is a free-text `TextField` on the identity line,
  its French label claims no unit, it feeds nothing, and players have been writing whatever they
  like in it. Converting free text would reinterpret what is already stored — leave it alone.
  Grouping is off (`useGrouping: false`): French would write 2000 lb as `1 000 kg` with a U+202F the
  PDF font need not carry, and English has never grouped a weight.
  A figure that will not parse as a number passes through **in pounds** rather than being
  relabelled: a wrong number is visible on the page, a right number under a wrong unit is not.
- **Rules warnings are rebuilt from `code` and `params`** in `RuleWarnings.tsx`, not shown as the
  engine's `message`. The skill is renamed from the definitions the sheet already holds; the `kind`
  token is translated. A warning code the build does not recognise falls back to `message`.
  **A warning's sentence carries no unit of its own** — `warning.overloaded` interpolates
  `{weight}` and `{max}` already written in the reader's unit, because the same figure reading
  "150 lb" in the warnings panel and "37,5 kg" in the rail above it is the engine appearing to
  contradict itself.
- **Server error text is never displayed.** An RFC 7807 `detail` is English written by the API and
  no dictionary will ever cover it, so `errorKey()` maps the *status* to a key. For the same
  reason `SaveState` carries `conflict` and `httpStatus`, not a sentence — `SaveBanner` says what
  they mean.
- **`ABILITIES` in `api/types.ts` carries no display name.** `short` is the SRD's untranslated
  three-letter abbreviation; the name is `t("ability.<key>")`. Aria-labels compose from the
  *translated* name, so `getByLabelText("Valeur de Dextérité")` works in French exactly as
  `"Dexterity score"` does in English.
- **A spell level is written, never assembled.** `spells.level.0` … `spells.level.9` are ten
  dictionary keys — `1st` against `1er` — because `${n}` plus a suffix is an English ordinal rule
  living in a component. They are **display only**: an accessible name carries the plain number, so
  it reads "level 3" in both languages rather than "level 3rd", and does not have to be respelled
  every time a column heading is.
- **The spell grid keeps the printed form's column order, with `LEVEL` in the middle** — spells
  known, save DC, *level*, spells per day, bonus spells — on screen and in the export alike, which
  is why `COLUMNS` in `Spells.tsx` and `SPELL_FIGURES` in the document both carry a `null` where
  the level column goes rather than putting it first as a table normally keys its rows. **The
  spells themselves are the panel's free-text notes, not ten more boxes**: written out level by
  level they were a comma-separated list per box, doubled the height of every block, and said
  nothing a paragraph does not. Two casters sit side by side on screen as they do in the export,
  by the panel's own `auto-fit` grid.
- **A spellcasting block is named by the class the player typed, and `casterNames()` is what makes
  that safe.** That name goes into the block's `<legend>`, its PDF heading, and every one of its
  fifty-odd `aria-label`s — so a blank one, or the same one twice, is not a cosmetic problem but a
  `getByLabelText` that throws instead of resolving. A name is used only when it is both filled in
  and unique among the casters; otherwise the block's position disambiguates it
  (`Wizard (2)`, `Spellcasting class 3`). Vitest pins both routes.
- **The class is typed *in* that legend, behind a pencil, and there is no field for it under one.**
  A titled box whose first box repeated its own title spent a row of a five-column form saying what
  the frame already said; the row underneath is three fields wide now and the domains field takes
  the width back. The editor carries the block's positional `aria-label` (`Spellcasting class 1`),
  never the caster's name, so a rename cannot make the control that performs it unaddressable
  mid-edit. Enter and Escape both just close it and return focus to the pencil — **neither is an
  undo**: every keystroke is already in the draft, as it is for the two hundred other controls
  here. A blank block **shows the "enter your class" prompt and is named by its position**: the
  prompt is what a player needs on the screen, where two empty blocks are already two visibly
  separate boxes, and `casterNames()`' positional fallback is what every one of the block's
  accessible names still comes from, where two blocks answering to the same words is a
  `getByLabelText` that throws. Vitest pins the split — collapsing it is the obvious tidy-up. The
  pencil is `lucide-react`'s, as the header controls are — an application affordance rather than
  one of `icons.tsx`'s section glyphs, and one that supplies its own `aria-hidden`.
- **`web/src/pdf/` gets the translator as a prop.** `pdf(<Document/>).toBlob()` renders through
  react-pdf's own reconciler, which cannot see a React context; a `useI18n()` below
  `CharacterSheetDocument` finds nothing. `ExportPdfButton` reads it and threads it down, along
  with the skill definitions the document names its rows from. The filename is translated too.
- The choice lives in `localStorage`, defaulting to the browser's own preference and falling back
  to English — **not** in the URL, so a sheet's address stays the address of that sheet and a link
  shared between two players opens in each of their languages. `<html lang>` is kept in step; a
  screen reader picks its pronunciation from it.
- **The switcher is `lucide-react`'s `Languages` glyph, not a flag** — a flag names a country, and
  neither language belongs to one. It is a header control, which is what keeps it on lucide (see
  the icons section) and out of the Iconify `aria-hidden` rule. It sits in `App.tsx`'s nav **and**
  on the `Auth` card: a French speaker needs it before they have an account.
- Language names are endonyms and identical in every dictionary — `English`, `Français`. Someone
  who cannot read the current interface scans for their own language, not for its English name.

### React + Vite + TypeScript + TanStack Query + shadcn/ui

- **shadcn/ui is the UI library. Every new piece of interface is built from it** (Radix primitives
  styled with Tailwind v4) — reach for a shadcn component before writing a bare `<button>`, a
  hand-rolled dialog, or a one-off styled `<div>`. Add one with `npx shadcn@latest add <name>` run
  from `web/` — the CLI reads `web/components.json` from the working directory
  (`style: new-york`, `baseColor: stone`, CSS variables on, aliases under `@/`). Do not introduce a
  second component library alongside it.
- Generated components live in `web/src/components/ui/` and are **owned by this repository** —
  editing them is expected, and two edits are already load-bearing: `CardTitle` takes `asChild` so a
  panel heading stays an `<h2>`, and `SaveBanner` passes `role="status"` to override `Alert`'s
  built-in `role="alert"` for the quiet state. Re-running `shadcn add` for an existing component
  overwrites those edits — diff before accepting.
- The palette lives once, in `web/src/styles.css`, as shadcn's CSS variables. Do not restate
  colours at a callsite. **Three** surfaces carry the design: the page is a woven stripe made of
  two gradients, everything a player *types* sits on an opaque parchment panel above it, and
  everything the engine *worked out* sits in the dark rail beside them.
- **The ground is gradients, not a photograph.** It was `public/leather.jpg` — a generated raster
  with blotchiness at three scales. Beside the derived rail that hide was the loudest thing on the
  page: a dark instrument and a bright mottled ground competing for the same glance, with the
  panels floating between them. A 9px stripe reads as material at arm's length and as flat colour
  at reading distance, which is what a background is for, and it costs no request and no raster.
  `public/leather.jpg` and `scripts/generate-leather-texture.mjs` are **no longer referenced** —
  they are kept for provenance, not used.
- **Text laid straight on the ground is `--on-ground` / `--on-ground-muted`, never `--foreground`.**
  Ink is for parchment; on the woven stripe #2b1f19 is very nearly invisible, which is what the
  character list's heading, its field label and its status lines were. The character list is the
  only region with no panel under it, so it is the only place these belong — reaching for them
  inside a panel undoes the point of the parchment.
- **The character list is a grid of tiles built out of both of the sheet's materials.** Each tile's
  head band is the rail's slate and carries the portrait, the name, the race, and the one figure on
  this screen the application worked out — the character level; the body below it is parchment and
  carries what the player typed. This is the **only** region outside `DerivedRail` the `--rail-*`
  tokens reach, and the reason it is allowed to is that the material means the same thing here as
  it does there. `characterLevel()` summing the class levels is not a breach of the no-rules-math
  rule: it is printed, nothing is computed from it, and the list deliberately never calls
  `/api/derive`.
  **The signature is the ledger.** The classes are one row each — class name left, level
  right-aligned in a column exactly `--fig` wide — and that is the same column the gold total sits
  in up in the slate, so the 4 and the 3 line up directly under the 7 and the tile shows its own
  arithmetic. `--fig` is declared once, on the tile, and read by the band and every ledger row;
  splitting it into two measurements ends the whole design silently. It also fixes what a joined
  string did: "druide 4 / mage 2 / Arcane Hiérophante 1" wraps into soup at any tile width, and
  three rows never wrap.
  The name and the race under it are **one** control carrying its own `aria-label`: an accessible
  name assembled from both spans reads "Bramwell Human", and jsdom and a browser do not even agree
  on whether there is a space in it. The name is `font-heading` — a tile is a *name*, which is what
  that face is kept for — except an unnamed one, where "Unnamed character" is a description and is
  set in the body face in italic. The portrait control is icon-only, so its `aria-label` is the
  whole of its name — the default glyph goes through `SectionIcon` and the image's `alt` is empty,
  both for that reason. Controls in the band carry `ON_RAIL`, for `ON_GROUND`'s reason exactly:
  shadcn's focus ring is the sheet's vermilion and is invisible on slate.
  **The level is an `<output aria-label>` with its caption in a sibling**, as every other figure on
  this application is, and with no class typed it goes to a dash and **loses the label with it** —
  "Level 0" is a statement about a character nobody has finished making. The empty ledger becomes
  the invitation rather than a gap. **Delete is demoted, not hidden and not confirmed**: quiet text
  at the end of the foot that colours only on hover and focus, exactly as reachable as the outline
  button it replaced and a great deal less loud.
  The foot's "3 days ago" is `lib/since.ts` over `Intl.RelativeTimeFormat`, for the reason weights
  go through `Intl.NumberFormat` — the phrasing and the pluralisation are the locale's. The one
  piece of copy in it is the under-a-minute case, passed in: `Intl` gives the bare adverb "now",
  and "No campaign · now" is a sentence with a word missing.
- `--card` is **opaque**. It was translucent so the grain read through a panel; a stripe read
  through a panel is a moiré under every line of text rather than a texture, and opaque means a
  value's contrast against its own panel is one number instead of a range.
- **A panel's frame is a hairline and a small radius.** It was a hand-inked `border-image` ten
  pixels thick; on a page carrying fifteen panels the drawing was an ornament the reader looked
  *past* rather than the edge of a region. A border should stop saying "this group is one thing"
  once you have understood it.
- **A panel's title is set, not lettered** — `panel-title` is a 0.72rem letterspaced capital in the
  body sans. MedievalSharp at 1.2rem made every header a piece of scenery on the way to the fields.
  `uppercase` is a CSS transform and does not touch text content, so `getByRole("heading", { name:
  "Skills" })` is unaffected. `font-heading` still letters the character's name in the rail — the
  one thing on the page that is a name rather than a category.
- **There is no `BannerPanel`.** The identity panel was drawn under a scroll banner because it
  names the character where every other panel names a calculation. The character is named by the
  rail's `<h1>` now, on both pages and without scrolling, so the banner was a second answer to a
  question already answered — and a tall drawn one at the top of every sheet. Identity is an
  ordinary `Panel`.
- **Paired panels go in `PanelPair`**, an `auto-fit` grid — abilities beside the class levels that
  cap every rank. It is the panel's own minimum that decides when the row breaks, not a breakpoint
  that would have to be revisited each time a field is added to either side.
  **Armour class and initiative/grapple are deliberately *not* a pair.** They were, on the grounds
  that both read the same Dexterity. They are stacked now — initiative and grapple first, armour
  class full width under it, at every width. Re-pairing them is the obvious tidy-up; it is a
  deliberate layout choice, not an omission.
- **The abilities table has one modifier column, not two.** The pair showed which of the base and
  temporary scores the engine had taken the modifier from by leaving one of them *blank*, which is
  the least legible way a table can say anything. "Modifier in use" shows it directly and the row
  shows both scores. The ability's full name is used, not its abbreviation, so no `<abbr title>` is
  needed to read it.
- **The two display faces are self-hosted**, imported from `@fontsource/*` in `main.tsx` — not from
  `styles.css`, where Tailwind's own `@import` resolver cannot read a bare package specifier, and
  emphatically not from `fonts.googleapis.com`. The reasoning is the icons' reasoning exactly: a
  deployment whose CORS is restricted to its own origin must not put a third-party request on every
  page load, and must still letter its headings on a boxed-in network. Section names use
  `font-heading`; `font-emblem` is the nav's SRD mark and nothing else. Adding a weight means
  adding an import, and adding a **face** means editing FONTS.txt in the same change.
- **Fields nest their control inside `Label`** rather than pairing `htmlFor` with a generated
  `id`. The sheet has some two hundred controls; implicit association is what keeps every one of
  them addressable by `getByLabelText` without id bookkeeping.
- **Derived values are `<output aria-label={label}>` with the label in a sibling element.** Both
  the Vitest and Playwright suites read a derived number by its accessible name and assert the
  output's text content; folding the label into the same element makes an empty modifier column
  look non-empty.
- **A skill's total is shown only when the skill has a rank in it**, on screen and in the PDF alike
  — a blank total column beside a printed one that reads `+2` is exactly the drift the shared skill
  ordering exists to prevent. The gate reads the **derived** row's `ranks`, not the draft's, so that
  the total and the rank it was computed from always agree; gating on the draft reveals the previous
  total for the length of the 250 ms debounce. The `<output>` stays in the tree with its accessible
  name and goes *empty* — removing the element makes every `getByLabelText` for it fail as "unable
  to find", which reads like a renamed label rather than a deliberately blank column. Because a
  fresh character has no ranks, a Playwright assertion on such a total needs `toBeAttached()`:
  an empty block has no box and is never `toBeVisible()`.
- **Do not convert the skills table's `<abbr title>` flags to `Tooltip`.** A tooltip moves the
  explanation into `aria-describedby` and drops the `title` attribute the tests read.
- **The marks are explained by a key, and the rules by the note.** They were one paragraph carrying
  both, with `*`, `**` and `T` spliced into its sentences — so a reader who had just seen a mark
  beside a row had to read prose to the end to find out what it meant. `fields.tsx`'s **`MarkKey`**
  draws them as a `<dl>`, mark as `<dt>` and meaning as `<dd>`, built from **`MARKS` in
  `SkillsTable.tsx`** — the glyph *and* its dictionary key, which the row flags read too, because a
  `*` changed on a row and not in the key leaves both halves still rendering and only one of them
  right. It is a sibling of `Note`, never a child:
  `Note` is a `<p>` and a list inside one is markup jsdom accepts and a browser closes early. A key
  entry carries no `title` of its own — its meaning is already beside it. The note is what is left:
  the rank maximum and when a total appears, one sentence each. That maximum previously read
  "level + 3 whether it is a class skill or not" on screen **and** in `pdf.skills.note`, which is
  not what `max_ranks()` does; both now say half, rounded down, for a cross-class skill, in the
  wording `warning.kind.cross_class` already uses.
- **Only a blank row a player added is removable**, gated on `skill_id` being null rather than on
  the definition being missing — a row pointing at a skill the current bundle has never heard of is
  still an SRD row, and offering to delete it turns a stale build into lost data. Removing an SRD
  row would also mean synthesising it back, which is the reconciliation eager row creation exists
  to avoid. The filter runs on the row's position in `draft.skills`, never its sorted position on
  screen, for the same reason every other write does. `apply_skill_rows` already drops the rows a
  `PATCH` omits, so removal is a client change only. Vitest pins all three.
- Autosave failure is an `Alert`, never `sonner` — see the cross-cutting rule above. The **quiet**
  states are not: "All changes saved" as a full-width `Alert` spent a row of the reader's screen on
  the absence of news, above the fields they came for. `SaveBanner` returns `null` for them and
  `DerivedRail` shows them at its foot, in a region the reader is already watching. `quietSaveKey`
  is the seam. Each sentence is still written in exactly one place, so the end-to-end suite's
  `getByText("All changes saved")` stays unambiguous.
- **The tab strip is two tabs on the page's ground, and is deliberately not `variant="line"`.**
  That variant carries `group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent`,
  which beats a plain `data-[state=active]:bg-card` on specificity — the open tab renders
  transparent with dark ink on it, which over this ground is an empty black box. The strip also
  carries `-mb-px` and the triggers `z-10`, so the open tab's edge is continuous with the page it
  opens.
- **A control that sits on the ground is lettered for the ground** — `ON_GROUND` in
  `CharacterSheet.tsx`, a light translucent pill with a light edge. A shadcn `ghost` there is dark
  ink on dark stripe with no border.
- **The sheet is three pages, switched by a `Tabs` strip.** The first two follow the printed record
  sheet: page one is identity, classes, abilities, HP/AC/initiative/grapple/saves, attacks, and
  skills; page two is campaign, gear, possessions, money, feats, special abilities, languages, and
  spells. **Page three is the spellbook, and is this application's own** — the printed form has no
  such page, because a book of scribed spells is a list with no length and paper has to stop
  somewhere. It is a page rather than a panel on page two for that reason: a wizard past the low
  levels has more spells written down than every other block on page two put together, and putting
  the book under the spells grid buries the grid under it. The inactive pages are **unmounted** —
  Radix's default — not CSS-hidden, so their controls stay out of the accessibility tree and
  `getByLabelText` stays unambiguous. Which page is open is `useState` on `CharacterSheet`,
  deliberately not in the URL. The pages are a `PAGES` list, not a ternary in the trigger.
- **The spellbook is the book's *contents*; page two's grid is what is cast from it.** They answer
  different questions at the table — "what could I prepare tomorrow?" against "how many can I cast
  today?" — and both live in `spells_raw`, which is why `readSpellBook` destructures `spellbook`
  out alongside `notes` and `casters`. **A recognised key left in `rest` is written twice** by
  `writeSpellBook`, once from the spread and once from the field, and the spread losing that race
  silently restores whatever was in the column before. **A spell's level is its position in the
  book**, not a field on the entry: `Spellbook` is exactly ten groups indexed by spell level, so
  there is no level to type, mistype, or validate, and no way to store a spell at a level the game
  has none of. Nothing on this page is derived and nothing could be — a spell's level and school
  are reference data phase 1 does not have. There is deliberately **no inference from
  `class_levels` to which levels of the book are available**: that column is free text, and a book
  greyed out at level 6 because a component guessed at "Wizard 10" is the sheet refusing to hold
  what a player wrote.
- **The header, `SaveBanner`, and the warnings `Alert` sit above both pages, and `useSheet` stays on
  `CharacterSheet`.** A failed save must not be something a user can navigate away from, and moving
  the draft down into a page component would discard every edit on each page change. Vitest pins
  both.
- **Derived and entered are told apart by *place*: `DerivedRail` beside the working column.** The
  rail carries every character-level value the engine worked out — armour class with touch and
  flat-footed, initiative, grapple, the three save totals, the six ability modifiers, hit points,
  the base attack bonus, the load — and it is a sibling of the `Tabs`, not a child of a
  `TabsContent`, so it survives the
  page change and stays put while forty skill rows scroll past. Changing Dexterity at the bottom of
  the skills table and watching armour class move is the product demonstrating itself; before the
  rail it took a scroll.
- **The rail is a column beside the sheet and a banner above it.** It is `lg:sticky`; below that
  breakpoint its sections reflow into two or three columns. They have to: stacked, the rail is some
  690px tall, and on a 390×844 phone that is the whole first screen between the reader and the
  first field. Reflowing takes it to about 430px and puts the identity panel back above the fold.
  **Every derived total survives the reflow**; what `hidden lg:*` drops is the description around
  them — the identity sentence, the character level, the component disclosures, the nonlethal/speed
  line — each restated by a panel a scroll below. Prose goes first, numbers go last, and nothing
  the engine worked out goes at all. `RailSection`'s separators are the parent grid's 1px gaps
  showing the container colour through, which is what lets one set of sections serve both layouts.
  Measure before trusting any of these numbers again — they came from screenshots, not from
  arithmetic, and a field added to the rail changes them.
- **No derived value is written in both regions.** `ArmorClassBlock`, `InitiativeAndGrapple` and
  `SavingThrows` are input-only now; their totals live in the rail. This is a design rule first — a
  total shown twice can disagree with itself mid-recompute — and an addressability rule second:
  every suite here reads derived values by accessible name, so two elements answering to "Armour
  class" makes `getByLabelText` throw rather than fail with something legible. Vitest pins that each
  name resolves to exactly one element. The one deliberate repetition is the rail's ability-modifier
  strip, which restates what `AbilityTable` shows because page two would otherwise have no modifiers
  to trace its numbers back to; it is a `<dl>` carrying **no** `aria-label`s, so "Dexterity modifier"
  stays the table's name alone.
- **A rail label is a `<p>`, not a heading.** The rail restates section names the panels already
  own — "Hit points", "Saving throws" — and a heading would put each of them in the document outline
  twice. The `<aside>`'s `aria-label` names the region instead, which is what a landmark is for.
- **Components sit behind a `<details>`, never beside the total they add to.** A total printed at
  the same weight as `armour 8 · shield 2 · Dex 1` reads as a sum still to be finished, and players
  add it up again — which is how a sheet that does the arithmetic ends up being checked by hand.
- Every derived number on screen still goes through `fields.tsx`'s `Derived`, rail included; the
  rail uses its `rail` and `railHeadline` variants. A second component rendering engine output would
  be a second place for the no-rules-math rule to be forgotten. The rail's **`Reading`** is the
  deliberate opposite: hit points, the base attack bonus, damage reduction and speed are *typed*, so
  they are not `Derived` and carry **no `aria-label`** — the panel field they echo already owns that
  accessible name, and a rail `<output>` labelled "Speed" beside a panel input labelled "Speed" is
  exactly the collision this layout is otherwise arranged to avoid.
  **The base attack bonus is the one component printed beside a total it feeds** — it is row one of
  grapple's disclosure and a headline block directly above it. It is allowed because it is not only
  a grapple input: it is the base of every attack roll, it is the one control in that panel with no
  total of its own, and page two shows it nowhere else. Two headline blocks with their own glyphs
  read as two figures, not as a sum left unfinished. It uses its own **`rail.baseAttack`** key —
  "Bonus de base à l'attaque" does not fit beside a 1.9rem figure in a 19rem rail, which is
  `rail.save.*`'s reason exactly — and `IconAttack`, leaving `IconAttacks` paired with grapple's
  panel legend. Folding it back into the disclosure is the obvious tidy-up.
- **The rail's gold is an accent, not the colour of derived values.** Headline totals are white with
  a warm glow behind them; `--rail-accent` is spent on the few things that mean something by being
  gold — a *positive* ability modifier, the marker on the load scale, the character's own words in
  the identity sentence. Lettering every total in it spends the accent on everything, which is the
  same as spending it on nothing.
- `rail-label` is the **body sans**, not `font-emblem`. Cinzel is inscriptional and wide: as a
  letterspaced 0.62rem label it makes "FLAT-FOOTED" wider than the number under it, which is what
  forces the armour-class readings to stack where the design has them in a row.
- A `RailSection` draws its title as a **bar** only when it names a *group* of small readings — the
  six ability modifiers, the three saves. A block whose content is one figure keeps its label inline
  beside that figure; a bar over a single number reads as a section inside a section.
- **The load scale is drawn with its own numbers on it.** Three coloured thirds with nothing marked
  is decoration; the marker's position is a drawing instruction worked out band by band in the
  component, and which band the character is actually *in* stays `encumbrance.category` from the
  engine.
- `pdf/theme.ts` deliberately does **not** restate the rail's palette. The export has no sticky
  region to put a rail in and lays derived values out in the printed sheet's own order.
- shadcn's default control height (`h-9`) and table padding (`p-4`) are too loose for a sheet with
  forty skill rows. Density overrides belong in the primitives in `fields.tsx`, not per callsite.
- The sheet is held in React local state. Each edit fires a **250 ms-debounced** `POST /api/derive`;
  persistence is a **separate 2 s-debounced** `PATCH`. Do not merge the two debounces — they exist
  for different reasons.
- TanStack Query owns server state (character list, skills, character fetch). Do not mirror server
  state into `useState`; the sheet's local draft is the deliberate exception.
- TypeScript types are generated from the OpenAPI schema by `openapi-typescript` and **committed**.
  Never hand-edit generated output and never hand-write an API type — regenerate. CI fails if the
  committed output is stale.
- `strict` TypeScript. No `any` on API boundaries.

### Icons

**Iconify is the icon library.** Browse and pick at <https://icon-sets.iconify.design> and refer to
an icon by its full Iconify name, `set:name` — `lucide:download`, `tabler:alert-octagon`. One
catalogue across 200-odd sets means a missing glyph is a different prefix rather than a second
icon dependency.

- **Icon data is bundled at build time. Never the runtime API.** `@iconify/react`'s default `Icon`
  fetches from `api.iconify.design` on render, which would put a third-party request on every page
  load of a self-hosted deployment whose CORS is restricted to its own origin — and would leave the
  sheet iconless on a boxed-in network. This is wired as `unplugin-icons` in `vite.config.ts`
  (`compiler: "jsx", jsx: "react"`), so `import Shield from "~icons/game-icons/shield"` resolves to
  one inlined component per glyph and only the glyphs imported reach the bundle. The
  `@iconify-json/*` sets are devDependencies — build input, not shipped. `unplugin-icons/types/react`
  is in the tsconfig `types` array, which is explicit and so picks up nothing on its own.
- **The sheet's icon vocabulary lives in `web/src/components/icons.tsx`**, one named export per
  section of the character sheet, and callsites pass it as `Panel`'s or `Fieldset`'s `icon` prop.
  Choosing the glyph beside the section it names is what keeps the same shape meaning the same
  thing on both pages. Do not import `~icons/*` at a component callsite.
- **An icon must not contribute to a control's accessible name.** `lucide-react` sets
  `aria-hidden="true"` itself whenever an icon has no children and no a11y prop, so
  `getByRole("button", { name: "Export PDF" })` matches a button whose markup is icon-then-text.
  **`unplugin-icons` does not** — it emits the raw SVG. That is why the `aria-hidden` for section
  icons is applied once, in `fields.tsx`'s `SectionIcon` wrapper, and not at twenty-odd callsites:
  no callsite can forget it. Every suite here addresses controls by accessible name, so an icon
  that leaks into that name breaks tests far from the component that changed. Vitest pins both that
  every section has an icon and that no rendered `<svg>` sits outside an `aria-hidden` wrapper. An
  icon-*only* control still needs its own `aria-label`.
- **`lucide-react` remains for the header controls** — `CharacterSheet.tsx`'s back arrow and
  `ExportPdfButton.tsx` — and for the generated `ui/checkbox.tsx`; `web/components.json` still sets
  `"iconLibrary": "lucide"`. Those application icons can move to Iconify (`lucide:*` keeps the same
  glyphs, so it is a swap of import and name, not a redesign) provided the `aria-hidden` that
  lucide supplies for free is supplied explicitly. Icons *inside* `components/ui/` are a separate
  matter: the shadcn CLI writes lucide imports into the components it generates, so changing them by
  hand puts every future `shadcn add` in conflict with the repository. Leave the primitives on
  lucide until `components.json` can carry the change.
- **The `game-icons` set is CC BY 3.0, not CC0.** Its glyphs are bundled into the shipped bundle,
  so the attribution ships too: `ICONS.txt` at the repository root names every icon used with its
  author, `docker/web.Dockerfile` copies it into `/dist` beside `OGL.txt`, and the footer links it.
  Adding or removing a `game-icons` glyph means editing `ICONS.txt` in the same change. Check
  `node_modules/@iconify-json/<set>/info.json` before reaching for a set that is not already used —
  the licence differs per set, and some carry no attribution requirement at all.
- **Nothing from `~icons/*` may reach `web/src/pdf/`.** `@react-pdf/renderer` lays out its own
  `Svg`/`Path` primitives and cannot render a DOM SVG component; an icon import there fails the
  export tests, which render the document for real.

### PDF export (`web/src/pdf/`)

`@react-pdf/renderer` builds the sheet in the browser; the button is in the sheet header.

- **The two sheet pages always print; the spellbook page prints only for a character who has
  scribed something.** A blank page headed SPELLBOOK on every fighter's export is what `Attacks`
  refuses five blank frames of, one scale up, so `CharacterSheetDocument` gates the third `<Page>`
  on `spellbookIsEmpty()` and `Spellbook` drops both a level with nothing at it and a row a player
  added and never filled in. It follows that the export has **no fixed page count** — do not write
  "the two-page export" back into this file or into a footer; `pageNumber`/`totalPages` already
  handle a document that grows, and a book of three hundred spells does grow it.
- **A spellbook line is `wrap={false}`, and that is the whole reason `SpellbookEntryLine` is a
  component.** react-pdf breaks a laid-out row wherever the page ends: before that flag, a book long
  enough to paginate left a spell's school and page reference at the foot of one page with its name
  at the head of the next. A line is one reading and moves whole. The level *group* around it keeps
  `wrap` — a wizard can have thirty spells at one level, and a group told to stay whole is pushed
  onto a page it still overruns.
- **Spells print two to a row**, in a `flexWrap` container as the caster blocks do. A spell name is
  a few words and its school shorter still; a full-width line each spends two thirds of the page on
  white space and doubles the length of a book.
- **The renderer is imported dynamically, inside the click handler.** It is a 1.4 MB chunk. Turning
  `import("@react-pdf/renderer")` into a static import puts it in the initial bundle, which is a
  half-megabyte tax on every page load for a button most sessions never press.
- **The document reads `DerivedSheet`; it does not compute.** The cross-cutting no-rules-math rule
  applies here with a sharper edge, because a formula row that prints `total = a + b + c` looks like
  it wants a `reduce()` over its own components. It must not have one — the `+` signs are drawn.
  `signed()` is formatting, not arithmetic.
- **Structure, not design.** The layout follows the printed record sheet's field grouping and
  reading order, which is mechanical. Its *design* is this application's own: the `styles.css`
  palette restated in `theme.ts`, no black-bar headings, no publisher wordmark or trade dress. See
  the licensing section below before making the export look more like the original.
- Page numbers come from react-pdf's `render={({ pageNumber, totalPages }) => …}`, not from a
  constant. A long possessions list adds a page, and a footer told it was page one repeats itself.
- The export takes the sheet's **draft**, not the loaded character. Exporting inside the two-second
  save window must produce what is on screen.
- **The spell section is a full-width row under page two's three columns, not a fourth column.** The
  printed form has one SPELLS column because it has one page to spend; a character with two casting
  classes needs two blocks side by side, and a third of a page does not hold one. Blocks are half
  the page each — two share a row, a third wraps, and the free-text notes take the half a lone
  caster leaves empty rather than a row of their own. A block's grid always prints all ten rows,
  filled or not — it is the table a player reads during play and it costs about a hundred points to
  print in full. The
  grid's headings are their own `pdf.spells.head.*` keys rather than the screen's, because the
  columns are a few points wide and French has to be abbreviated there without being abbreviated on
  screen; `pdf.spells.note` writes each abbreviation out, as `pdf.possessions.note` does for `Wt.`

### Docker Compose / Caddy deployment

- Four services: `caddy`, `api`, `web` (build stage producing static files), `postgres:16`.
- Secrets come from `.env` and are never baked into images. `.env.example` is committed.
- Named volume for PostgreSQL, plus a nightly `pg_dump` to a host directory. A character sheet
  represents months of play and exists nowhere else.

## Testing

- **Rules engine, test-first.** The SRD specifies the formulas in advance, so there is no design
  uncertainty to resolve before writing the test. Use `@pytest.mark.parametrize` tables.
- **The golden character is the anchor:** one fully worked level-7 multiclass character with armour,
  a shield, cross-class ranks, and a carried weight near the medium/heavy boundary, with every
  derived value asserted. It catches composition errors per-function tests miss — such as
  `effective_dex_bonus` reaching `armor_class` but not `touch_ac`. It carries armour with a nonzero
  check penalty and asserts a Swim total, pinning both the sign convention and the double penalty.
- **API:** pytest with `httpx.AsyncClient` against real PostgreSQL via testcontainers, each test in a
  rolled-back transaction. Required cases: register → verify → login; unverified user cannot log in;
  user A gets 404 for user B's character; stale `version` gives 409.
- **Frontend:** Vitest for sheet components. Two Playwright end-to-end tests — register, create a
  character, change Dexterity, assert AC, initiative, Reflex, and a Dex-keyed skill all change;
  and the same stack read in French, which is the only place a skill's `name_fr` is shown to
  survive the column, the migration, the seed, the response schema, and the client fallback
  together.
- **Every component test renders through `renderIn` (`src/test/render.tsx`)**, which pins the
  language. A bare `render()` throws — there is no provider — and `initialLocale()` consults
  `navigator.languages`, so an unpinned suite would pass or fail by the machine it ran on. English
  is the default, which is what the existing accessible-name assertions read; French cases are
  added rather than existing ones retargeted. Playwright pins `locale: "en-GB"` for the same
  reason.
- **The PDF export tests render the document for real** rather than asserting on bytes, in both
  languages. Running `pdf().toBlob()` puts the same layout engine the browser uses in front of the
  component, so a view react-pdf cannot lay out fails in CI instead of in a download — including
  the one failure the translator-as-a-prop rule exists to prevent, a `useI18n()` that throws inside
  the reconciler. Byte comparison would turn every deliberate design change into a failure with
  nothing to say.
- **CI (GitHub Actions):** pytest, vitest, Playwright, ruff, `mypy --strict` over `heroforge_rules/`,
  and the OpenAPI type-drift check.

## Commands

Python is managed by `uv`; the rules engine is a workspace member under `packages/`.

```
uv sync                                        # install everything, including dev tools
uv run pytest -q                               # rules engine + API (spins up PostgreSQL 16)
uv run pytest tests/test_characters.py::TestUpdate -q      # one class
uv run ruff check . && uv run ruff format --check .
uv run mypy --strict packages/heroforge-rules/src/heroforge_rules

uv run python scripts/dump_openapi.py          # refresh openapi.json
npm --prefix web run generate:api              # regenerate committed TS types
npm --prefix web run typecheck
npm --prefix web test                          # vitest
npm --prefix web run test:e2e                  # playwright, needs the stack running
npm --prefix web run build

cd web && npx shadcn@latest add <name>         # add a UI primitive; needs web/ as the cwd
```

Running the stack locally:

```
cp .env.example .env                           # then set SECRET and the database password
docker compose up -d                           # caddy + api + postgres; web builds and exits
```

Or without Docker, against a local PostgreSQL:

```
uv run alembic upgrade head
uv run uvicorn heroforge.api.app:app --port 8000
npm --prefix web run dev                       # proxies /api to :8000
```

`OGL.txt` is generated, not hand-written: `./scripts/fetch-ogl.sh` rebuilds it from the published
licence text and appends this project's Section 15 declaration. The web image build fails if it is
missing.

### Things the tests pin that are easy to undo

- The **250 ms derive** and **2 s save** debounces watch an edit counter, not the draft object. A
  fresh object identity every render makes the recompute effect re-fire forever and restarts the
  save timer each time, so the sheet never saves. `useSheet.ts` says so; a Vitest case guards it.
- `VERIFICATION_REQUIRED` applies to **both** the login route and the user dependency. Applying it
  to only one produces an account that can log in and is then refused on every request.
- **A French translation must keep its original's `{placeholders}`.** `Dictionary` cannot express
  that, so `i18n.test.ts` compares the placeholder sets key by key: `{maximum}` where English wrote
  `{max}` type-checks perfectly and renders a literal brace on screen. The same file checks the two
  dictionaries key-for-key at runtime, where an `as Dictionary` added in a hurry cannot hide.

## Licensing and naming

- The D&D 3.5 **mechanics** are used under the Open Game License 1.0a via the SRD. The application
  must ship the full OGL 1.0a text and a Section 15 declaration identifying the SRD as a source.
- Interface icons come from Game-icons.net under **CC BY 3.0**, which is a separate licence from
  the OGL and covers none of the same material. `ICONS.txt` carries that attribution; see the icons
  section above.
- **Cinzel and MedievalSharp are served from this origin, under the OFL**, which makes every
  deployment a redistributor of the font files and so obliges it to carry the notice. `FONTS.txt`
  does that, `docker/web.Dockerfile` copies it into `/dist` beside `OGL.txt` and `ICONS.txt`, and
  the footer links it. Three licences, three files, none covering any of the others.
- **The page's texture is generated, not photographed.** `web/public/leather.jpg` is written by
  `web/scripts/generate-leather-texture.mjs` from a seeded noise field — committed alongside the
  image so it is reproducible and its provenance is on the record. It is this repository's own work
  and adds no fourth licence. Do not replace it with a stock texture: the obvious sources are
  watermarked and not redistributable, and nothing is read on this surface anyway.
- **Not** covered by the OGL, and to be avoided: the "Dungeons & Dragons" name and logo, Wizards of
  the Coast trade dress, and the specific visual layout of the PHB character sheet PDF. The sheet's
  *structure* (which fields exist, how they combine) is mechanical and usable; its *design* is not
  to be reproduced.
- "HeroForge" collides with an established 3D miniature company in the adjacent tabletop market. A
  different product name is to be chosen before any brand is built. The repository directory name
  is not itself a problem.
