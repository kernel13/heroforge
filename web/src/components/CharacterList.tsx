/** The character list. TanStack Query owns it; nothing here is mirrored into local state. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { CharacterSummary } from "../api/types";

interface Props {
  onOpen: (id: string) => void;
}

function describe(character: CharacterSummary): string {
  const classes = character.class_levels ?? [];
  if (classes.length === 0) return character.race === "" ? "No class yet" : character.race;
  const levels = classes.map((entry) => `${entry.class_name} ${entry.level}`).join(" / ");
  return character.race === "" ? levels : `${character.race} ${levels}`;
}

export function CharacterList({ onOpen }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const characters = useQuery({ queryKey: ["characters"], queryFn: api.listCharacters });

  const create = useMutation({
    mutationFn: (value: string) => api.createCharacter(value),
    onSuccess: async (result) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["characters"] });
      onOpen(result.character.id);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCharacter(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["characters"] }),
  });

  return (
    <section className="characters">
      <h1>Your characters</h1>

      <form
        className="characters__new"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(name.trim() === "" ? "New character" : name.trim());
        }}
      >
        <label className="field">
          <span className="field__label">New character</span>
          <input
            className="field__input"
            type="text"
            value={name}
            placeholder="Name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" className="button" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create"}
        </button>
      </form>

      {characters.isLoading && <p>Loading…</p>}
      {characters.isError && <p className="error">Could not load your characters.</p>}

      {characters.data?.length === 0 && (
        <p className="characters__empty">
          Nothing here yet. Create a character and the arithmetic starts working itself out.
        </p>
      )}

      <ul className="characters__list">
        {characters.data?.map((character) => (
          <li key={character.id}>
            <button
              type="button"
              className="characters__open"
              onClick={() => onOpen(character.id)}
            >
              <span className="characters__name">
                {character.name === "" ? "Unnamed character" : character.name}
              </span>
              <span className="characters__meta">{describe(character)}</span>
              {character.campaign !== "" && (
                <span className="characters__meta">{character.campaign}</span>
              )}
            </button>
            <button
              type="button"
              className="button button--quiet"
              aria-label={`Delete ${character.name}`}
              onClick={() => remove.mutate(character.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
