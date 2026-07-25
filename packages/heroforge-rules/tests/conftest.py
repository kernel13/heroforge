"""Shared fixtures for the rules-engine tests."""

from __future__ import annotations

import pytest
from heroforge_rules.models import SkillDefinition
from srd import SRD_SKILLS


@pytest.fixture
def srd_skills() -> list[SkillDefinition]:
    return list(SRD_SKILLS)
