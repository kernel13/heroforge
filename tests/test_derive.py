"""``POST /api/derive`` — the per-keystroke path."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import sign_up

Mailbox = list[tuple[str, str, str]]


@pytest.fixture
async def user(client: AsyncClient, mailbox: Mailbox) -> AsyncClient:
    return await sign_up(client, mailbox, "typist@example.com")


async def derive(client: AsyncClient, **body: Any) -> dict[str, Any]:
    response = await client.post("/api/derive", json=body)
    assert response.status_code == 200, response.text
    result: dict[str, Any] = response.json()
    return result


async def test_an_empty_sheet_derives_the_defaults(user: AsyncClient) -> None:
    sheet = await derive(user)
    assert sheet["armor_class"]["total"] == 10
    assert sheet["armor_class"]["touch"] == 10
    assert sheet["armor_class"]["flat_footed"] == 10
    assert sheet["initiative"] == 0
    assert sheet["character_level"] == 0


async def test_it_persists_nothing(user: AsyncClient) -> None:
    await derive(user, name="Ghost", str_score=18)
    assert (await user.get("/api/characters")).json() == []


async def test_one_change_of_dexterity_moves_every_dexterity_derived_value(
    user: AsyncClient,
) -> None:
    """Changing Dexterity from 14 to 16 updates AC, touch AC, flat-footed AC, initiative, the
    Reflex save, and every Dexterity-keyed skill in a single response."""
    skills = {row["name"]: row["id"] for row in (await user.get("/api/skills")).json()}
    payload: dict[str, Any] = {
        "class_levels": [{"class_name": "Rogue", "level": 4}],
        "skills": [{"ordinal": 0, "skill_id": skills["Hide"], "ranks": 7, "is_class_skill": True}],
    }

    before = await derive(user, dex_score=14, **payload)
    after = await derive(user, dex_score=16, **payload)

    assert (before["armor_class"]["total"], after["armor_class"]["total"]) == (12, 13)
    assert (before["armor_class"]["touch"], after["armor_class"]["touch"]) == (12, 13)
    assert (before["armor_class"]["flat_footed"], after["armor_class"]["flat_footed"]) == (10, 10)
    assert (before["initiative"], after["initiative"]) == (2, 3)
    assert (before["saves"]["reflex"]["total"], after["saves"]["reflex"]["total"]) == (2, 3)
    assert (before["skills"][0]["total"], after["skills"][0]["total"]) == (9, 10)


async def test_the_full_plate_case_end_to_end(user: AsyncClient) -> None:
    """The composition the golden character pins, reached through HTTP."""
    sheet = await derive(
        user,
        dex_score=16,
        ac_size=1,
        ac_deflection=1,
        grapple_size_modifier=-4,
        base_attack_bonus=6,
        str_score=13,
        armor=[
            {"slot": "armor", "ac_bonus": 8, "max_dex": 1, "check_penalty": -6, "weight": "25"},
            {"slot": "shield", "ac_bonus": 2, "check_penalty": -2, "weight": "7.5"},
        ],
    )

    assert sheet["armor_class"]["total"] == 23
    assert sheet["armor_class"]["touch"] == 13
    assert sheet["armor_class"]["flat_footed"] == 22
    assert sheet["grapple_modifier"] == 3
    assert sheet["armor_check_penalty"] == -8
    assert [w["code"] for w in sheet["warnings"]] == ["dex_bonus_exceeds_max_dex"]


async def test_a_skill_over_its_maximum_is_a_warning_not_a_rejection(user: AsyncClient) -> None:
    skills = {row["name"]: row["id"] for row in (await user.get("/api/skills")).json()}
    sheet = await derive(
        user,
        class_levels=[{"class_name": "Wizard", "level": 1}],
        skills=[{"skill_id": skills["Spot"], "ranks": 9, "is_class_skill": False}],
    )
    assert [w["code"] for w in sheet["warnings"]] == ["ranks_over_maximum"]
    assert sheet["skills"][0]["total"] == 9


async def test_the_cross_class_maximum_is_half_the_class_one_rounded_down(
    user: AsyncClient,
) -> None:
    """Character level 5, so a class skill caps at 8 and a cross-class one at 8 // 2 = 4.

    Four ranks are legal on the class row and legal on the cross-class row too; the fifth is over
    only on the cross-class one. Asserted through HTTP because `max_ranks` reaches the client
    twice — on the derived row and again in the warning's `params` — and the sheet shows both.
    """
    skills = {row["name"]: row["id"] for row in (await user.get("/api/skills")).json()}
    body: dict[str, Any] = {"class_levels": [{"class_name": "Rogue", "level": 5}]}

    both_legal = await derive(
        user,
        skills=[
            {"skill_id": skills["Hide"], "ranks": 4, "is_class_skill": True},
            {"skill_id": skills["Spot"], "ranks": 4, "is_class_skill": False},
        ],
        **body,
    )
    assert [row["max_ranks"] for row in both_legal["skills"]] == [8, 4]
    assert both_legal["warnings"] == []

    one_over = await derive(
        user,
        skills=[
            {"skill_id": skills["Hide"], "ranks": 5, "is_class_skill": True},
            {"skill_id": skills["Spot"], "ranks": 5, "is_class_skill": False},
        ],
        **body,
    )
    assert [w["code"] for w in one_over["warnings"]] == ["ranks_over_maximum"]
    assert one_over["warnings"][0]["params"]["kind"] == "cross_class"
    assert one_over["warnings"][0]["params"]["max_ranks"] == "4"


async def test_invalid_input_is_rejected_before_the_engine_sees_it(user: AsyncClient) -> None:
    """The engine never raises because it is never handed anything to raise about."""
    response = await user.post("/api/derive", json={"str_score": 0})
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_a_skill_row_must_be_an_srd_skill_or_a_custom_one_but_not_both(
    user: AsyncClient,
) -> None:
    response = await user.post(
        "/api/derive", json={"skills": [{"skill_id": 1, "custom_name": "Both"}]}
    )
    assert response.status_code == 422
