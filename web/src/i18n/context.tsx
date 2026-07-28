/**
 * The chosen language, and the React bindings for it.
 *
 * The choice is a preference of the person, not of the character, so it lives in `localStorage`
 * rather than in the URL or on the server: a sheet's address stays the address of that sheet, and
 * a link shared between two players opens in each of their own languages. It survives a reload,
 * which is the only durability a language toggle needs.
 *
 * The first visit takes the browser's own preference — a French-speaking user should not have to
 * find the switch before they can read the sign-in form.
 *
 * `<html lang>` is kept in step with the choice. It is what a screen reader picks its voice and
 * pronunciation rules from; an interface in French announced by an English synthesiser is close to
 * unusable, and no amount of translated text fixes it.
 */
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  isLocale,
  translatorFor,
  type Locale,
  type Params,
  type Translator,
} from "./translate";
import type { TranslationKey } from "./en";

const STORAGE_KEY = "heroforge.locale";

export interface I18n extends Translator {
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18n | null>(null);

function stored(): Locale | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    // Private browsing, or storage denied. A language toggle is not worth a crash.
    return null;
  }
}

/** `fr-CA` and `fr` alike select French; anything not translated falls back to English. */
function fromBrowser(): Locale | null {
  for (const tag of window.navigator.languages ?? [window.navigator.language]) {
    const base = tag.split("-")[0]?.toLowerCase();
    if (isLocale(base)) return base;
  }
  return null;
}

export function initialLocale(): Locale {
  return stored() ?? fromBrowser() ?? DEFAULT_LOCALE;
}

export function I18nProvider({
  children,
  locale: forced,
}: {
  children: ReactNode;
  /** Pins the language. For tests and for rendering one page in a language not yet chosen. */
  locale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(forced ?? initialLocale);
  const effective = forced ?? locale;

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies to this session; it just will not outlive it.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = effective;
  }, [effective]);

  const value = useMemo<I18n>(
    () => ({ ...translatorFor(effective), setLocale }),
    [effective, setLocale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const value = use(I18nContext);
  if (value === null) {
    throw new Error("useI18n must be used inside an I18nProvider");
  }
  return value;
}

/** The common case: just the translation function. */
export function useT(): (key: TranslationKey, params?: Params) => string {
  return useI18n().t;
}
