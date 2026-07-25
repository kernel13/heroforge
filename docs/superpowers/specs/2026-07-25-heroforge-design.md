# HeroForge — D&D 3.5 Character Sheet Manager

**Design document — phase 1**
Date: 2026-07-25
Status: approved

## 1. Purpose

A web application for creating, storing, and maintaining D&D 3.5 character sheets, modelled on the
*Player's Handbook v3.5* character record sheet (`PHB v35 charsheet.pdf`, 2 pages).

The application does not merely digitise the paper form. It **derives** the arithmetic the paper
sheet asks you to do by hand: ability modifiers, armour class, saving throws, skill totals, grapple
modifier, initiative, and encumbrance. Deriving these values is the point of the product.

Registration is open to the public. Each user owns their characters; no sharing or DM views in
phase 1.

## 2. Scope

### In scope (phase 1)

- Public signup with email verification, login, password reset.
- Character CRUD, scoped to the owning user.
- All derived values that require **no class, race, or feat reference data**:
  ability modifiers, AC / touch AC / flat-footed AC, initiative, saving throw totals, grapple
  modifier, skill totals and maximum ranks, carried weight and encumbrance category.
- Storage of every field on both pages of the paper sheet, including fields that are not yet
  computed.
- Deployment as Docker Compose on a self-hosted VPS.

### Out of scope (later phases)

| Phase | Content |
|---|---|
| 2 | Class and race reference data: BAB progression, base save progressions, class skill lists, hit dice. Lets `base_attack_bonus` and base saves derive from class levels instead of being typed. |
| 3 | Feats and special abilities as structured, effect-bearing data. |
| 4 | Spellcasting: spells per day, bonus spells from ability scores, spell save DCs, arcane spell failure, domains. |

Explicitly **not planned**: PDF export, dice rolling, campaign/party management, DM views,
character sharing, a rules-legal character *builder* (as opposed to a sheet *manager*).

### Phase boundary rationale

Phase 1 derives everything that depends only on values the user types. `base_attack_bonus` and the
three base saves are user-entered in phase 1 because deriving them requires class progression
tables. This keeps phase 1 free of the several hundred rows of SRD data entry that phase 2 needs,
while still delivering a sheet that does real work.

## 3. Technology

| Layer | Choice | Rationale |
|---|---|---|
| API | FastAPI + Pydantic v2 | Pydantic models are a natural representation for the rules engine's inputs and outputs; OpenAPI generation drives frontend type safety. |
| Database | PostgreSQL 16 | JSONB support for the semi-structured parts of the sheet; the deployment target is a VPS the user administers. |
| ORM / migrations | SQLAlchemy 2.0 (async) + Alembic | |
| Auth | `fastapi-users` | Provides registration, email verification, password reset, and session handling. Argon2id password hashing. |
| Reference-data admin | `sqladmin` | CRUD screens over SQLAlchemy models for curating SRD reference tables without building them by hand. |
| Rules engine | Standalone pure-Python package | See §5. |
| Frontend | React + Vite + TypeScript, TanStack Query | |
| API types | `openapi-typescript` | Frontend types generated from the API's OpenAPI schema; drift is caught in CI. |
| Reverse proxy | Caddy | Automatic Let's Encrypt certificate issuance and renewal in ~5 lines of config. |
| Deployment | Docker Compose | |

### Alternatives considered

**Django + DRF + React.** `django-allauth` and the Django admin would supply the auth flows and
reference-data CRUD with less work. Rejected in favour of FastAPI on the grounds of developer
preference; `fastapi-users` and `sqladmin` close most of the gap, leaving mail templates and
rate limiting as the residual cost.

**Django + HTMX, no SPA.** One codebase, no bundler. Rejected because every recomputation becomes a
server round trip. Changing Dexterity updates AC, touch AC, flat-footed AC, initiative, Reflex, and
every Dexterity-keyed skill simultaneously; this must feel instant.

**Store-only digital form.** Rejected at the outset — deriving the arithmetic is the product.

## 4. Architecture

```
                    ┌─────────┐
   browser  ──TLS── │  caddy  │
                    └────┬────┘
                    ┌────┴──────────────────┐
                    │                       │
            static React bundle      /api/* proxy
                                            │
                                     ┌──────┴──────┐      ┌────────────┐
                                     │  api        │──────│ postgres16 │
                                     │  (uvicorn)  │      └────────────┘
                                     └─────────────┘
```

Caddy terminates TLS, serves the built React bundle, and reverse-proxies `/api/*` to uvicorn.
Alembic migrations run on api container start.

Within the api container, three layers depending only downward:

```
heroforge/api/      routers, auth, request/response schemas
        │
heroforge/db/       SQLAlchemy models, repositories, Alembic migrations
        │
heroforge_rules/    pure functions over Pydantic models — no I/O
```

`heroforge_rules/` imports nothing from FastAPI, SQLAlchemy, or the standard library's I/O modules.
It is a separately installable package. This is the load-bearing architectural decision: it makes
the entire body of D&D 3.5 arithmetic testable without a database, an HTTP client, or fixtures, and
it is what allows the stateless `/api/derive` endpoint in §7 to be fast.

## 5. The rules engine

### Module layout

```
heroforge_rules/
    models.py        CharacterInput, DerivedSheet, SkillDefinition, Warning
    abilities.py     ability_modifier
    defense.py       armor_class, touch_ac, flat_footed_ac, effective_dex_bonus
    saves.py         save_total
    combat.py        initiative, grapple_modifier
    skills.py        skill_total, max_ranks
    encumbrance.py   carried_weight, load_limits, load_category
    sheet.py         derive() — the single public entry point
```

### Formulas (phase 1)

```
ability_modifier(score)  = floor((score - 10) / 2)

effective_dex_bonus      = min(dex_mod, armor.max_dex)      when armour is equipped
                         = dex_mod                          otherwise

armor_class              = 10 + armor + shield + effective_dex_bonus
                              + ac_size + natural + deflection + misc
touch_ac                 = 10 + effective_dex_bonus + ac_size + deflection + misc
flat_footed_ac           = armor_class - max(effective_dex_bonus, 0)

initiative               = dex_mod + misc

save_total               = base + ability_mod + magic + misc + temporary
                           Fortitude→Con, Reflex→Dex, Will→Wis

grapple_modifier         = base_attack_bonus + str_mod + grapple_size_modifier + misc
                           note: grapple_size_modifier ≠ ac_size (see §6)

armor_check_penalty      = sum of check penalties of equipped armour and shield
                           stored and summed as a non-positive integer (see below)
effective_ranks          = floor(ranks)
skill_total              = effective_ranks + ability_mod + misc
                              + (armor_check_penalty if skill.armor_check_penalty)
                              + (armor_check_penalty again if skill.acp_double)   # Swim
max_ranks                = character_level + 3          class skill
                         = (character_level + 3) / 2    cross-class skill

carried_weight           = sum of possession weights + equipped armour and shield weights
load_limits              = Strength load table (see below)
load_category            = light | medium | heavy | overloaded, from carried_weight
lift_over_head           = max_load
lift_off_ground          = max_load × 2
push_or_drag             = max_load × 5
```

Ability modifiers use temporary scores where present, otherwise base scores.

The Strength carrying-capacity table (Strength 1–29) is a constant inside `encumbrance.py`, together
with the rule that each +10 Strength multiplies capacity by 4. It is small, static, and required for
the engine to function, so it does not belong in the database.

`effective_dex_bonus` is the single point where equipment and abilities interact, and it is the most
frequently mis-derived number on a hand-written sheet. It is applied to `armor_class`,
`touch_ac`, and `flat_footed_ac` alike.

### Two conventions that must not be left implicit

**Half ranks contribute nothing to the skill check.** `ranks` is stored as a half-integer, but a
half rank does not improve a skill check — it only counts toward the maximum and brings the character
closer to the next full rank. The engine therefore floors ranks before adding them, while `max_ranks`
validation compares against the *unfloored* stored value. A character with 3½ ranks in a cross-class
skill adds 3.

This is the one formula in phase 1 whose SRD wording should be re-read and quoted in the test
docstring before the implementation is written. It is the most likely source of a silent
off-by-one, and it would otherwise surface only in the golden character test.

**Armour check penalties are stored as non-positive integers.** Full plate is stored as `-5`, not
`5` — matching both the SRD armour tables and what the user writes on the paper sheet. The engine
consequently **adds** the summed penalty rather than subtracting it. The golden character carries
armour with a nonzero check penalty and asserts a Swim total, so that the sign convention and the
Swim double-penalty rule are both pinned by test.

### Entry point

```python
def derive(character: CharacterInput, skills: list[SkillDefinition]) -> DerivedSheet: ...
```

Skill definitions are **passed in**, never fetched. This preserves the engine's I/O-free property.

The API layer loads the `skills` table **once at application startup into an in-memory cache** and
supplies it to every `derive()` call. The table is roughly forty immutable rows, so caching is
trivial, and it is what allows `POST /api/derive` (§7) to touch no database at all on the
per-keystroke path. Edits made through `sqladmin` invalidate the cache.

## 6. Data model

### Reference data

Seeded from a versioned YAML file, read-only at runtime, editable through `sqladmin`.

**`skills`** — the SRD 3.5 skill list.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | text | e.g. "Move Silently" |
| `key_ability` | enum | STR / DEX / CON / INT / WIS / CHA |
| `armor_check_penalty` | bool | penalty applies |
| `acp_double` | bool | Swim only — penalty applies twice |
| `usable_untrained` | bool | the ■ marker on the paper sheet |
| `takes_specialization` | bool | Craft, Knowledge, Perform, Profession |

Phase 1 needs no class or race tables, but the skill list is stored in the database rather than as an
engine constant. The frontend must render it, and doing so establishes the reference-data pattern
that phase 2 extends without rework.

### Character data

**`users`** — the `fastapi-users` schema: `id` (UUID), `email`, `hashed_password`, `is_active`,
`is_verified`, `is_superuser`.

**`characters`** — one wide flat row mirroring the paper sheet.

| Group | Columns |
|---|---|
| Ownership | `id` UUID PK, `owner_id` FK → users, `created_at`, `updated_at`, `version` int |
| Identity | `name`, `player_name`, `race`, `alignment`, `deity`, `size`, `age`, `gender`, `height`, `body_weight`, `eyes`, `hair`, `skin` |
| Campaign | `campaign`, `experience_points` |
| Abilities | `str_score` … `cha_score`, `str_temp` … `cha_temp` (nullable) |
| Health | `hp_total`, `hp_current`, `nonlethal_damage`, `damage_reduction` |
| Combat | `speed`, `spell_resistance`, `base_attack_bonus`, `grapple_misc`, `grapple_size_modifier`, `initiative_misc` |
| Saves | `base_fortitude`, `base_reflex`, `base_will`; and for each of the three, `*_magic`, `*_misc`, `*_temporary` (twelve columns in total); plus `saves_conditional_modifiers` text — the free-text box beside SAVING THROWS on page 1 |
| AC components | `ac_natural`, `ac_deflection`, `ac_size`, `ac_misc` (armour and shield bonuses come from `character_armor`) |

Two naming clarifications that prevent genuine confusion:

- **`body_weight`** is the character's own weight from the identity line of the sheet. It is unrelated
  to `carried_weight`, which is derived from possessions and armour and drives encumbrance.
- **`grapple_size_modifier`** is distinct from `ac_size`. In 3.5 the special size modifier applied to
  grapple checks is not the same value as the size modifier applied to armour class — a Small
  creature has +1 AC but −4 to grapple. They are separate columns and must not be conflated.
| Money | `money_cp`, `money_sp`, `money_gp`, `money_pp` |
| JSONB | `possessions`, `feats`, `special_abilities`, `languages`, `spells_raw` (shapes in §6.3) |

**`character_class_levels`** — `character_id`, `class_name` (text), `level` (int). Free text in phase
1; becomes a foreign key to a `classes` table in phase 2. The sum of `level` is the character level
that drives `max_ranks`.

**`character_skills`**

| Column | Notes |
|---|---|
| `skill_id` | FK → skills, nullable |
| `custom_name` | nullable — the blank rows at the bottom of the sheet |
| `specialization` | nullable — the parenthesised blank in Craft ( ___ ) |
| `ranks` | `NUMERIC(4,1)` |
| `misc_modifier` | int |
| `is_class_skill` | bool — user-set in phase 1, derived from class in phase 2 |

Exactly one of `skill_id` and `custom_name` is non-null; enforced by a check constraint.

**Row creation is eager.** `POST /api/characters` inserts one `character_skills` row per SRD skill,
zeroed. Lazy creation on first edit would mean the list endpoint and the sheet component each need
to reconcile the stored rows against the reference list and synthesise the missing ones, in two
places, forever. Forty rows per character is nothing, and the sheet displays all of them regardless.
Rows for skills that take a specialization (Craft, Knowledge, Perform, Profession) are created to
match the paper sheet's repeat count, and further ones can be added by the user.

`ranks` is stored as the displayed half-integer value rather than as skill points spent. Cross-class
ranks are genuinely half-integers in 3.5 and the paper sheet asks you to write "3½"; storing the
displayed value keeps the engine simple and matches user expectation.

**`character_armor`** — `character_id`, `slot` enum (`armor` / `shield` / `protective_1` /
`protective_2`), `name`, `type`, `ac_bonus`, `max_dex`, `check_penalty`, `spell_failure`, `speed`,
`weight`, `special_properties`. Normalised rather than JSONB because it feeds `armor_class`,
`effective_dex_bonus`, `armor_check_penalty`, and `carried_weight`.

**`character_attacks`** — the five attack blocks on page 1 of the sheet.

| Column | Notes |
|---|---|
| `character_id` | FK → characters |
| `ordinal` | int, display order |
| `name` | weapon or attack name |
| `attack_bonus` | text — entered by the user, not derived in phase 1 |
| `damage` | text, e.g. "1d8+3" |
| `critical` | text, e.g. "19–20/×2" |
| `range` | text |
| `damage_type` | text, e.g. "slashing" |
| `notes` | text |
| `ammunition` | text |

`attack_bonus` and `damage` are stored as text and are **not derived in phase 1**. Deriving them
requires weapon reference data, size modifiers, Strength application rules that differ for thrown
and two-handed weapons, and iterative attacks from BAB — all of which depend on phase 2 and later.
The fields are typed by the user, exactly as on paper, and the rows are otherwise stored verbatim.

### 6.3 Normalised versus JSONB

The rule applied throughout: **normalise what the engine reasons about, use JSONB for what it only
stores or sums.**

- `possessions` — JSONB array of `{item, page, weight}`. Only ever summed.
- `feats`, `special_abilities` — JSONB arrays of `{name, page}`. The paper sheet has a **PG.** column
  beside both, for the rulebook page reference; objects rather than bare strings preserve it at no
  cost. Feats become a structured table in phase 3, when they start carrying mechanical effects.
- `languages` — JSONB array of strings.
- `spells_raw` — JSONB. Not computed in phase 1; stored verbatim so that page-2 data entered by the
  user is not lost while spellcasting waits for phase 4.

## 7. API and data flow

### Endpoints

```
POST   /api/auth/register            fastapi-users
POST   /api/auth/verify
POST   /api/auth/login
POST   /api/auth/forgot-password
POST   /api/auth/reset-password

GET    /api/skills                   reference data

POST   /api/derive                   stateless: character payload → DerivedSheet. Persists nothing.
                                     Requires an authenticated session and is rate-limited.

GET    /api/characters               list, owned by current user
POST   /api/characters               create
GET    /api/characters/{id}          → {character, derived}
PATCH  /api/characters/{id}          → {character, derived}
DELETE /api/characters/{id}
```

### Live recomputation

React holds the sheet in local state. Each edit fires a 250 ms-debounced `POST /api/derive`, which
performs no database access — skill definitions come from the startup cache described in §5 — and
returns in single-digit milliseconds. Persistence is a separate 2 s-debounced `PATCH`.

`/api/derive` is unauthenticated compute on a publicly registrable application, so it requires a
valid session and carries a generous per-session `slowapi` rate limit: high enough never to
interfere with typing, low enough not to serve as free compute.

Changing Dexterity from 14 to 16 therefore updates AC, touch AC, flat-footed AC, initiative, the
Reflex save, and every Dexterity-keyed skill in one response.

### No rules arithmetic in the frontend

The React application performs **no** rules math — not even `Math.floor((score - 10) / 2)`. Once a
formula exists in both Python and TypeScript the two implementations drift, producing values that
are correct on one screen and wrong on another. Every derived number displayed comes from a
`DerivedSheet`.

TypeScript types are generated from the OpenAPI schema by `openapi-typescript` and committed; CI
regenerates them and fails if the committed output is stale.

## 8. Error handling

| Concern | Handling |
|---|---|
| Input validation | At the Pydantic boundary: ability scores 1–99, ranks ≥ 0, weights ≥ 0, levels ≥ 1. The engine itself never raises — it is given validated input. |
| Rules violations | Ranks exceeding maximum, or a Dexterity bonus exceeding armour's `max_dex`, are returned as **warnings on `DerivedSheet`, not errors**. House rules and homebrew are normal play; the application reports, it does not refuse. |
| Ownership | Every character route filters by `owner_id`. A character belonging to another user returns **404, not 403** — a 403 confirms the identifier exists. |
| Concurrent edits | `version` column on `characters`; a `PATCH` carrying a stale version returns 409. One character open in two browser tabs is a realistic scenario. |
| API error format | RFC 7807 `application/problem+json`, emitted by a global exception handler. |
| Autosave failure | A persistent "unsaved changes" banner, never a transient toast. A notification that disappears after four seconds is how a user loses an evening of character building. |
| Auth | Argon2id hashing; httpOnly + Secure + SameSite=Lax session cookies; email verification required before first login; `slowapi` rate limits on register, login, and password reset; CORS restricted to the deployment origin. |

## 9. Testing

**Rules engine.** Pure unit tests using `@pytest.mark.parametrize` tables, written test-first. The
formulas are specified in advance by the SRD, so there is no design uncertainty to resolve before
writing the test.

The anchor is a **golden character**: one fully worked level-7 multiclass character with armour, a
shield, cross-class skill ranks, and a carried weight near the medium/heavy boundary, with every
derived value on the sheet asserted. It catches composition errors that per-function tests miss —
for instance, `effective_dex_bonus` being applied to `armor_class` but not to `touch_ac`.

**API.** pytest with `httpx.AsyncClient` against a real PostgreSQL instance via testcontainers, each
test wrapped in a rolled-back transaction. Required cases: register → verify → login; an unverified
user cannot log in; user A receives 404 for user B's character; a stale `version` produces 409.

**Frontend.** Vitest for sheet components. One Playwright end-to-end test: register, create a
character, change Dexterity, and assert that AC, initiative, the Reflex save, and a Dexterity-keyed
skill all change. That single test exercises the whole stack.

**CI.** GitHub Actions running pytest, vitest, Playwright, ruff, `mypy --strict` over
`heroforge_rules/`, and the OpenAPI type-drift check.

## 10. Deployment

`docker-compose.yml` with four services: `caddy`, `api`, `web` (build stage producing static files),
and `postgres:16`.

- Secrets supplied through `.env`, never baked into images. `.env.example` is committed.
- Named volume for PostgreSQL data.
- Nightly `pg_dump` to a host directory. A character sheet represents months of play and exists
  nowhere else; losing the volume without a dump is unrecoverable.
- Alembic migrations run on api container start.

## 11. Licensing and naming

The D&D 3.5 **mechanics** used here are available under the Open Game License 1.0a via the System
Reference Document. Consequently the application must ship the full OGL 1.0a text and a Section 15
declaration identifying the SRD as a source.

Not covered by the OGL, and therefore to be avoided: the "Dungeons & Dragons" name and logo,
Wizards of the Coast trade dress, and the specific visual layout of the PHB character sheet PDF.
The sheet's *structure* (which fields exist, how they combine) is mechanical and usable; its
*design* is not to be reproduced.

**Naming.** "HeroForge" is the name of an established 3D miniature company (heroforge.com) operating
in the adjacent tabletop market. This is harmless for a private tool but is a genuine trademark
exposure for a publicly registrable application. A different product name should be chosen before
any brand is built around this one. The repository directory name is not itself a problem.
