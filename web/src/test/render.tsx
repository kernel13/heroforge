/**
 * Rendering a component with a language pinned.
 *
 * Every component that shows text reads it from the `I18nProvider`, so a bare `render()` would
 * throw. The language is pinned rather than left to `initialLocale()`: that function consults
 * `navigator.languages`, which differs between a developer's machine and CI, and a suite whose
 * accessible names depend on the machine it runs on is not a suite.
 *
 * English is the default here for the same reason it is the fallback everywhere else — it is what
 * the existing assertions read.
 */
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, type Locale } from "../i18n";

export function renderIn(
  ui: ReactElement,
  locale: Locale = "en",
  options?: RenderOptions,
): RenderResult {
  return render(<I18nProvider locale={locale}>{ui}</I18nProvider>, options);
}
