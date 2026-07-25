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

**Current state: the repository contains the spec and the reference PDF only.** No application code,
no build tooling, no `docker-compose.yml` exists yet.

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
- **Half ranks contribute nothing to a skill check.** `ranks` is a stored half-integer; the engine
  floors it before adding. `max_ranks` validation compares against the **unfloored** stored value.
  3½ cross-class ranks add 3. Re-read and quote the SRD wording in the test docstring.
- **`grapple_size_modifier` ≠ `ac_size`.** A Small creature has +1 AC but −4 to grapple. Separate
  columns; never conflate them.
- **`body_weight`** is the character's own weight from the identity line. **`carried_weight`** is
  derived from possessions and armour and drives encumbrance. Unrelated.
- `effective_dex_bonus` is applied to `armor_class`, `touch_ac`, **and** `flat_footed_ac` alike.
- Ability modifiers use temporary scores where present, otherwise base scores.
- The Strength carrying-capacity table is a constant inside `encumbrance.py`, not database data.
- **The engine never raises.** It is given input already validated at the Pydantic boundary.

### Phase 1 does not derive everything

`base_attack_bonus`, the three base saves, and each attack's `attack_bonus` / `damage` are
**user-entered text**, not derived. Deriving them needs class progression tables and weapon
reference data, which are phase 2+. Do not "helpfully" compute them.

Phase 2 adds class/race reference data, phase 3 structured feats, phase 4 spellcasting. Explicitly
never planned: PDF export, dice rolling, party/DM features, character sharing, a character *builder*.

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
- **API errors are RFC 7807 `application/problem+json`**, from a global exception handler.
- **Autosave failure shows a persistent banner, never a toast.** A notice that vanishes after four
  seconds is how a user loses an evening of character building.
- Normalise what the engine reasons about; JSONB for what it only stores or sums (`possessions`,
  `feats`, `special_abilities`, `languages`, `spells_raw`).

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

### React + Vite + TypeScript + TanStack Query

- The sheet is held in React local state. Each edit fires a **250 ms-debounced** `POST /api/derive`;
  persistence is a **separate 2 s-debounced** `PATCH`. Do not merge the two debounces — they exist
  for different reasons.
- TanStack Query owns server state (character list, skills, character fetch). Do not mirror server
  state into `useState`; the sheet's local draft is the deliberate exception.
- TypeScript types are generated from the OpenAPI schema by `openapi-typescript` and **committed**.
  Never hand-edit generated output and never hand-write an API type — regenerate. CI fails if the
  committed output is stale.
- `strict` TypeScript. No `any` on API boundaries.

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
- **Frontend:** Vitest for sheet components. One Playwright end-to-end test — register, create a
  character, change Dexterity, assert AC, initiative, Reflex, and a Dex-keyed skill all change.
- **CI (GitHub Actions):** pytest, vitest, Playwright, ruff, `mypy --strict` over `heroforge_rules/`,
  and the OpenAPI type-drift check.

## Commands

**No build tooling exists in the repository yet.** Once scaffolded, the commands below are what CI
runs; update this section with the real invocations as they land.

```
pytest                                  # backend + rules engine
pytest path/to/test_file.py::test_name  # single test
ruff check . && ruff format --check .
mypy --strict heroforge_rules/
npm run test        # vitest
npm run test:e2e    # playwright
npm run build
```

## Licensing and naming

- The D&D 3.5 **mechanics** are used under the Open Game License 1.0a via the SRD. The application
  must ship the full OGL 1.0a text and a Section 15 declaration identifying the SRD as a source.
- **Not** covered by the OGL, and to be avoided: the "Dungeons & Dragons" name and logo, Wizards of
  the Coast trade dress, and the specific visual layout of the PHB character sheet PDF. The sheet's
  *structure* (which fields exist, how they combine) is mechanical and usable; its *design* is not
  to be reproduced.
- "HeroForge" collides with an established 3D miniature company in the adjacent tabletop market. A
  different product name is to be chosen before any brand is built. The repository directory name
  is not itself a problem.
