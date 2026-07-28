# HeroForge backend — lessons memory

**Resume at:** P.1 — Module P added 2026-07-27 and not yet started. Next action: deliver P.1.
**L0.1 is parked, not dropped.** It was delivered and its six questions posed; the answers are
still outstanding. Those same six questions are **re-posed at the end of Module P**, unchanged,
where PEP 563 and `Annotated` will land on ground P has already laid. Nothing about the M0–M7
syllabus changed except one citation fix in L0.1's row.
**Practice repo:** not yet created (see B0). Expected at `~/Documents/01-Projects/recipedesk`.
**Build state:** B0 not started. Tests green? n/a.

This file is the durable state of a guided course on the HeroForge Python backend. It survives
between sessions: to restart, read the three lines above, then the two progress tables, then the
notebook entry for the last lesson.

---

## What this course is for

The goal is not "understand this repository." It is **being able to build this application from
an empty directory** — and, more usefully, to build the next one like it. So every lesson has two
halves:

- **Concept** — the transferable thing. Async Python, relational modelling, cookie security,
  optimistic locking. Knowledge you carry to a codebase that has never heard of D&D.
- **Code** — where HeroForge does it, quoted from the real file, with the line reference. The
  concept is never taught in the abstract; there is always a line in this repo to point at.

Then a **quiz**, and at the end of each module a **build step** on your own app.

---

## The two tracks

### Track 1 — Lessons (39 lessons, 237 quiz questions)

Read the repository, module by module, with the underlying computer science and web engineering
taught alongside it.

### Track 2 — Build (8 steps, B0–B7)

You rebuild the *same architecture* in your own repository — pure derivation core → repository
layer → FastAPI → tests → CI — on a deliberately trivial domain so the domain is never the
lesson and nothing can be copy-pasted from HeroForge.

**The practice app is `RecipeDesk`.** A recipe sheet that derives arithmetic the cook would
otherwise do by hand. It maps onto HeroForge one-for-one, which is the point:

| HeroForge | RecipeDesk |
|---|---|
| `skills` reference table, seeded from YAML, cached at startup | `ingredients` reference table (kcal/100g, `name_fr`), same treatment |
| `characters` owned by a user, `version` counter, JSONB notes | `recipes`, identical treatment |
| `character_skills` normalised rows | `recipe_ingredients` normalised rows |
| `heroforge_rules.derive()` — AC, saves, skill totals | `recipedesk_rules.derive()` — scaled quantities, per-serving nutrition, total cost |
| `RuleWarning` — ranks over maximum | `RuleWarning` — batch exceeds pan capacity |
| portrait, outside the versioned document | photo, outside the versioned document |

Same shapes, no shared arithmetic. If you can build RecipeDesk unaided, you can rebuild HeroForge.

---

## How this course runs (the protocol)

1. **Lesson.** One per turn: Concept, then Code with file and line references, then the quiz.
2. **Quiz — a fixed mix, not just recall.** Every lesson's questions are drawn from these five
   kinds, and each lesson contains **at least one write-it**:

   | Kind | What it tests | Typical count |
   |---|---|---|
   | Recall | the lesson was read | 2 |
   | Predict-the-failure | *"what breaks if you drop `selectinload()` here?"* | 2 |
   | Read-the-snippet | code shown cold; say what it does | 1 |
   | **Write-it** | *"write the `mapped_column` for a version counter with optimistic locking"* | **1+** |
   | Design | *"where would you put X, and why not in the other place?"* | 0–1 |

   The write-it questions are what separate "I followed the lesson" from "I could rebuild this."
3. **You answer** in your own words. Partial answers are fine; grading is diagnostic, not a gate.
4. **Grading** goes in the notebook below, with the right answer for anything missed, so a re-read
   months later still teaches.
5. **Build step** at the end of each module — a slice of RecipeDesk. Its state is tracked in its
   own table, including whether its tests are green.
6. **Advance** — the three header lines and both progress tables are updated in the same turn.

At any point you may say:

- *"go deeper on X"* — a sub-lesson is inserted and recorded as e.g. `L4.3a`.
- *"skip this"* — marked `skipped`, never silently dropped.
- *"quiz me again on M4"* — a mixed quiz drawn from the whole module.
- *"just show me"* — the build step is done for you and read as a worked example instead.
- *"stop"* — the header lines are written and the session ends cleanly.

**Ground rule for the lesson writer:** `CLAUDE.md` already states this project's invariants in
prose. A lesson never paraphrases it. It cites the rule in one line, then spends its length on the
concept behind it, the code that implements it, and the test that pins it.

---

## Scale

39 lessons · 237 quiz questions · 8 build steps, over ~5,990 lines of Python in 54 files.

**Realistic total: 46–70 hours** including the build track. That is a decision to make now rather
than at lesson 20 — say if you want it scaled down. The two obvious cuts are dropping Track 2
(halves it) or dropping M0 if you already write typed async Python daily. Module P adds roughly
6–10 hours and has no build step of its own.

---

## Syllabus

### Module P — The Python between "I can code" and this codebase (8 lessons, 48 questions)

**Added 2026-07-27, at the learner's request.** The brief, in their words: *how to import a
library, understand the main libraries used, and anything more advanced used in the code.* The
starting point they gave is classes, functions, loops and conditionals — so P assumes those and
teaches only what sits between them and M0.

**How P was chosen — a census of the tree, not a tutorial's table of contents.** 54 files, 5,986
lines. What the code actually contains decided what is taught and, just as much, what is cut:

| Feature | Count | Verdict |
|---|---|---|
| `def` / `async def` | 320 / 137 | P.3 — the whole codebase is functions |
| `class` | 118 | P.4 — but see the next two rows |
| `__init__` / `super()` | 6 / 2 | **a class here is a declaration, not an object with behaviour** |
| list comprehensions vs `for` loops | 32 / 26 | P.6 — comprehension is the default idiom here |
| `with` | 41 | P.7 |
| `**` unpacking | 47 | P.3 |
| `raise` / `except` | 25 / 1 | P.7 — this tree raises at boundaries and catches almost nowhere |
| `Decimal(` | 25 | P.8 — load-bearing for weight; a `float` here is a bug |
| `//` floor division | 15 | P.8 — it *is* `max_ranks` |
| `assert` | 294 | P.6/P.8 — every test you will read is built from it |
| `@staticmethod`, `@classmethod`, `dataclass`, `Protocol`, `TypeVar`, `Generic`, `abstractmethod` | **0 each** | **cut.** Not in this codebase; a paragraph each at most |

That last row is the point of doing a census. A generic intermediate-Python course would spend
three lessons on class hierarchies, ABCs and generics, and none of it appears here.

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| P.1 | **Modules, packages and `import`** | what a module *is* (an object, executed once, cached in `sys.modules`); `import x` vs `from x import y` vs `import x as y`; absolute vs relative; what `__init__.py` does and what a package's public surface means; `sys.path` and why `import heroforge_rules` resolves at all; the `src/` layout; circular imports and how the future import dodges some of them; `if __name__ == "__main__"` | `heroforge_rules/__init__.py`, the 23-line import block at `api/app.py:1–23` read line by line, `scripts/dump_openapi.py` | 6 |
| P.2 | **Field guide to the dependency list** | how to read a dependency you have never met; framework vs library vs driver vs plugin; runtime deps vs dev deps and why the split is a security decision, not tidiness; transitive dependencies; **a one-paragraph map of every third-party name in the tree** — fastapi, starlette, pydantic, pydantic-settings, sqlalchemy, asyncpg, psycopg, alembic, fastapi-users **and the separately distributed
`fastapi_users_db_sqlalchemy` imported at `db/models.py:15–16`**, pwdlib/argon2, sqladmin, slowapi/limits, uvicorn, pyyaml, aiosmtplib, and the dev set (pytest, pytest-asyncio, httpx, testcontainers, asgi-lifespan, ruff, mypy). **This is the map, not the territory** — M1 owns Pydantic, M3 FastAPI, M4 SQLAlchemy, M5 fastapi-users, M6 pytest. P.2 exists so those modules do not open on an unfamiliar name | `pyproject.toml` dependency block against the import census | 5 |
| P.3 | **Functions beyond the basics** | default arguments and the mutable-default trap; positional vs keyword; `*` and keyword-only parameters as an API safety device; `**kwargs` and `**` dict unpacking (47 sites); returning a value vs mutating an argument; what makes a function *pure* and why that word will keep coming back | `skills.py` — `skill_total(*, ranks, …)` and `max_ranks(level, *, is_class_skill)`; `Field(default_factory=list)` at `models.py:208` as the trap avoided | 6 |
| P.4 | **Classes that are mostly declarations** | class body vs instance; class attributes vs instance attributes; `self`; `@property` as a computed attribute (`character_level`, `models.py:231`); **dunder methods** — `__getitem__`, `__init__`, `__enter__`; inheritance used as a *mixin* rather than a hierarchy; why 118 classes need only 6 `__init__`s once a library generates them for you | `models.py` `AbilityScores` / `DerivedAbilities.__getitem__` (`:273`), `db/models.py:38` `User(SQLAlchemyBaseUserTableUUID, Base)` | 7 |
| P.5 | **Decorators** | a function that takes a function and returns one; what `@` actually does; decorators that take arguments and the extra layer that implies; decorators that *register* rather than wrap (`@app.get`) vs those that *transform* (`@asynccontextmanager`); stacking; why the object you get back may not be the function you wrote | `@app.get("/api/health")` at `app.py:78`, `@model_validator(mode="after")` at `models.py:196`, `@pytest.mark.parametrize` (11 sites), `@asynccontextmanager` at `app.py:26`, `@lru_cache`, `@property` | 6 |
| P.6 | **Iteration, comprehensions and generators** | iterable vs iterator; what a `for` loop desugars to; list, dict and set comprehensions; **generator expressions and laziness** — and why `total_ranks(row.ranks for row in derived_skills)` needs no brackets; `yield`; `sum`/`min`/`max`/`any`/`all` over an iterable; when a comprehension is clearer than a loop and when it stops being | `sheet.py:123, 128, 138, 171` — four different iteration idioms within fifty lines | 6 |
| P.7 | **Context managers and exceptions** | `with` as a *protocol* (`__enter__`/`__exit__`), not a keyword for files; `contextmanager` / `asynccontextmanager`; acquiring and releasing something that must be released; exceptions as control flow; raising at a boundary; **`raise` 25 against `except` 1** and what that ratio says about who is responsible for handling failure; exception types as data | the 41 `with` sites, `SkillEntry.exactly_one_identity`'s `raise`, `api/problems.py`, the lifespan at `app.py:26–36` | 6 |
| P.8 | **The standard library this repo leans on** | `decimal.Decimal` vs `float` — binary floating point, why 0.1 + 0.2 is not 0.3, and why a weight in this app must not be a `float`; `//` floor division and integer division semantics; `enum` and `StrEnum`; `datetime` and the timezone-aware/naive split; `uuid` and why an id is a UUID here rather than an auto-increment; `pathlib`; `collections.abc` as the *typing* vocabulary (`Iterable`, `AsyncIterator`); `functools.lru_cache` | `encumbrance.py`, `max_ranks`'s `ceiling // 2`, `models.py:17–52`, `db/models.py` timestamps and UUID keys | 6 |

**→ No build step.** P is reading and reasoning; B0 remains the first thing you build, after M0.

**Where P stops.** Anything typed (`Annotated`, `Mapped[…]`, `Self`, `--strict`) is **L0.1's**, and
anything `async` is **L0.2's**. P.5 and P.7 will show `async def` and `await` on the page because
the real lines carry them; they get one sentence — "this is a coroutine, L0.2 explains it" — and
the lesson moves on. P teaches the *shape*, M0 teaches the *type system and the event loop*.

---

### M0 — Foundations: the Python this repo is written in (4 lessons, 23 questions)

Every concept here is anchored to a line already in the repository — this module is not a generic
Python tutorial.

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| L0.1 | **Modern typed Python** | annotations as a design tool; `Annotated`; `Self`; `ClassVar`; `StrEnum`; `from __future__ import annotations` and what it actually defers; how `mypy --strict` changes the way you write. *(Corrected 2026-07-27: this row promised `Protocol` and generics, of which the tree contains none — `TypeVar`, `Generic`, `Protocol` are all zero-count. Naming a feature the codebase does not use would have broken the module's own "not a generic Python tutorial" rule, and the delivered lesson taught `Self`/`ClassVar`/`StrEnum` instead.)* | `api/app.py:3`, `Mapped[...]` in `db/models.py`, `Annotated` constraints in `heroforge_rules/models.py` | 6 |
| L0.2 | **Async Python** | coroutines vs threads; the event loop; `await`; `AsyncIterator`; `asynccontextmanager`; why one blocking call stalls every concurrent request; structured concurrency | the `lifespan` signature in `api/app.py:26`, `async def` routes, the session-scoped event-loop comment in `pyproject.toml` | 7 |
| L0.3 | **Packaging, workspaces and tooling** | `pyproject.toml` as the single manifest; `src/` layout and why; editable installs; dependency groups vs optional-dependencies; lockfiles; `uv` | `[tool.uv.workspace]`, `[tool.uv.sources]`, `[tool.hatch.build.targets.wheel]`, `uv.lock` | 5 |
| L0.4 | **Architecture: pure core, imperative shell** | dependency direction; why the testable half must not import the I/O half; functional core patterns; what you give up | the three-layer diagram made real — `heroforge_rules/__init__.py` as the published surface, and the import rule that keeps it honest | 5 |

**→ B0 — Scaffold.** A two-package uv workspace that installs, lints, and type-checks clean, with
one empty pure function and one failing test. Nothing else.

---

### M1 — Data modelling with Pydantic v2 (3 lessons, 19 questions)

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| L1.1 | **Pydantic v2 mechanics** | parse-don't-validate; `BaseModel`; `Annotated[int, Field(ge=…)]` constraint types; `field_validator` vs `model_validator(mode="after")`; `ConfigDict`; serialisation; what changed from v1 and why the old spellings are banned here | `heroforge_rules/models.py` | 7 |
| L1.2 | **Validation strategy** | where validation belongs; boundary vs core; the difference between an *error* (refuse) and a *warning* (report) and how that choice shapes an API | ranks ≥ 0 refused at the boundary; ranks over maximum reported as a `RuleWarning` | 6 |
| L1.3 | **The engine's model surface** | input models vs output models; making illegal states unrepresentable; why "the engine never raises" is a contract, not an optimisation | `CharacterInput`, `DerivedSheet`, `SkillEntry`, `SkillDefinition`, `RuleWarning` | 6 |

**→ B1 — RecipeDesk's models.** `RecipeInput`, `IngredientDefinition`, `DerivedRecipe`,
`RuleWarning`, with constraints at the boundary and a test proving bad input is refused there.

---

### M2 — The rules engine (4 lessons, 24 questions)

Pure Python and Pydantic. No FastAPI appears in this module at all — it is in scope because it is
the backend's load-bearing half and the reason the rest is testable.

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| L2.1 | **Small pure functions** | one function, one rule; total functions; composition over conditionals; sign conventions as a design decision | `abilities.py`, `defense.py` (incl. the `max(…, 0)` at `defense.py:73`), `saves.py`, `combat.py` | 6 |
| L2.2 | **Skills** | keyword-only parameters with no default as an API safety device; integer domains; when a "helpful" default is a bug generator | `skills.py` — `max_ranks(level, *, is_class_skill)`, whole ranks, non-positive check penalties, `acp_double` | 7 |
| L2.3 | **Encumbrance** | lookup tables as code vs data, and how to decide; interpolation; boundary conditions | `encumbrance.py` — the Strength table as a module constant | 5 |
| L2.4 | **Composition and locale-free output** | the single public entry point; assembling a result object; **structured warnings** — emitting `code` + `params` tokens instead of prose, so translation is the client's problem | `sheet.py` — `derive()`; `RuleWarning.params` | 6 |

**→ B2 — RecipeDesk's engine, test-first.** Scaling, per-serving nutrition, one warning with
structured params. Written from the tests outward.

---

### M3 — HTTP, ASGI and FastAPI (4 lessons, 24 questions)

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| L3.1 | **The HTTP you need** | methods and their semantics; safety and idempotency; `PATCH` vs `PUT` and why this app chose `PATCH`; status codes that carry meaning; content types; what a *resource* is | the route table as a design artefact | 6 |
| L3.2 | **ASGI, the app object, dependency injection** | what ASGI is and how uvicorn drives it; routers; the `lifespan` protocol and why startup work goes there and not at import time; `Depends()` as constructor injection; `pydantic-settings` for configuration; structured logging | `api/app.py`, `config.py`, `logging.py` | 7 |
| L3.3 | **Schemas, response models, OpenAPI as contract** | request vs response models; composing shared models rather than duplicating fields; treating the generated schema as a **build input** for the client, not documentation | `api/schemas.py`, `routers/derive.py`, `openapi.json` | 6 |
| L3.4 | **Errors as data** | RFC 7807 `application/problem+json`; global exception handlers; why an error body needs a stable machine-readable shape | `api/problems.py`, `schemas.Problem` | 5 |

**→ B3 — RecipeDesk's API skeleton.** `POST /api/derive` + `GET /api/ingredients`, lifespan-loaded
cache, injected settings, problem+json handler. No database yet.

---

### M4 — Relational data and SQLAlchemy 2.0 (5 lessons, 32 questions)

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| L4.1 | **Relational modelling** | keys and foreign keys; normal forms in practice; **when a JSONB column is right and when it is laziness**; constraints as the last line of defence; indexes; nullability as a modelling statement | `db/models.py` — normalised `character_skills` vs JSONB `possessions`/`feats`; the check constraint that exactly one of `skill_id`/`custom_name` is non-null | 6 |
| L4.2 | **Transactions and concurrency** | ACID; isolation levels; the unit-of-work pattern; session lifetime; **optimistic locking** and why a version counter beats a lock for a document a user edits over an evening | one session per request, commit at the edge; the `version` column and the 409 it produces | 6 |
| L4.3 | **SQLAlchemy 2.0 declarative and async** | ORM vs data mapper; `Mapped[...]` / `mapped_column()`; relationships and cascades; `create_async_engine`, `async_sessionmaker`, connection pooling; the asyncpg driver | `db/base.py`, `db/session.py`, `db/models.py` | 7 |
| L4.4 | **Querying without footguns** | `select()` + `scalars()` (never the legacy `Query`); **the N+1 problem**; eager loading strategies and how `selectinload` differs from `joinedload`; why implicit lazy loading is impossible under asyncio and what `MissingGreenlet` is really telling you; `deferred` columns | `db/repositories.py` | 7 |
| L4.5 | **Migrations and seed data** | schema evolution as versioned code; autogenerate and what it silently misses; reversible migrations; data migrations vs schema migrations; reference data as a versioned file, not a fixture | `alembic.ini`, `migrations/env.py`, the four revisions read as a history, `db/seed.py`, `db/seeds/skills.yaml` | 6 |

**→ B4 — RecipeDesk's persistence.** Schema, migrations, repository, seeded reference data, and a
test that proves a stale version raises a conflict.

---

### M5 — Authentication and the API surface (4 lessons, 26 questions)

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| L5.1 | **Web authentication, from first principles** | password hashing (why Argon2id, not SHA-anything); sessions vs bearer tokens; cookie flags — `httpOnly`, `Secure`, `SameSite` — and the attack each one stops; CSRF; email verification flows; rate limiting as an auth control | the cookie configuration and the verification requirement | 7 |
| L5.2 | **Wiring `fastapi-users`** | adopting an auth library without surrendering to it; the user manager; transport and strategy; **`VERIFICATION_REQUIRED` applied to both the login route and the current-user dependency**, and the broken account you get from applying it to only one; sending mail asynchronously | `api/auth.py`, `mail.py` | 6 |
| L5.3 | **The characters router** | **IDOR** and why another user's resource must 404 rather than 403; filtering by owner in the query rather than checking after the fetch; conflict detection on write; sub-resources that sit outside the versioned document, and the cache-busting that follows | `routers/characters.py`, `api/schemas.py` | 7 |
| L5.4 | **Reference data, caching, admin, and edge controls** | read-through vs load-at-startup caches; **cache invalidation on write**; admin interfaces over reference tables; rate limiting a compute endpoint without interfering with typing; CORS as a *browser* mechanism and what it does not protect. Includes a real before/after: commit `2e820b6`, an authentication bypass in this admin | `routers/skills.py`, `skills_cache.py`, `admin.py`, `rate_limit.py` | 6 |

**→ B5 — RecipeDesk's auth and owned resources.** Registration, verification, login, recipes owned
by their creator, 404-not-403 proven by test, 409 on stale version.

---

### M6 — Testing (4 lessons, 25 questions)

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| L6.1 | **Testing craft** | the test pyramid and its critics; unit vs integration vs end-to-end; test doubles and when a mock lies to you; **what is worth pinning and what is churn**; test-first where the spec exists in advance | why the engine is tested exhaustively and the routers are tested at the seams | 6 |
| L6.2 | **pytest mechanics** | fixtures, scope, and teardown; `conftest.py` resolution; `@pytest.mark.parametrize` tables; shared fixture modules; `pytest-asyncio` modes; the event-loop scope trap; turning warnings into errors | `pyproject.toml` pytest config, `packages/heroforge-rules/tests/conftest.py`, `srd.py`, and the five parametrized engine test modules | 7 |
| L6.3 | **Golden and characterisation tests** | what a single fully worked example catches that a hundred unit tests miss; how to choose the example (every branch on the boundary); the maintenance cost and how to keep it honest | `test_golden_character.py` — 435 lines and the design behind them | 5 |
| L6.4 | **Integration testing against real infrastructure** | containers over mocks — testcontainers; **transaction rollback as test isolation** and how it beats truncating tables; driving an ASGI app in-process with `httpx`; `asgi-lifespan`; making a suite that is fast *and* real | `tests/conftest.py`, `test_auth.py`, `test_characters.py`, `test_derive.py`, `test_admin.py`, `test_skills_reference.py` | 7 |

**→ B6 — RecipeDesk's suite.** Engine tests, a golden recipe, containerised API tests with
rollback isolation. Green.

---

### M7 — Quality gates and delivery (3 lessons, 16 questions)

| # | Title | Concept | Code | Q |
|---|---|---|---|---|
| L7.1 | **Static quality gates** | linting vs formatting vs type checking; what `--strict` buys and costs; per-file ignores as documented exceptions rather than surrender; **generated artefacts checked into git and verified in CI** — the type-drift check | `[tool.ruff]`, `[tool.mypy]`, `scripts/dump_openapi.py`, the drift check | 5 |
| L7.2 | **Continuous integration** | what belongs in CI and what belongs in a pre-commit hook; caching dependencies; matrix builds; jobs that must run services; making a red build legible | `.github/workflows/` | 5 |
| L7.3 | **Deployment** | containerising a Python service; multi-stage builds; a reverse proxy terminating TLS; **migrations on container start** and how that goes wrong at scale; secrets from the environment, never in an image; backups for data that exists nowhere else | `docker-compose.yml`, `docker/api.Dockerfile`, `Caddyfile`, `.env.example`, the nightly `pg_dump`, `scripts/grant_superuser.py`, `scripts/fetch-ogl.sh` | 6 |

**→ B7 — Ship RecipeDesk.** Dockerised, migrations on start, CI green, quality gates enforced.

---

## Progress — lessons

| # | Lesson | Q | Status | Score | Notes |
|---|---|---|---|---|---|
| P.1 | Modules, packages and `import` | 6 | pending | — | |
| P.2 | Field guide to the dependency list | 5 | pending | — | |
| P.3 | Functions beyond the basics | 6 | pending | — | |
| P.4 | Classes that are mostly declarations | 7 | pending | — | |
| P.5 | Decorators | 6 | pending | — | |
| P.6 | Iteration, comprehensions, generators | 6 | pending | — | |
| P.7 | Context managers and exceptions | 6 | pending | — | |
| P.8 | The standard library this repo leans on | 6 | pending | — | |
| L0.1 | Modern typed Python | 6 | taught | — | delivered 2026-07-27; **quiz parked, re-posed after P.8** |
| L0.2 | Async Python | 7 | pending | — | |
| L0.3 | Packaging, workspaces, tooling | 5 | pending | — | |
| L0.4 | Pure core, imperative shell | 5 | pending | — | |
| L1.1 | Pydantic v2 mechanics | 7 | pending | — | |
| L1.2 | Validation strategy | 6 | pending | — | |
| L1.3 | The engine's model surface | 6 | pending | — | |
| L2.1 | Small pure functions | 6 | pending | — | |
| L2.2 | Skills | 7 | pending | — | |
| L2.3 | Encumbrance | 5 | pending | — | |
| L2.4 | Composition, locale-free output | 6 | pending | — | |
| L3.1 | The HTTP you need | 6 | pending | — | |
| L3.2 | ASGI, app object, DI | 7 | pending | — | |
| L3.3 | Schemas, OpenAPI as contract | 6 | pending | — | |
| L3.4 | Errors as data | 5 | pending | — | |
| L4.1 | Relational modelling | 6 | pending | — | |
| L4.2 | Transactions and concurrency | 6 | pending | — | |
| L4.3 | SQLAlchemy declarative and async | 7 | pending | — | |
| L4.4 | Querying without footguns | 7 | pending | — | |
| L4.5 | Migrations and seed data | 6 | pending | — | |
| L5.1 | Web auth from first principles | 7 | pending | — | |
| L5.2 | Wiring fastapi-users | 6 | pending | — | |
| L5.3 | The characters router | 7 | pending | — | |
| L5.4 | Reference data, cache, admin, edge | 6 | pending | — | |
| L6.1 | Testing craft | 6 | pending | — | |
| L6.2 | pytest mechanics | 7 | pending | — | |
| L6.3 | Golden and characterisation tests | 5 | pending | — | |
| L6.4 | Integration testing | 7 | pending | — | |
| L7.1 | Static quality gates | 5 | pending | — | |
| L7.2 | Continuous integration | 5 | pending | — | |
| L7.3 | Deployment | 6 | pending | — | |

Status values: `pending` · `taught` (delivered, quiz unanswered) · `quizzed` (answered, awaiting
grade) · `passed` · `skipped`.

## Progress — build (RecipeDesk)

| # | Build step | Depends on | Status | Tests green? | Notes |
|---|---|---|---|---|---|
| — | *(Module P has no build step — deliberately, not an omission. P is reading; B0 is the first thing built.)* | — | n/a | n/a | |
| B0 | Scaffold: uv workspace, lint + typecheck clean | M0 | not started | n/a | |
| B1 | Models with boundary validation | M1 | not started | n/a | |
| B2 | Pure engine, test-first | M2 | not started | n/a | |
| B3 | API skeleton: derive + reference, no DB | M3 | not started | n/a | |
| B4 | Persistence: schema, migrations, repository | M4 | not started | n/a | |
| B5 | Auth and owned resources | M5 | not started | n/a | |
| B6 | Full test suite incl. containers | M6 | not started | n/a | |
| B7 | Dockerised, CI green | M7 | not started | n/a | |

Status values: `not started` · `in progress` · `done` · `skipped`.

---

## Coverage map

Every backend `.py` and config file, and the lesson that owns it. Nothing is unassigned.

**Module P owns no file.** Its lessons *cite* lines from across the tree — `skills.py` for
keyword-only parameters, `sheet.py` for comprehensions, `app.py` for decorators and `with` — but
ownership stays where this map puts it, and every one of those files is taught properly by the
module that owns it. Do not "fix" this map by reassigning a file to a P lesson: P teaches a
language feature that happens to appear there; M2 teaches what the file is *for*.

| File | Lesson |
|---|---|
| `pyproject.toml` (workspace, build, deps), `uv.lock` | L0.3 |
| `pyproject.toml` (`[tool.ruff]`, `[tool.mypy]`) | L7.1 |
| `pyproject.toml` (`[tool.pytest.ini_options]`) | L6.2 |
| `heroforge_rules/__init__.py` | L0.4 |
| `heroforge_rules/models.py` | L1.1, L1.3 |
| `heroforge_rules/abilities.py`, `defense.py`, `saves.py`, `combat.py` | L2.1 |
| `heroforge_rules/skills.py` | L2.2 |
| `heroforge_rules/encumbrance.py` | L2.3 |
| `heroforge_rules/sheet.py` | L2.4 |
| `api/app.py` | L3.2 (cited in L0.1, L0.2) |
| `config.py`, `logging.py` | L3.2 |
| `api/schemas.py` | L3.3, L5.3 |
| `api/routers/derive.py` | L3.3 |
| `api/problems.py` | L3.4 |
| `db/models.py` | L4.1, L4.3 (cited in L0.1) |
| `db/base.py`, `db/session.py` | L4.3 |
| `db/repositories.py` | L4.2, L4.4 |
| `alembic.ini`, `db/migrations/env.py`, all four revision files | L4.5 |
| `db/seed.py`, `db/seeds/skills.yaml` | L4.5 |
| `api/auth.py`, `mail.py` | L5.2 |
| `api/routers/characters.py` | L5.3 |
| `api/routers/skills.py`, `api/skills_cache.py`, `api/admin.py` | L5.4 |
| `rate_limit.py` | L5.4 |
| `packages/heroforge-rules/tests/conftest.py`, `srd.py`, `test_abilities.py`, `test_defense.py`, `test_encumbrance.py`, `test_saves_and_combat.py`, `test_skills.py` | L6.2 |
| `packages/heroforge-rules/tests/test_golden_character.py` | L6.3 |
| `tests/conftest.py`, `test_auth.py`, `test_characters.py`, `test_derive.py`, `test_admin.py`, `test_skills_reference.py` | L6.4 |
| `scripts/dump_openapi.py`, `openapi.json` | L7.1 |
| `.github/workflows/` | L7.2 |
| `docker-compose.yml`, `docker/api.Dockerfile`, `Caddyfile`, `.env.example`, `scripts/grant_superuser.py`, `scripts/fetch-ogl.sh` | L7.3 |

Out of scope: the entire `web/` frontend; `docker/web.Dockerfile` except as it is mentioned in
L7.3; the design spec under `docs/`, which is background reading rather than course material.

---

## Notebook

Lesson notes, quiz questions, your answers, grading, follow-up threads, and build-step decisions
are appended below as each lesson is delivered.

---

### L0.1 — Modern typed Python · delivered 2026-07-27 · **quiz pending**

**Thesis:** annotations are runtime data. Python never checks them; they are *stored*, and two
different audiences read them — static checkers before the program runs, and introspecting
libraries (Pydantic, FastAPI, SQLAlchemy 2.0) while it runs. Most of the shape of a modern Python
backend follows from that one fact.

**Points made:**

1. `from __future__ import annotations` (PEP 563) stores annotations as **strings**, lazily
   evaluated. Buys unquoted forward references (`Mapped[list[Character]]`, `db/models.py:47`);
   costs a runtime resolution step, so an introspecting library must call
   `typing.get_type_hints()`. Pydantic v2 and SQLAlchemy 2.0 both do. **48 of 54 files use it**
   (counted 2026-07-27; the delivered lesson said "45 of 51", which was the tree at an earlier
   date and is wrong for the current one).
   What is deferred is a **name lookup only** — it does not defer right-hand sides, so
   `AbilityScore = Annotated[int, Field(ge=1, le=99)]` at `models.py:55` is still fully constructed
   at import, and Pydantic pays the deferred lookup straight back at class-creation time.
2. `Annotated[T, …]` (PEP 593) **is** `T` to the checker and carries metadata for the runtime. That
   is what lets one alias serve both audiences: `AbilityScore`, `NonNegativeDecimal`,
   `CheckPenalty` at `heroforge_rules/models.py:55–57`. `CheckPenalty = Annotated[int, Field(le=0)]`
   turns a prose invariant in CLAUDE.md into a mechanical one — a `+5` cannot enter the system.
3. `Self` (PEP 673) on `model_validator(mode="after")` returns, so subclasses narrow correctly.
   `ClassVar` is the documented opt-out from Pydantic turning an annotated class attribute into a
   *field* — the two-audiences problem in miniature. `X | None` (PEP 604) has replaced `Optional`.
4. `StrEnum` (3.11) members **are** `str`: free JSON serialisation, direct comparison, straight into
   a `String(3)` column, no `.value` at every boundary.
5. `mypy --strict` in practice — illustrated **from the engine**, since that is the only tree it
   runs over: `disallow_untyped_defs` (`skills.py:15` — `total_ranks(...) -> int`),
   `disallow_any_generics` (`Iterable[int]`, not bare `Iterable`), and above all
   `warn_return_any` — which is *why* `AbilityScores.effective` annotates two locals it immediately
   returns (`models.py:114–121`). `getattr()` yields `Any`; annotating the local **fences** the
   `Any` one line from where it entered. The technique generalises: don't fight dynamism, fence it.
6. Escape hatches are narrow — all **five** `type: ignore` comments carry an error code
   (`rate_limit.py:53,54`, `db/migrations/env.py:39`, `test_skills.py:75`, `test_admin.py:159`;
   an earlier note here said four). The one at
   `test_skills.py:75` exists because the test deliberately passes what the type system rejects, to
   prove the *runtime* rejects it too; static and runtime validation are separate defences.
7. **Strictness is scoped**: `ci.yml:33` runs `--strict` over the rules engine only, not over
   `src/heroforge/`. Strictest checking on the pure half where it is cheap; the I/O half is verified
   by integration tests against real PostgreSQL instead. A deliberate trade-off, worth an opinion.
   **Where strictness comes from is itself the teachable split:** `[tool.mypy]` in `pyproject.toml`
   sets only `python_version` and `plugins = ["pydantic.mypy"]` — *no* strictness flags.
   `disallow_untyped_defs`, `disallow_any_generics` and `warn_return_any` all arrive with the
   `--strict` flag on the CI command line. Plugin in config, flags on the command line.

**Citations verified 2026-07-27:** `db/models.py:47`, `ci.yml:33`, `skills.py:15`,
`test_skills.py:75`, `models.py:8 / 55–57 / 114–121 / 196–200 / 264`.

**Quiz asked (2 recall · 2 predict-the-failure · 1 read-the-snippet · 1 write-it):**

1. Why doesn't the future import break Pydantic — what must Pydantic do that it otherwise wouldn't?
2. What does mypy see in `AbilityScore` vs what Pydantic sees; does it stop `score - 5 == -3`?
3. *(predict — revised, answer verified by running it)* `_FIELDS` at `models.py:264` carries **two**
   independent opt-outs from field-hood: `ClassVar` and a leading underscore. Delete `ClassVar`;
   then separately consider renaming it to `FIELDS` while keeping `ClassVar`. Which of the two
   edits changes observable behaviour, and what is the change?
   *Verified:* underscore without `ClassVar` → private attribute, `model_fields` unchanged,
   `self._FIELDS[...]` still works, nothing breaks. No underscore and no `ClassVar` → it becomes a
   real field, appears in `model_fields`, and lands in the OpenAPI schema the frontend types are
   generated from. Also note `api/app.py:79`'s `-> dict[str, str]` is **not** there for mypy (mypy
   never sees that file) — FastAPI reads it to build the response model and the schema.
4. *(predict)* Delete the `# type: ignore[arg-type]` at `test_skills.py:75` — does the test still
   pass, does CI still go green, and why are those two different answers?
5. *(read)* `AbilityScores.effective` shown cold: what rule does it implement, and why are the two
   locals annotated?
6. *(write)* RecipeDesk: `Servings` (int 1–100), `Grams` (non-negative `Decimal`), and an
   `IngredientEntry` model with an after-validator enforcing exactly one of
   `ingredient_id`/`custom_name`.

**Answers:** _(awaiting)_

**Grading:** _(awaiting)_

**Follow-up threads:** _(none yet)_
