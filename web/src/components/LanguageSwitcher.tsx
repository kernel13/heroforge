/**
 * The language control.
 *
 * Two languages, so both are shown rather than hidden behind a menu: a user who cannot read the
 * interface cannot read the label on the menu that would let them change it either. The pair is a
 * `role="group"` of toggle buttons carrying `aria-pressed`, which is what tells a screen reader
 * which language is currently on without a second visual convention.
 *
 * The glyph is `lucide-react`'s, not Iconify's — this is a header control, alongside the sheet's
 * back arrow and the export button, and lucide sets its own `aria-hidden`, so the icon cannot
 * join the group's accessible name. Deliberately **not** a flag: a flag names a country, and
 * neither English nor French belongs to one.
 */
import { Languages } from "lucide-react";
import { LOCALES, useI18n } from "../i18n";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("language.choose")}
      className="flex items-center gap-0.5 rounded-md border px-1 py-0.5"
    >
      <Languages className="mx-1 size-3.5 shrink-0 text-muted-foreground" />
      {LOCALES.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={option === locale ? "secondary" : "ghost"}
          aria-pressed={option === locale}
          // The button reads "EN"; its accessible name gives the language its own name, so a
          // French speaker on an English interface can find "Français" rather than "French".
          aria-label={t(`language.${option}`)}
          className="h-6 px-2 text-xs font-medium"
          onClick={() => setLocale(option)}
        >
          {t(`language.${option}.short`)}
        </Button>
      ))}
    </div>
  );
}
