/**
 * The rules violations the engine reported.
 *
 * Reported, never refused — house rules and homebrew are normal play, so this is a quiet
 * `role="status"` panel and not an error.
 *
 * Each line is **rebuilt** from the warning's `code` and `params` rather than shown as the
 * `message` the API sent. That message is English, composed in `heroforge_rules`, and the engine
 * has no locale to compose it in any other language. The parameters are tokens — a skill
 * identifier, a number, a `kind` of `class` or `cross_class` — so the sentence can be written
 * fresh in each dictionary with its own word order and its own agreement.
 *
 * A skill is named by looking its identifier up in the definitions the sheet already holds, which
 * is the same list the table itself is labelled from; the two cannot disagree. `skill_name` is the
 * fallback for a custom row, which has no identifier and whose name the player typed themselves.
 */
import type { RuleWarning, SkillDefinition } from "../api/types";
import { useI18n, type Params, type TranslationKey } from "../i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  warnings: RuleWarning[];
  definitions: SkillDefinition[];
}

const SENTENCE: Record<string, TranslationKey> = {
  ranks_over_maximum: "warning.ranks_over_maximum",
  dex_bonus_exceeds_max_dex: "warning.dex_bonus_exceeds_max_dex",
  overloaded: "warning.overloaded",
  unknown_skill: "warning.unknown_skill",
};

export function RuleWarnings({ warnings, definitions }: Props) {
  const { t, skillName, weight } = useI18n();
  if (warnings.length === 0) return null;

  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  /** The skill this warning is about, named in the current language, with its specialisation. */
  const named = (params: Record<string, string>): string => {
    const id = params.skill_id === undefined ? undefined : Number(params.skill_id);
    const definition = id === undefined ? undefined : byId.get(id);
    const base = definition === undefined ? (params.skill_name ?? "") : skillName(definition);
    return params.specialization === undefined ? base : `${base} (${params.specialization})`;
  };

  /**
   * A weight param written in the reader's unit — and `undefined` left alone, so a param the
   * engine renamed still reaches `alias` as missing rather than as the string "undefined kg".
   */
  const inReadersUnit = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : weight(value);

  const sentence = (warning: RuleWarning): string => {
    const params = warning.params ?? {};
    const key = SENTENCE[warning.code];
    // A code this build does not know is still worth showing: the server's English sentence is a
    // worse line than a translated one and a much better line than silence.
    if (key === undefined) return warning.message;

    // The engine's own param names are carried through as they are, so a template can use
    // `{ranks}` directly; the sentences that read better under a shorter name get an alias.
    const values: Params = { ...params };

    /**
     * Alias a param, and **do nothing when it is missing**.
     *
     * Never `?? ""`. A param the engine renames would then render as an invisible gap in the
     * middle of a sentence — which nobody reports — instead of as the literal `{max}` that
     * `fill()` deliberately leaves behind, which somebody does.
     */
    const alias = (name: string, value: string | undefined) => {
      if (value !== undefined) values[name] = value;
    };

    if (warning.code === "ranks_over_maximum") {
      alias("skill", named(params));
      alias("max", params.max_ranks);
      alias("level", params.character_level);
      alias(
        "kind",
        params.kind === undefined
          ? undefined
          : t(params.kind === "class" ? "warning.kind.class" : "warning.kind.cross_class"),
      );
    } else if (warning.code === "dex_bonus_exceeds_max_dex") {
      // The engine's numbers are unsigned in `params`; the `+` is presentation, as everywhere.
      alias("dex", signed(params.dex_modifier));
      alias("max", signed(params.max_dex));
      alias("applied", signed(params.applied));
    } else if (warning.code === "overloaded") {
      // The engine sends pounds and the sentence carries no unit of its own, so each figure
      // arrives here already written in the reader's — the same call the rail makes. A warning
      // reading "150 lb" above a rail reading "37,5 kg" is the engine appearing to contradict
      // itself, which is worse than showing no unit at all.
      alias("weight", inReadersUnit(params.carried_weight));
      alias("max", inReadersUnit(params.maximum_load));
    } else if (warning.code === "unknown_skill") {
      alias("id", params.skill_id);
    }
    return t(key, values);
  };

  return (
    <Alert role="status" className="mb-4 border-l-[3px] border-l-primary">
      <AlertTitle className="field-label">{t("sheet.warnings.title")}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4 text-[0.87rem] text-foreground">
          {warnings.map((warning, index) => (
            <li key={index}>{sentence(warning)}</li>
          ))}
        </ul>
        <p className="text-[0.78rem]">{t("sheet.warnings.note")}</p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Formatting, not arithmetic: the engine decided the number, this only prints its sign.
 *
 * Passes `undefined` through rather than turning it into an empty string, so a missing param
 * stays a visible placeholder rather than a silent gap.
 */
function signed(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return value;
  return value.startsWith("-") || value.startsWith("+") ? value : `+${value}`;
}
