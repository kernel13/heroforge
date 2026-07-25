# heroforge-rules

The D&D 3.5 arithmetic a paper character sheet asks you to do by hand, as pure functions over
Pydantic models. Imports nothing from FastAPI, SQLAlchemy, or any I/O module, so the whole body of
rules is testable without a database.

Single public entry point:

```python
from heroforge_rules import derive

sheet = derive(character_input, skill_definitions)
```

Skill definitions are passed in, never fetched.

## Conventions that are easy to get wrong

- Armour check penalties are stored as **non-positive** integers (full plate is `-5`). The engine
  adds them. Swim adds them twice.
- `ranks` is a stored half-integer. A half rank contributes nothing to a check: the engine floors
  ranks before adding, but `max_ranks` validation compares against the unfloored value.
- `grapple_size_modifier` is not `ac_size`. A Small creature has +1 AC but −4 to grapple.
- The engine never raises. Rules violations come back as warnings on the result.

Mechanics used under the Open Game License 1.0a; see `OGL.txt` at the repository root.
