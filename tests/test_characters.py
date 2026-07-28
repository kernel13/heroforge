"""Character CRUD: ownership, eager skill rows, optimistic concurrency, derived values."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import sign_up

Mailbox = list[tuple[str, str, str]]


@pytest.fixture
async def owner(client: AsyncClient, mailbox: Mailbox) -> AsyncClient:
    return await sign_up(client, mailbox, "owner@example.com")


@pytest.fixture
async def stranger(other_client: AsyncClient, mailbox: Mailbox) -> AsyncClient:
    return await sign_up(other_client, mailbox, "stranger@example.com")


async def create(client: AsyncClient, **body: Any) -> dict[str, Any]:
    response = await client.post("/api/characters", json={"name": "Bramwell", **body})
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def patch(client: AsyncClient, character: dict[str, Any], **changes: Any) -> Any:
    return await client.patch(
        f"/api/characters/{character['id']}",
        json={"version": character["version"], **changes},
    )


class TestAuthentication:
    async def test_every_character_route_requires_a_session(self, client: AsyncClient) -> None:
        assert (await client.get("/api/characters")).status_code == 401
        assert (await client.post("/api/characters", json={"name": "x"})).status_code == 401

    async def test_derive_requires_a_session(self, client: AsyncClient) -> None:
        """It is compute on a publicly registrable application, not a free service."""
        assert (await client.post("/api/derive", json={})).status_code == 401


class TestCreate:
    async def test_creating_returns_the_character_and_its_derived_sheet(
        self, owner: AsyncClient
    ) -> None:
        body = await create(owner)
        assert body["character"]["name"] == "Bramwell"
        assert body["character"]["version"] == 1
        assert body["derived"]["armor_class"]["total"] == 10

    async def test_skill_rows_are_created_eagerly_for_every_srd_skill(
        self, owner: AsyncClient
    ) -> None:
        """Not lazily: otherwise the list endpoint and the sheet would each have to reconcile
        stored rows against the reference list and synthesise the missing ones."""
        skills = (await owner.get("/api/skills")).json()
        expected = sum(skill["sheet_rows"] for skill in skills)

        rows = (await create(owner))["character"]["skills"]
        assert len(rows) == expected
        assert all(row["skill_id"] is not None for row in rows)
        # A JSON number, not a decimal string: ranks are whole. `0.0` would mean the column had
        # gone back to `Numeric`.
        assert all(row["ranks"] == 0 for row in rows)

    async def test_the_repeated_skills_match_the_printed_sheet(self, owner: AsyncClient) -> None:
        skills = {skill["name"]: skill["id"] for skill in (await owner.get("/api/skills")).json()}
        rows = (await create(owner))["character"]["skills"]

        def count(name: str) -> int:
            return sum(1 for row in rows if row["skill_id"] == skills[name])

        assert count("Craft") == 3
        assert count("Knowledge") == 5
        assert count("Perform") == 3
        assert count("Profession") == 2
        assert count("Appraise") == 1

    async def test_the_five_attack_blocks_are_created(self, owner: AsyncClient) -> None:
        assert len((await create(owner))["character"]["attacks"]) == 5


class TestOwnership:
    async def test_another_users_character_is_a_404_not_a_403(
        self, owner: AsyncClient, stranger: AsyncClient
    ) -> None:
        """A 403 would confirm the identifier exists."""
        character = (await create(owner))["character"]

        response = await stranger.get(f"/api/characters/{character['id']}")
        assert response.status_code == 404
        assert response.headers["content-type"].startswith("application/problem+json")

    async def test_another_user_cannot_patch_or_delete(
        self, owner: AsyncClient, stranger: AsyncClient
    ) -> None:
        character = (await create(owner))["character"]

        assert (await patch(stranger, character, name="Stolen")).status_code == 404
        assert (await stranger.delete(f"/api/characters/{character['id']}")).status_code == 404

    async def test_the_list_shows_only_your_own(
        self, owner: AsyncClient, stranger: AsyncClient
    ) -> None:
        await create(owner, name="Mine")
        await create(stranger, name="Theirs")

        assert [row["name"] for row in (await owner.get("/api/characters")).json()] == ["Mine"]
        assert [row["name"] for row in (await stranger.get("/api/characters")).json()] == ["Theirs"]

    async def test_a_missing_character_is_a_404(self, owner: AsyncClient) -> None:
        missing = "00000000-0000-0000-0000-000000000000"
        assert (await owner.get(f"/api/characters/{missing}")).status_code == 404


class TestConcurrency:
    async def test_a_stale_version_is_a_409(self, owner: AsyncClient) -> None:
        """One character open in two browser tabs is realistic, and the second save must not
        silently overwrite the first."""
        character = (await create(owner))["character"]

        first = await patch(owner, character, name="Saved first")
        assert first.status_code == 200
        assert first.json()["character"]["version"] == 2

        second = await patch(owner, character, name="Saved second")
        assert second.status_code == 409
        body = second.json()
        assert body["expected_version"] == 1
        assert body["current_version"] == 2
        assert second.headers["content-type"].startswith("application/problem+json")

    async def test_the_first_write_is_the_one_that_survives(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        await patch(owner, character, name="Saved first")
        await patch(owner, character, name="Saved second")

        stored = (await owner.get(f"/api/characters/{character['id']}")).json()
        assert stored["character"]["name"] == "Saved first"


class TestUpdate:
    async def test_a_patch_only_touches_the_fields_it_carries(self, owner: AsyncClient) -> None:
        character = (await create(owner, name="Bramwell"))["character"]
        updated = (await patch(owner, character, dex_score=16)).json()["character"]

        assert updated["dex_score"] == 16
        assert updated["name"] == "Bramwell"
        assert len(updated["skills"]) == len(character["skills"])

    async def test_changing_dexterity_moves_every_dexterity_derived_value(
        self, owner: AsyncClient
    ) -> None:
        """The whole point of the product, exercised through the API."""
        character = (await create(owner))["character"]
        before = (await owner.get(f"/api/characters/{character['id']}")).json()["derived"]

        after = (await patch(owner, character, dex_score=16)).json()["derived"]

        assert after["armor_class"]["total"] == before["armor_class"]["total"] + 3
        assert after["armor_class"]["touch"] == before["armor_class"]["touch"] + 3
        assert after["armor_class"]["flat_footed"] == before["armor_class"]["flat_footed"]
        assert after["initiative"] == before["initiative"] + 3
        assert after["saves"]["reflex"]["total"] == before["saves"]["reflex"]["total"] + 3

        def hide(sheet: dict[str, Any]) -> int:
            row: int = next(s["total"] for s in sheet["skills"] if s["name"] == "Hide")
            return row

        assert hide(after) == hide(before) + 3

    async def test_armour_is_stored_and_reaches_the_derived_sheet(self, owner: AsyncClient) -> None:
        character = (await create(owner, name="Plated"))["character"]
        response = await patch(
            owner,
            character,
            dex_score=16,
            armor=[
                {
                    "slot": "armor",
                    "name": "Full plate",
                    "ac_bonus": 8,
                    "max_dex": 1,
                    "check_penalty": -6,
                    "weight": "50",
                }
            ],
        )
        assert response.status_code == 200, response.text
        derived = response.json()["derived"]

        assert derived["armor_class"]["armor_bonus"] == 8
        assert derived["armor_class"]["effective_dex_bonus"] == 1
        assert derived["armor_class"]["total"] == 19
        assert derived["armor_check_penalty"] == -6
        assert derived["encumbrance"]["carried_weight"] == "50"

    async def test_a_positive_check_penalty_is_rejected_at_the_boundary(
        self, owner: AsyncClient
    ) -> None:
        """Penalties are stored non-positive. Accepting 5 for full plate would invert the sign
        of every armour-check-penalised skill."""
        character = (await create(owner))["character"]
        response = await patch(owner, character, armor=[{"slot": "shield", "check_penalty": 2}])
        assert response.status_code == 422

    async def test_skill_ranks_survive_a_round_trip_as_whole_numbers(
        self, owner: AsyncClient
    ) -> None:
        character = (await create(owner))["character"]
        rows = character["skills"]
        tumble = next(row for row in rows if row["skill_id"] is not None)

        response = await patch(
            owner,
            character,
            skills=[{**tumble, "ranks": 4, "is_class_skill": False}],
        )
        assert response.status_code == 200, response.text

        stored = (await owner.get(f"/api/characters/{character['id']}")).json()
        assert len(stored["character"]["skills"]) == 1
        assert stored["character"]["skills"][0]["ranks"] == 4

    async def test_a_fractional_rank_is_rejected_at_the_boundary(self, owner: AsyncClient) -> None:
        """Ranks are whole numbers here. Accepting 3.5 and storing 3 or 4 would make the sheet
        disagree with what was typed; the boundary refuses it instead."""
        character = (await create(owner))["character"]
        row = next(row for row in character["skills"] if row["skill_id"] is not None)

        response = await patch(owner, character, skills=[{**row, "ranks": 3.5}])
        assert response.status_code == 422

    async def test_possessions_are_summed_into_carried_weight(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        response = await patch(
            owner,
            character,
            possessions=[
                {"item": "Bedroll", "page": "126", "weight": "5"},
                {"item": "Rope, hemp (50 ft.)", "page": "126", "weight": "10"},
            ],
        )
        assert response.json()["derived"]["encumbrance"]["carried_weight"] == "15"

    async def test_ability_scores_are_bounded(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        assert (await patch(owner, character, str_score=0)).status_code == 422
        assert (await patch(owner, character, str_score=100)).status_code == 422

    async def test_class_levels_drive_the_character_level(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        response = await patch(
            owner,
            character,
            class_levels=[
                {"class_name": "Fighter", "level": 5},
                {"class_name": "Rogue", "level": 2},
            ],
        )
        assert response.json()["derived"]["character_level"] == 7

    async def test_rules_violations_are_warnings_and_not_refusals(self, owner: AsyncClient) -> None:
        """House rules and homebrew are normal play: the application reports, it does not refuse."""
        character = (await create(owner))["character"]
        row = character["skills"][0]

        response = await patch(
            owner,
            character,
            class_levels=[{"class_name": "Fighter", "level": 1}],
            skills=[{**row, "ranks": 99, "is_class_skill": True}],
        )
        assert response.status_code == 200
        derived = response.json()["derived"]
        assert [w["code"] for w in derived["warnings"]] == ["ranks_over_maximum"]
        assert derived["skills"][0]["total"] == 99


class TestDelete:
    async def test_delete_removes_the_character(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        assert (await owner.delete(f"/api/characters/{character['id']}")).status_code == 204
        assert (await owner.get(f"/api/characters/{character['id']}")).status_code == 404

    async def test_deleting_twice_is_a_404(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        await owner.delete(f"/api/characters/{character['id']}")
        assert (await owner.delete(f"/api/characters/{character['id']}")).status_code == 404


# A one-pixel PNG. Small enough to be a literal and real enough that the media type is not a lie.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd4"
    "0000000049454e44ae426082"
)


async def put_portrait(
    client: AsyncClient, character_id: str, data: bytes = PNG, media_type: str = "image/png"
) -> Any:
    return await client.put(
        f"/api/characters/{character_id}/portrait",
        content=data,
        headers={"Content-Type": media_type},
    )


class TestPortrait:
    """The portrait sits outside the versioned document and outside the character's own payload."""

    async def test_a_new_character_has_no_portrait(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        listed = (await owner.get("/api/characters")).json()
        assert listed[0]["portrait_updated_at"] is None
        assert (await owner.get(f"/api/characters/{character['id']}/portrait")).status_code == 404

    async def test_uploading_then_reading_returns_the_same_bytes(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]

        upload = await put_portrait(owner, character["id"])
        assert upload.status_code == 200, upload.text
        assert upload.json()["portrait_updated_at"] is not None

        served = await owner.get(f"/api/characters/{character['id']}/portrait")
        assert served.status_code == 200
        assert served.content == PNG
        assert served.headers["content-type"] == "image/png"

    async def test_the_summary_carries_the_stamp_but_never_the_bytes(
        self, owner: AsyncClient
    ) -> None:
        """The list is deliberately narrow: the card fetches the image as a second request."""
        character = (await create(owner))["character"]
        await put_portrait(owner, character["id"])

        summary = (await owner.get("/api/characters")).json()[0]
        assert summary["portrait_updated_at"] is not None
        assert "portrait_data" not in summary

    async def test_the_sheet_gets_the_stamp_beside_the_character_never_on_it(
        self, owner: AsyncClient
    ) -> None:
        """The sheet draws the portrait in its identity panel, so ``GET`` and ``PATCH`` carry the
        stamp — beside the character and not on it. ``CharacterRead`` is what the client sends
        back as a ``PATCH`` body and ``CharacterBody`` forbids extras, so a stamp riding on it
        would 422 every autosave the moment a client stopped stripping it by hand."""
        created = (await create(owner))["character"]
        await put_portrait(owner, created["id"])

        read = (await owner.get(f"/api/characters/{created['id']}")).json()
        assert read["portrait_updated_at"] is not None
        assert "portrait_updated_at" not in read["character"]

        saved = (await patch(owner, read["character"], name="Bramwell the Bold")).json()
        assert saved["portrait_updated_at"] == read["portrait_updated_at"]
        assert "portrait_updated_at" not in saved["character"]

    async def test_a_character_without_a_portrait_reads_a_null_stamp(
        self, owner: AsyncClient
    ) -> None:
        created = (await create(owner))["character"]
        read = (await owner.get(f"/api/characters/{created['id']}")).json()
        assert read["portrait_updated_at"] is None

    async def test_uploading_does_not_bump_the_version(self, owner: AsyncClient) -> None:
        """A portrait changed from the list must not 409 a sheet open in another tab."""
        character = (await create(owner))["character"]
        await put_portrait(owner, character["id"])

        assert (await patch(owner, character, name="Bramwell the Bold")).status_code == 200

    async def test_removing_clears_the_stamp_and_the_image(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        await put_portrait(owner, character["id"])

        removed = await owner.delete(f"/api/characters/{character['id']}/portrait")
        assert removed.status_code == 200
        assert removed.json()["portrait_updated_at"] is None
        assert (await owner.get(f"/api/characters/{character['id']}/portrait")).status_code == 404

    async def test_removing_a_portrait_that_is_not_there_succeeds(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        assert (
            await owner.delete(f"/api/characters/{character['id']}/portrait")
        ).status_code == 200

    async def test_a_type_the_browser_cannot_display_is_refused(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        refused = await put_portrait(owner, character["id"], media_type="image/svg+xml")
        assert refused.status_code == 415
        assert refused.headers["content-type"] == "application/problem+json"

    async def test_an_oversized_upload_is_refused(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        too_big = b"\x00" * (2 * 1024 * 1024 + 1)
        assert (await put_portrait(owner, character["id"], data=too_big)).status_code == 413

    async def test_an_empty_body_is_refused(self, owner: AsyncClient) -> None:
        character = (await create(owner))["character"]
        assert (await put_portrait(owner, character["id"], data=b"")).status_code == 400

    async def test_another_users_portrait_is_a_404_on_every_route(
        self, owner: AsyncClient, stranger: AsyncClient
    ) -> None:
        """404 and not 403 — a 403 would confirm the identifier exists."""
        character = (await create(owner))["character"]
        await put_portrait(owner, character["id"])

        assert (
            await stranger.get(f"/api/characters/{character['id']}/portrait")
        ).status_code == 404
        assert (await put_portrait(stranger, character["id"])).status_code == 404
        assert (
            await stranger.delete(f"/api/characters/{character['id']}/portrait")
        ).status_code == 404

    async def test_the_portrait_routes_require_a_session(self, client: AsyncClient) -> None:
        anywhere = "/api/characters/00000000-0000-0000-0000-000000000000/portrait"
        assert (await client.get(anywhere)).status_code == 401
        assert (
            await put_portrait(client, "00000000-0000-0000-0000-000000000000")
        ).status_code == 401
        assert (await client.delete(anywhere)).status_code == 401
