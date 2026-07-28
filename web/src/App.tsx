import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, api } from "./api/client";
import { Auth, TokenLanding } from "./components/Auth";
import { CharacterList } from "./components/CharacterList";
import { CharacterSheet } from "./components/CharacterSheet";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { SectionIcon } from "./components/fields";
import { IconSrd } from "./components/icons";
import { interpolate, useT } from "./i18n";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
  const t = useT();
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

  if (session.isLoading) return <p className="p-6 text-muted-foreground">{t("app.loading")}</p>;

  if (unauthenticated || session.isError) {
    return <Auth onSignedIn={() => void queryClient.invalidateQueries({ queryKey: ["me"] })} />;
  }

  const signOut = async () => {
    await api.logout();
    open(null);
    queryClient.clear();
  };

  return (
    /* A full-height column so the footer is pushed to the bottom of the viewport rather than
       sitting wherever the content happens to stop. On a short page — the character list before
       anything is in it — a footer floating mid-screen with the page's leather continuing below
       reads as a rendering fault rather than as the end of the page. */
    <div className="flex min-h-screen flex-col">
      {/* `backdrop-blur` because the bar is translucent parchment over the page's own grain:
          without it the texture scrolls past underneath and reads as movement in the header. */}
      <nav className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background px-5 py-2.5 backdrop-blur-md">
        <span className="font-semibold">{t("app.title")}</span>
        <span className="ml-auto text-sm text-muted-foreground">{session.data?.email}</span>
        <LanguageSwitcher />
        <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
          {t("app.signOut")}
        </Button>

        {/* Which rules these are, said with a d20 and the licence's own name.
            Nothing here is trade dress: the SRD is the source the OGL names, "Open Game License"
            is the licence's title, and neither is translated because neither has a French
            edition to be translated into — the same reasoning as the language endonyms. */}
        <Separator orientation="vertical" className="mx-0.5 !h-7" />
        <span className="flex items-center gap-2">
          <SectionIcon icon={<IconSrd />} className="size-[26px] text-primary/90" />
          <span className="flex flex-col leading-none">
            <span className="font-emblem text-[0.95rem] font-bold tracking-[0.16em] text-primary">
              {t("app.srd")}
            </span>
            <span className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              {t("app.srdLicence")}
            </span>
          </span>
        </span>
      </nav>

      {/* Wide enough for the sheet's two regions: the 19rem derived rail, a gap, and a working
          column that still has room for the skills table's eight columns beside it. The character
          list is the same width and simply has more air around its rows, which is cheaper than a
          second container that would have to be kept in step with this one. */}
      <main className="mx-auto w-full max-w-[1340px] flex-1 px-5 pt-6 pb-16">
        {openId === null && <CharacterList onOpen={open} />}

        {openId !== null && character.isLoading && (
          <p className="text-muted-foreground">{t("app.loadingSheet")}</p>
        )}
        {openId !== null && character.isError && (
          <p className="text-destructive">{t("app.characterNotOpened")}</p>
        )}
        {openId !== null && character.data !== undefined && skills.data !== undefined && (
          <CharacterSheet
            key={openId}
            character={character.data.character}
            initialDerived={character.data.derived}
            definitions={skills.data}
            portraitUpdatedAt={character.data.portrait_updated_at ?? null}
            onBack={() => {
              open(null);
              void queryClient.invalidateQueries({
                queryKey: ["characters"],
              });
            }}
          />
        )}
      </main>

      {/* Both notices carry their links as `{placeholders}` rather than being split into
          before-and-after fragments: French puts "Voir la licence" where English puts "See the
          licence", and a component that concatenates has already decided that order. */}
      <footer className="border-t bg-background px-5 py-4 text-xs text-muted-foreground">
        <p>
          {interpolate(t("app.footer.ogl"), {
            link: (
              <a href="/OGL.txt" className="text-primary underline underline-offset-2">
                {t("app.footer.oglLink")}
              </a>
            ),
          })}
        </p>
        <p>
          {interpolate(t("app.footer.icons"), {
            link: (
              <a
                href="https://game-icons.net"
                className="text-primary underline underline-offset-2"
                rel="noreferrer"
              >
                game-icons.net
              </a>
            ),
            credits: (
              <a href="/ICONS.txt" className="text-primary underline underline-offset-2">
                {t("app.footer.iconsCredits")}
              </a>
            ),
          })}
        </p>
        {/* The two display faces are served from this origin rather than from Google Fonts, so
            this deployment redistributes them and the OFL's notice travels with them. */}
        <p>
          {interpolate(t("app.footer.fonts"), {
            credits: (
              <a href="/FONTS.txt" className="text-primary underline underline-offset-2">
                {t("app.footer.fontsCredits")}
              </a>
            ),
          })}
        </p>
      </footer>
    </div>
  );
}
