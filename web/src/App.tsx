import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, api } from "./api/client";
import { Auth, TokenLanding } from "./components/Auth";
import { CharacterList } from "./components/CharacterList";
import { CharacterSheet } from "./components/CharacterSheet";

function isTokenLanding(): boolean {
  const path = window.location.pathname;
  return path.includes("/verify") || path.includes("/reset-password");
}

/**
 * The open character is kept in the URL rather than in state alone.
 *
 * A sheet is something a user leaves open for an evening; reloading it, bookmarking it, or
 * restoring a browser session should land back on the same character rather than on the list.
 * Too small a need for a router — one path segment and `popstate` cover it.
 */
const CHARACTER_PATH = /^\/characters\/([0-9a-f-]{36})$/i;

function characterFromUrl(): string | null {
  return CHARACTER_PATH.exec(window.location.pathname)?.[1] ?? null;
}

export function App() {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(characterFromUrl);
  const [landing, setLanding] = useState(isTokenLanding);

  const open = (id: string | null) => {
    setOpenId(id);
    window.history.pushState(null, "", id === null ? "/" : `/characters/${id}`);
  };

  useEffect(() => {
    const onPopState = () => setOpenId(characterFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const session = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
    enabled: !landing,
  });

  const skills = useQuery({
    queryKey: ["skills"],
    queryFn: api.skills,
    staleTime: Infinity,
    enabled: session.isSuccess,
  });

  const character = useQuery({
    queryKey: ["character", openId],
    queryFn: () => api.getCharacter(openId as string),
    enabled: openId !== null,
  });

  if (landing) {
    return (
      <TokenLanding
        onDone={() => {
          window.history.replaceState(null, "", "/");
          setLanding(false);
        }}
      />
    );
  }

  const unauthenticated =
    session.isError && session.error instanceof ApiError && session.error.isUnauthenticated;

  if (session.isLoading) return <p className="loading">Loading…</p>;

  if (unauthenticated || session.isError) {
    return <Auth onSignedIn={() => void queryClient.invalidateQueries({ queryKey: ["me"] })} />;
  }

  const signOut = async () => {
    await api.logout();
    open(null);
    queryClient.clear();
  };

  return (
    <div className="app">
      <nav className="app__bar">
        <span className="app__brand">Character sheet manager</span>
        <span className="app__user">{session.data?.email}</span>
        <button type="button" className="button button--quiet" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>

      <main className="app__main">
        {openId === null && <CharacterList onOpen={open} />}

        {openId !== null && character.isLoading && <p className="loading">Loading sheet…</p>}
        {openId !== null && character.isError && (
          <p className="error">That character could not be opened.</p>
        )}
        {openId !== null && character.data !== undefined && skills.data !== undefined && (
          <CharacterSheet
            key={openId}
            character={character.data.character}
            initialDerived={character.data.derived}
            definitions={skills.data}
            onBack={() => {
              open(null);
              void queryClient.invalidateQueries({ queryKey: ["characters"] });
            }}
          />
        )}
      </main>

      <footer className="app__footer">
        <p>
          Game mechanics from the System Reference Document, used under the Open Game License 1.0a.
          See <a href="/OGL.txt">the licence</a>.
        </p>
      </footer>
    </div>
  );
}
