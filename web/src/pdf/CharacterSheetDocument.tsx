/**
 * The exported character sheet.
 *
 * The layout follows the *structure* of the printed record sheet — which fields exist, how they
 * group, and the order a player reads them in. Page one carries the identity line, abilities,
 * hit points, armour class, initiative, saving throws, base attack bonus, grapple, the attack
 * blocks, and the skills column; page two carries gear, possessions and encumbrance, money, feats,
 * special abilities, languages, and spells. That structure is mechanical and comes from the SRD.
 *
 * The spellbook page after them is not from that form — the form has no such page. It prints only
 * for a character who has scribed something, and it is as long as the book is.
 *
 * The visual design is this application's own — see `theme.ts`.
 *
 * **Nothing here computes a rule.** Every derived number is read off the `DerivedSheet` the API
 * returned; the `+` signs between component boxes are drawn, not evaluated. A formula that looks
 * like it wants a `reduce()` is the one thing this file must never grow.
 *
 * **The translator arrives as a prop, not from context.** `pdf(<Document/>).toBlob()` renders
 * through react-pdf's own reconciler, which has no connection to the application's React tree, so
 * a `useI18n()` anywhere below here would find nothing. `ExportPdfButton` reads it on the DOM side
 * and threads it down; every component in this file takes it in `Props`.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ABILITIES, SAVES } from "../api/types";
import type {
  ArmorRow,
  ArmorSlot,
  CharacterBody,
  DerivedSheet,
  DerivedSkill,
} from "../api/types";
import type { SkillDefinition } from "../api/types";
import { sortBySkillName, type TranslationKey, type Translator } from "../i18n";
import {
  SPELL_LEVELS,
  casterIsEmpty,
  casterNames,
  emptyLevelRow,
  readSpellBook,
  spellLevelKey,
  spellbookEntryIsEmpty,
  spellbookIsEmpty,
  type SpellCaster,
  type SpellbookEntry,
  type SpellLevelRow,
} from "../lib/spells";
import { Field, Formula, Note, Row, RuledField, Section, SubHeading } from "./primitives";
import { COLOR, FONT, PAGE } from "./theme";

/** How many skill rows the page-one column holds before the rest continues below it. */
const SKILL_ROWS_IN_COLUMN = 46;

/** Which ability each save keys off. The pairing is a rule; both names are translated. */
const SAVE_ABILITY = {
  fortitude: "ability.constitution",
  reflex: "ability.dexterity",
  will: "ability.wisdom",
} as const satisfies Record<(typeof SAVES)[number], TranslationKey>;

const GEAR_SLOTS = [
  { slot: "armor", label: "pdf.gear.slot.armour", full: true },
  { slot: "shield", label: "pdf.gear.slot.shield", full: true },
  { slot: "protective_1", label: "gear.slot.protective", full: false },
  { slot: "protective_2", label: "gear.slot.protective", full: false },
] as const satisfies readonly { slot: ArmorSlot; label: TranslationKey; full: boolean }[];

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLOR.paper,
    color: COLOR.ink,
    fontFamily: FONT.body,
    fontSize: 8,
    paddingTop: PAGE.margin,
    paddingBottom: PAGE.margin + 6,
    paddingHorizontal: PAGE.margin,
  },

  masthead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderBottom: `1.5pt solid ${COLOR.accent}`,
    paddingBottom: 4,
    marginBottom: 5,
  },
  characterName: { fontFamily: FONT.bold, fontSize: 15, color: COLOR.ink },
  mastheadMeta: { fontFamily: FONT.body, fontSize: 7, color: COLOR.inkSoft },

  columns: { flexDirection: "row" },
  leftColumn: { width: "61%", paddingRight: 9 },
  rightColumn: { width: "39%" },
  thirdColumn: { width: "33.33%", paddingRight: 8 },

  // Tables — abilities, skills, possessions.
  tableHead: {
    flexDirection: "row",
    borderBottom: `0.75pt solid ${COLOR.accent}`,
    paddingBottom: 1.5,
    marginBottom: 1,
  },
  tableHeadCell: {
    fontFamily: FONT.bold,
    fontSize: 4.8,
    letterSpacing: 0.4,
    color: COLOR.accent,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottom: `0.4pt solid ${COLOR.rule}`,
    minHeight: 11,
    paddingVertical: 1,
  },
  cell: { fontSize: 6.5, color: COLOR.ink },
  cellMuted: { fontSize: 6.5, color: COLOR.inkSoft },
  /** A value still worth printing that no longer feeds anything — a superseded base score. */
  cellFaint: { fontSize: 6.5, color: COLOR.rule },
  cellTotal: { fontFamily: FONT.bold, fontSize: 7.5, color: COLOR.ink },
  centred: { textAlign: "center" },
  right: { textAlign: "right" },

  classMark: {
    width: 5.5,
    height: 5.5,
    borderRadius: 1,
    border: `0.5pt solid ${COLOR.inkSoft}`,
  },
  classMarkOn: { backgroundColor: COLOR.accent, borderColor: COLOR.accent },

  slot: {
    border: `0.5pt solid ${COLOR.rule}`,
    backgroundColor: COLOR.card,
    borderRadius: 2,
    padding: 3.5,
    marginBottom: 3,
  },

  listLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: `0.4pt solid ${COLOR.rule}`,
    minHeight: 11,
    paddingVertical: 1.5,
  },
  listText: { fontSize: 7, color: COLOR.ink },
  listPage: { fontSize: 6, color: COLOR.inkSoft },

  freeText: { fontSize: 7, color: COLOR.ink, lineHeight: 1.45 },

  /** The spell blocks: half the page each, so two casting classes sit side by side. */
  casterRow: { flexDirection: "row", flexWrap: "wrap" },
  casterBlock: { width: "50%", paddingRight: 8, marginBottom: 4 },

  /** The book: one group per spell level, its spells two to a row inside it. */
  spellbookGroup: { marginBottom: 5 },
  spellbookEntries: { flexDirection: "row", flexWrap: "wrap" },
  spellbookEntry: { width: "50%", paddingRight: 10 },
  spellbookSchool: { fontSize: 6, color: COLOR.inkSoft, marginRight: 4 },
  spellGridLevel: {
    fontFamily: FONT.bold,
    fontSize: 6.5,
    color: COLOR.inkSoft,
    textAlign: "center",
  },

  warning: {
    border: `0.5pt solid ${COLOR.rule}`,
    backgroundColor: COLOR.accentSoft,
    borderRadius: 2,
    padding: 4,
    marginTop: 4,
  },

  footer: {
    position: "absolute",
    bottom: PAGE.margin - 12,
    left: PAGE.margin,
    right: PAGE.margin,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 5.5,
    color: COLOR.inkSoft,
  },
});

/** Presentation only: the engine already decided the sign, this just prints it. */
function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function blank(value: string | null | undefined, t: Translator["t"]): string {
  return value == null || value === "" ? t("pdf.blank") : value;
}

function classAndLevel(character: CharacterBody, t: Translator["t"]): string {
  const levels = character.class_levels ?? [];
  if (levels.length === 0) return t("pdf.blank");
  return levels
    .map((row) => `${row.class_name || t("pdf.classFallback")} ${row.level}`)
    .join(" / ");
}

function armorFor(character: CharacterBody, slot: ArmorSlot): ArmorRow | undefined {
  return (character.armor ?? []).find((piece) => piece.slot === slot);
}

interface Props {
  character: CharacterBody;
  derived: DerivedSheet;
  /** Read on the DOM side and threaded down: react-pdf's tree has no React context. */
  translator: Translator;
  /** For naming the skill rows — a `DerivedSkill` carries only the engine's English name. */
  definitions: SkillDefinition[];
}

/**
 * A skill row's printed name, in the document's language.
 *
 * `DerivedSkill.name` is what the engine was handed, which is the English reference name or, for
 * a custom row, whatever the player typed. Reference rows are renamed from the definition list;
 * custom rows keep the player's own words.
 */
function skillLabel(
  skill: DerivedSkill,
  byId: Map<number, SkillDefinition>,
  translator: Translator,
): string {
  const definition = skill.skill_id == null ? undefined : byId.get(skill.skill_id);
  const base = definition === undefined ? skill.name : translator.skillName(definition);
  return skill.specialization != null && skill.specialization !== ""
    ? `${base} (${skill.specialization})`
    : base;
}

/**
 * Page numbers are rendered by the layout engine rather than passed in: a long possessions list or
 * a sixth attack pushes content onto an extra page, and a footer that had been told it was page one
 * would then say so twice.
 */
function Footer({ translator: { t } }: Props) {
  return (
    <View style={styles.footer} fixed>
      {/* Still a `render` callback and still not a constant: a long possessions list adds a page,
          and a footer told it was page one would say so twice. */}
      <Text
        render={({ pageNumber, totalPages }) =>
          t("pdf.footer.page", { page: pageNumber, total: totalPages })
        }
      />
      <Text>{t("pdf.footer.ogl")}</Text>
    </View>
  );
}

function Masthead({ character, derived, translator: { t } }: Props) {
  return (
    <View style={styles.masthead}>
      <Text style={styles.characterName}>
        {character.name === "" || character.name == null
          ? t("characters.unnamed")
          : character.name}
      </Text>
      <Text style={styles.mastheadMeta}>
        {classAndLevel(character, t)} ·{" "}
        {t("pdf.characterLevel", { level: derived.character_level })}
      </Text>
    </View>
  );
}

function IdentityLines({ character, translator: { t } }: Props) {
  return (
    <View style={{ marginBottom: 7 }}>
      <Row style={{ marginBottom: 4 }}>
        <RuledField label={t("field.characterName")} value={blank(character.name, t)} flex={3} />
        <RuledField label={t("field.player")} value={blank(character.player_name, t)} flex={2} />
      </Row>
      <Row style={{ marginBottom: 4 }}>
        <RuledField
          label={t("pdf.field.classAndLevel")}
          value={classAndLevel(character, t)}
          flex={3}
        />
        <RuledField label={t("field.race")} value={blank(character.race, t)} flex={2} />
        <RuledField label={t("field.alignment")} value={blank(character.alignment, t)} flex={2} />
        <RuledField label={t("field.deity")} value={blank(character.deity, t)} flex={2} />
      </Row>
      <Row>
        <RuledField label={t("field.size")} value={blank(character.size, t)} flex={1} />
        <RuledField label={t("field.age")} value={blank(character.age, t)} flex={1} />
        <RuledField label={t("field.gender")} value={blank(character.gender, t)} flex={1} />
        <RuledField label={t("field.height")} value={blank(character.height, t)} flex={1} />
        <RuledField label={t("field.weight")} value={blank(character.body_weight, t)} flex={1} />
        <RuledField label={t("field.eyes")} value={blank(character.eyes, t)} flex={1} />
        <RuledField label={t("field.hair")} value={blank(character.hair, t)} flex={1} />
        <RuledField label={t("field.skin")} value={blank(character.skin, t)} flex={1} />
      </Row>
    </View>
  );
}

function Abilities({ character, derived, translator: { t } }: Props) {
  const temporaryFor = (key: string): number | null | undefined => {
    const scores: Record<string, number | null | undefined> = {
      strength: character.str_temp,
      dexterity: character.dex_temp,
      constitution: character.con_temp,
      intelligence: character.int_temp,
      wisdom: character.wis_temp,
      charisma: character.cha_temp,
    };
    return scores[key];
  };
  const baseFor = (key: string): number | undefined => {
    const scores: Record<string, number | undefined> = {
      strength: character.str_score,
      dexterity: character.dex_score,
      constitution: character.con_score,
      intelligence: character.int_score,
      wisdom: character.wis_score,
      charisma: character.cha_score,
    };
    return scores[key];
  };

  return (
    <Section title={t("pdf.section.abilities")}>
      <View style={styles.tableHead}>
        <Text style={[styles.tableHeadCell, { flex: 1 }]}>{t("abilities.head.ability")}</Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 40 }]}>
          {t("abilities.head.score")}
        </Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 46 }]}>
          {t("abilities.head.tempScore")}
        </Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 46 }]}>
          {t("abilities.head.modifier")}
        </Text>
      </View>
      {ABILITIES.map(({ key, short }) => {
        const block = derived.abilities[key];
        const temporary = temporaryFor(key);
        const label = t(`ability.${key}`);
        // Only one modifier is derived — the effective one — so the row has to say which score it
        // came from, or a reader checking 14 → +3 concludes the arithmetic is broken. The score
        // that fed it is marked; the one that did not is set back.
        const superseded = block.is_temporary;
        return (
          <View key={key} style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 1 }]}>
              {short} <Text style={styles.cellMuted}>{label}</Text>
            </Text>
            <Text
              style={[superseded ? styles.cellFaint : styles.cell, styles.centred, { width: 40 }]}
            >
              {baseFor(key) ?? t("pdf.blank")}
            </Text>
            <Text style={[styles.cell, styles.centred, { width: 46 }]}>
              {temporary ?? t("pdf.blank")}
              {superseded && <Text style={styles.cellMuted}> ‡</Text>}
            </Text>
            <Text style={[styles.cellTotal, styles.centred, { width: 46 }]}>
              {signed(block.modifier)}
            </Text>
          </View>
        );
      })}
      <Note>{t("pdf.abilities.note")}</Note>
    </Section>
  );
}

function Vitals({ character, translator: { t } }: Props) {
  return (
    <Section title={t("pdf.section.vitals")}>
      <Row>
        <Field label={t("pdf.field.totalHp")} value={character.hp_total ?? 0} total width={36} />
        <Field
          label={t("pdf.field.wounds")}
          value={character.hp_current ?? 0}
          flex={1.3}
          centred
        />
        <Field
          label={t("pdf.field.nonlethal")}
          value={character.nonlethal_damage ?? 0}
          flex={1}
          centred
        />
        <Field label={t("hp.speed")} value={blank(character.speed, t)} flex={1.2} centred />
        <Field
          label={t("pdf.field.damageReduction")}
          value={blank(character.damage_reduction, t)}
          flex={1.2}
          centred
        />
      </Row>
    </Section>
  );
}

function ArmorClass({ derived, translator: { t } }: Props) {
  const ac = derived.armor_class;
  return (
    <Section title={t("pdf.section.armorClass")}>
      <Row style={{ marginBottom: 4 }}>
        <Field label={t("ac.total")} value={ac.total} total flex={1} />
        <Field label={t("pdf.field.touchAc")} value={ac.touch} total flex={1} />
        <Field label={t("pdf.field.flatFootedAc")} value={ac.flat_footed} total flex={1} />
      </Row>
      <Row>
        <Field label={t("pdf.field.base")} value={10} centred flex={1} />
        <Field label={t("pdf.field.armour")} value={signed(ac.armor_bonus)} centred flex={1} />
        <Field label={t("pdf.field.shield")} value={signed(ac.shield_bonus)} centred flex={1} />
        <Field
          label={t("pdf.field.dex")}
          value={signed(ac.effective_dex_bonus)}
          centred
          flex={1}
        />
        <Field label={t("field.size")} value={signed(ac.size_modifier)} centred flex={1} />
        <Field label={t("pdf.field.natural")} value={signed(ac.natural_armor)} centred flex={1} />
        <Field label={t("pdf.field.deflection")} value={signed(ac.deflection)} centred flex={1} />
        <Field label={t("pdf.field.misc")} value={signed(ac.misc)} centred flex={1} />
      </Row>
      <Note>{t("pdf.ac.note")}</Note>
    </Section>
  );
}

function CombatNumbers({ character, derived, translator: { t } }: Props) {
  return (
    <Section title={t("pdf.section.combat")}>
      <Formula
        label={t("init.initiative")}
        total={signed(derived.initiative)}
        parts={[
          {
            label: t("pdf.part.dexMod"),
            value: signed(derived.abilities.dexterity.modifier),
          },
          { label: t("pdf.part.miscMod"), value: signed(character.initiative_misc ?? 0) },
        ]}
      />
      <Formula
        label={t("init.grapple")}
        total={signed(derived.grapple_modifier)}
        parts={[
          { label: t("pdf.part.baseAttack"), value: signed(character.base_attack_bonus ?? 0) },
          {
            label: t("pdf.part.strMod"),
            value: signed(derived.abilities.strength.modifier),
          },
          { label: t("pdf.part.sizeMod"), value: signed(character.grapple_size_modifier ?? 0) },
          { label: t("pdf.part.miscMod"), value: signed(character.grapple_misc ?? 0) },
        ]}
      />
      <Row style={{ marginTop: 1 }}>
        <View style={{ width: 62 }} />
        <Field
          label={t("init.baseAttackBonus")}
          value={signed(character.base_attack_bonus ?? 0)}
          centred
          width={62}
        />
        <Field
          label={t("pdf.field.spellResistance")}
          value={blank(character.spell_resistance, t)}
          centred
          width={62}
        />
        <View style={{ flex: 1 }}>
          <Note>{t("pdf.combat.note")}</Note>
        </View>
      </Row>
    </Section>
  );
}

function SavingThrows({ character, derived, translator: { t } }: Props) {
  return (
    <Section title={t("pdf.section.saves")}>
      {SAVES.map((save) => {
        const block = derived.saves[save];
        return (
          <Formula
            key={save}
            label={`${t(`save.${save}`)}\n${t(SAVE_ABILITY[save])}`}
            total={signed(block.total)}
            parts={[
              { label: t("pdf.part.baseSave"), value: signed(block.base) },
              { label: t("pdf.part.abilityMod"), value: signed(block.ability_modifier) },
              { label: t("pdf.part.magicMod"), value: signed(block.magic) },
              { label: t("pdf.part.miscMod"), value: signed(block.misc) },
              { label: t("pdf.part.tempMod"), value: signed(block.temporary) },
            ]}
          />
        );
      })}
      {(character.saves_conditional_modifiers ?? "") !== "" && (
        <View style={{ marginTop: 2 }}>
          <SubHeading>{t("saves.conditional")}</SubHeading>
          <Text style={styles.freeText}>{character.saves_conditional_modifiers}</Text>
        </View>
      )}
    </Section>
  );
}

/**
 * The paper form prints five attack blocks whether or not a character has five attacks. On an
 * export they are already filled in, so an untouched block is dropped rather than printed empty —
 * five blank frames is a page of nothing, and the blocks that carry an attack get the room.
 */
function Attacks({ character, translator: { t } }: Props) {
  const attacks = (character.attacks ?? []).filter((attack) =>
    [
      attack.name,
      attack.attack_bonus,
      attack.damage,
      attack.critical,
      attack.range,
      attack.damage_type,
      attack.ammunition,
      attack.notes,
    ].some((value) => (value ?? "") !== ""),
  );

  return (
    <Section title={t("pdf.section.attacks")} wrap>
      {attacks.map((attack, index) => {
        const hasSecondLine =
          (attack.ammunition ?? "") !== "" || (attack.notes ?? "") !== "";
        return (
          <View key={attack.id ?? index} style={styles.slot}>
            <Row style={hasSecondLine ? { marginBottom: 3 } : {}}>
              <Field label={t("pdf.section.attacks")} value={blank(attack.name, t)} flex={2.4} />
              <Field
                label={t("attacks.attackBonus")}
                value={blank(attack.attack_bonus, t)}
                flex={1.3}
                centred
              />
              <Field
                label={t("attacks.damage")}
                value={blank(attack.damage, t)}
                flex={1.2}
                centred
              />
              <Field
                label={t("attacks.critical")}
                value={blank(attack.critical, t)}
                flex={1.1}
                centred
              />
              <Field label={t("attacks.range")} value={blank(attack.range, t)} flex={1} centred />
              <Field
                label={t("attacks.type")}
                value={blank(attack.damage_type, t)}
                flex={1.1}
                centred
              />
            </Row>
            {hasSecondLine && (
              <Row>
                <Field
                  label={t("attacks.ammunition")}
                  value={blank(attack.ammunition, t)}
                  flex={1}
                  centred
                />
                <Field label={t("attacks.notes")} value={blank(attack.notes, t)} flex={3.5} />
              </Row>
            )}
          </View>
        );
      })}
      {attacks.length === 0 && <Note>{t("pdf.attacks.empty")}</Note>}
    </Section>
  );
}

function SkillsTable({
  skills,
  title,
  byId,
  translator,
}: {
  skills: DerivedSkill[];
  title: string;
  byId: Map<number, SkillDefinition>;
  translator: Translator;
}) {
  const { t } = translator;
  return (
    <Section title={title} style={{ marginBottom: 6 }} wrap>
      <View style={styles.tableHead}>
        <View style={{ width: 8 }} />
        <Text style={[styles.tableHeadCell, { flex: 1 }]}>{t("skills.head.skill")}</Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 15 }]}>
          {t("pdf.skills.head.key")}
        </Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 20 }]}>
          {t("skills.head.total")}
        </Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 17 }]}>
          {t("pdf.skills.head.abil")}
        </Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 20 }]}>
          {t("skills.head.ranks")}
        </Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 17 }]}>
          {t("skills.head.misc")}
        </Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 17 }]}>
          {t("pdf.skills.head.acp")}
        </Text>
      </View>
      {skills.map((skill, index) => (
        <View key={`${skill.name}-${index}`} style={styles.tableRow}>
          <View style={{ width: 8 }}>
            <View style={[styles.classMark, skill.is_class_skill ? styles.classMarkOn : {}]} />
          </View>
          <Text style={[styles.cell, { flex: 1 }]}>
            {skillLabel(skill, byId, translator)}
            {!skill.usable_untrained && <Text style={styles.cellMuted}> †</Text>}
          </Text>
          <Text style={[styles.cellMuted, styles.centred, { width: 15 }]}>{skill.key_ability}</Text>
          {/* Blank for an unranked skill, as on screen — an export that disagreed with the sheet
              it came from is drift nobody notices until a player is reading the printout. */}
          <Text style={[styles.cellTotal, styles.centred, { width: 20 }]}>
            {skill.ranks === 0 ? t("pdf.blank") : signed(skill.total)}
          </Text>
          <Text style={[styles.cell, styles.centred, { width: 17 }]}>
            {signed(skill.ability_modifier)}
          </Text>
          {/* `String()` for the same reason `Field` does it: ranks are a number now, and
              react-pdf's own reconciler lays out text, not values. */}
          <Text style={[styles.cell, styles.centred, { width: 20 }]}>{String(skill.ranks)}</Text>
          <Text style={[styles.cell, styles.centred, { width: 17 }]}>
            {signed(skill.misc_modifier)}
          </Text>
          <Text style={[styles.cell, styles.centred, { width: 17 }]}>
            {skill.armor_check_penalty === 0 ? t("pdf.blank") : signed(skill.armor_check_penalty)}
          </Text>
        </View>
      ))}
      <Note>{t("pdf.skills.note")}</Note>
    </Section>
  );
}

function Gear({ character, translator: { t, weightInput } }: Props) {
  return (
    <Section title={t("pdf.section.gear")}>
      {GEAR_SLOTS.map(({ slot, label, full }) => {
        const piece = armorFor(character, slot);
        // The armour and shield frames print either way — an empty one says "wearing nothing",
        // which is what the armour class above was derived from. The two spare protective slots
        // say nothing when empty, so they are left out.
        if (piece === undefined && !full) return null;
        return (
          <View key={slot} style={styles.slot}>
            <SubHeading>{t(label)}</SubHeading>
            <Row style={{ marginBottom: full ? 3 : 0 }}>
              <Field label={t("gear.name")} value={blank(piece?.name, t)} flex={2} />
              {full && <Field label={t("gear.type")} value={blank(piece?.type, t)} flex={1.2} />}
              <Field
                label={t("gear.acBonus")}
                value={signed(piece?.ac_bonus ?? 0)}
                flex={1}
                centred
              />
              {/* The reader's unit, as on screen. A printout that disagreed with the sheet it
                  came from about what a breastplate weighs is the drift the shared skill ordering
                  exists to prevent, one column over. */}
              <Field
                label={t("gear.weight")}
                value={weightInput(String(piece?.weight ?? "0"))}
                flex={1}
                centred
              />
            </Row>
            {full && (
              <Row style={{ marginBottom: 3 }}>
                <Field
                  label={t("gear.maxDex")}
                  value={piece?.max_dex ?? t("pdf.blank")}
                  flex={1}
                  centred
                />
                <Field
                  label={t("gear.checkPenalty")}
                  value={piece?.check_penalty ?? 0}
                  flex={1.2}
                  centred
                />
                <Field
                  label={t("pdf.field.spellFailure")}
                  value={`${piece?.spell_failure ?? 0}%`}
                  flex={1.2}
                  centred
                />
                <Field label={t("gear.speed")} value={blank(piece?.speed, t)} flex={1} centred />
              </Row>
            )}
            <Row>
              <Field
                label={t("gear.special")}
                value={blank(piece?.special_properties, t)}
                flex={1}
              />
            </Row>
          </View>
        );
      })}
      <Note>{t("pdf.gear.note")}</Note>
    </Section>
  );
}

function Possessions({
  character,
  derived,
  translator: { t, weight, weightNumber, weightInput },
}: Props) {
  const rows = character.possessions ?? [];
  const load = derived.encumbrance;
  return (
    <Section title={t("pdf.section.possessions")} wrap>
      <View style={styles.tableHead}>
        <Text style={[styles.tableHeadCell, { flex: 1 }]}>{t("possessions.head.item")}</Text>
        <Text style={[styles.tableHeadCell, styles.centred, { width: 22 }]}>
          {t("possessions.head.page")}
        </Text>
        <Text style={[styles.tableHeadCell, styles.right, { width: 28 }]}>
          {t("pdf.possessions.head.wt")}
        </Text>
      </View>
      {rows.map((row, index) => (
        <View key={index} style={styles.tableRow}>
          <Text style={[styles.cell, { flex: 1 }]}>{blank(row.item, t)}</Text>
          <Text style={[styles.cellMuted, styles.centred, { width: 22 }]}>
            {blank(row.page, t)}
          </Text>
          <Text style={[styles.cell, styles.right, { width: 28 }]}>
            {weightInput(String(row.weight ?? "0"))}
          </Text>
        </View>
      ))}
      {rows.length === 0 && <Note>{t("pdf.possessions.empty")}</Note>}

      <Row style={{ marginTop: 5 }}>
        <Field
          label={t("possessions.totalWeight")}
          value={weight(load.carried_weight)}
          total
          flex={1}
        />
        <Field label={t("possessions.load")} value={t(`load.${load.category}`)} total flex={1} />
      </Row>
      {/* The six limits below print bare, under the total that names the unit — so they go through
          the same converter as that total. The printout and the screen share one formatter for
          exactly this reason: an export that disagreed with the sheet it came from is drift nobody
          notices until a player is reading it at the table. */}
      <Row style={{ marginTop: 4 }}>
        <Field
          label={t("possessions.lightLoad")}
          value={weightNumber(load.light_load)}
          centred
          flex={1}
        />
        <Field
          label={t("possessions.mediumLoad")}
          value={weightNumber(load.medium_load)}
          centred
          flex={1}
        />
        <Field
          label={t("possessions.heavyLoad")}
          value={weightNumber(load.heavy_load)}
          centred
          flex={1}
        />
      </Row>
      <Row style={{ marginTop: 3 }}>
        <Field
          label={t("possessions.liftOverHead")}
          value={weightNumber(load.lift_over_head)}
          centred
          flex={1}
        />
        <Field
          label={t("possessions.liftOffGround")}
          value={weightNumber(load.lift_off_ground)}
          centred
          flex={1}
        />
        <Field
          label={t("possessions.pushOrDrag")}
          value={weightNumber(load.push_or_drag)}
          centred
          flex={1}
        />
      </Row>
      <Note>{t("pdf.possessions.note")}</Note>
    </Section>
  );
}

function Money({ character, translator: { t } }: Props) {
  return (
    <Section title={t("pdf.section.money")}>
      <Row>
        <Field label={t("money.platinum")} value={character.money_pp ?? 0} centred flex={1} />
        <Field label={t("money.gold")} value={character.money_gp ?? 0} centred flex={1} />
        <Field label={t("money.silver")} value={character.money_sp ?? 0} centred flex={1} />
        <Field label={t("money.copper")} value={character.money_cp ?? 0} centred flex={1} />
      </Row>
    </Section>
  );
}

function NamedList({
  title,
  entries,
  empty,
  t,
}: {
  title: string;
  entries: { name?: string | null; page?: string | null }[];
  empty: string;
  t: Translator["t"];
}) {
  return (
    <Section title={title} wrap>
      {entries.map((entry, index) => (
        <View key={index} style={styles.listLine}>
          <Text style={styles.listText}>{blank(entry.name, t)}</Text>
          {(entry.page ?? "") !== "" && (
            <Text style={styles.listPage}>{t("pdf.page.label", { page: entry.page ?? "" })}</Text>
          )}
        </View>
      ))}
      {entries.length === 0 && <Note>{empty}</Note>}
    </Section>
  );
}

function Languages({ character, translator: { t } }: Props) {
  const languages = character.languages ?? [];
  return (
    <Section title={t("pdf.section.languages")}>
      {languages.map((language, index) => (
        <View key={index} style={styles.listLine}>
          <Text style={styles.listText}>{language}</Text>
        </View>
      ))}
      {languages.length === 0 && <Note>{t("pdf.languages.empty")}</Note>}
    </Section>
  );
}

/** The grid's four figure columns, in the order the printed form prints them around LEVEL. */
const SPELL_FIGURES = [
  { key: "known", head: "pdf.spells.head.known" },
  { key: "save_dc", head: "pdf.spells.head.saveDc" },
  null, // where the LEVEL column goes — the form puts it in the middle, not at the edge
  { key: "per_day", head: "pdf.spells.head.perDay" },
  { key: "bonus", head: "pdf.spells.head.bonus" },
] as const satisfies readonly ({
  key: keyof SpellLevelRow;
  head: TranslationKey;
} | null)[];

/**
 * One spellcasting class, laid out the way the printed form lays out its SPELLS column: the domains
 * line, the two boxes, and the grid.
 *
 * The grid always prints all ten rows, filled or not — it is the reference table a player reads
 * during play, and it costs about a hundred points to print in full. The spells themselves are not
 * here: they are the free-text notes, printed once beside the blocks rather than level by level
 * inside each of them.
 *
 * Every figure is printed as it was typed. Nothing on this block is derived.
 */
function CasterBlock({
  caster,
  name,
  translator: { t },
}: {
  caster: SpellCaster;
  name: string;
  translator: Translator;
}) {
  return (
    <View style={styles.casterBlock}>
      <View style={styles.slot}>
        <SubHeading>{name}</SubHeading>
        <Row style={{ marginBottom: 3 }}>
          <RuledField label={t("pdf.spells.domains")} value={blank(caster.domains, t)} flex={1} />
        </Row>
        <Row>
          <Field
            label={t("pdf.spells.saveDcMod")}
            value={blank(caster.save_dc_mod, t)}
            centred
            flex={1}
          />
          <Field
            label={t("pdf.spells.arcaneFailure")}
            value={caster.arcane_failure === "" ? t("pdf.blank") : `${caster.arcane_failure}%`}
            centred
            flex={1}
          />
        </Row>
      </View>

      <View style={[styles.tableHead, { marginTop: 4 }]}>
        {SPELL_FIGURES.map((column, index) => (
          <Text
            key={column?.key ?? "level"}
            style={[
              styles.tableHeadCell,
              styles.centred,
              { flex: index === 2 ? 0.7 : 1 },
            ]}
          >
            {t(column === null ? "pdf.spells.head.level" : column.head)}
          </Text>
        ))}
      </View>
      {SPELL_LEVELS.map((level) => {
        const row = caster.levels[level] ?? emptyLevelRow();
        return (
          <View key={level} style={styles.tableRow}>
            {SPELL_FIGURES.map((column) =>
              column === null ? (
                <Text key="level" style={[styles.spellGridLevel, { flex: 0.7 }]}>
                  {t(spellLevelKey(level))}
                </Text>
              ) : (
                <Text key={column.key} style={[styles.cell, styles.centred, { flex: 1 }]}>
                  {row[column.key]}
                </Text>
              ),
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * The spell section, and the one part of page two that is a row of its own rather than a column.
 *
 * The printed form has a single SPELLS column because it has a single page to give it. A character
 * with two casting classes needs two of them side by side, which is why this sits under the three
 * columns and lays its blocks out at half the page each: two casters share a row, a third wraps,
 * and the free-text notes take the half a lone caster leaves empty rather than a row of their own.
 */
function Spells({ character, translator }: Props) {
  const { t } = translator;
  const book = readSpellBook(character.spells_raw);
  // Named before the empty ones are dropped: a caster's name is decided against every other
  // caster's, including the blank block a player added and has not filled in yet.
  const names = casterNames(book.casters, t);
  const casters = book.casters
    .map((caster, index) => ({ caster, name: names[index] ?? "" }))
    .filter(({ caster }) => !casterIsEmpty(caster));

  return (
    <Section title={t("pdf.section.spells")} wrap>
      {casters.length === 0 && book.notes === "" && <Note>{t("pdf.spells.empty")}</Note>}
      <View style={styles.casterRow}>
        {casters.map(({ caster, name }, index) => (
          <CasterBlock key={index} caster={caster} name={name} translator={translator} />
        ))}
        {book.notes !== "" && (
          <View style={styles.casterBlock}>
            <SubHeading>{t("pdf.spells.notesHeading")}</SubHeading>
            <Text style={styles.freeText}>{book.notes}</Text>
          </View>
        )}
      </View>
      {casters.length > 0 && <Note>{t("pdf.spells.note")}</Note>}
    </Section>
  );
}

/**
 * One spell as the book records it: what it is called, what school it belongs to, and where the
 * rulebook writes it up. The same three columns page three shows, laid out as the feats and
 * special-abilities lists are — a line with the name on it and the reference set back at the end.
 *
 * Two to a row. A spell name is a few words and the school shorter still; a full-width line each
 * would spend two thirds of the page on white space and double the length of a wizard's book.
 */
function SpellbookEntryLine({ entry, t }: { entry: SpellbookEntry; t: Translator["t"] }) {
  return (
    // `wrap={false}`, and this is the whole reason the line is a component: react-pdf breaks a
    // laid-out row wherever the page ends, and a book long enough to paginate was leaving a
    // spell's school and page at the foot of one page with its name at the head of the next.
    // The line is one reading; it moves whole or not at all.
    <View style={styles.spellbookEntry} wrap={false}>
      <View style={styles.listLine}>
        <Text style={[styles.listText, { flex: 1, paddingRight: 4 }]}>{blank(entry.name, t)}</Text>
        {entry.school !== "" && <Text style={styles.spellbookSchool}>{entry.school}</Text>}
        {entry.page !== "" && (
          <Text style={styles.listPage}>{t("pdf.page.label", { page: entry.page })}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * The spellbook — a page of its own, and this application's own: the printed record sheet has no
 * such page, because a book of scribed spells is a list with no length and paper has to stop
 * somewhere. A PDF does not, so the book prints in full and the footer's page count grows with it.
 *
 * This is the book's *contents*; page two's grid is what is cast out of it. The two answer
 * different questions at the table, which is why both are printed.
 *
 * **A spell's level is its position in the book**, never a field on the entry — see
 * `lib/spells.ts`. So the levels are headings over their spells rather than a column beside them,
 * exactly as page three draws them.
 *
 * A level with nothing scribed at it is left out, and so is a row a player added and never filled
 * in. That is `Attacks`' rule: on screen an empty row is the invitation to fill it, on a printout
 * it is a ruled line saying nothing. `pdf.spellbook.note` says so, since an absent level 6 reads as
 * a defect otherwise.
 */
function Spellbook({ character, translator: { t } }: Props) {
  const { spellbook } = readSpellBook(character.spells_raw);
  return (
    <Section title={t("pdf.section.spellbook")} wrap>
      {SPELL_LEVELS.map((level) => {
        const entries = (spellbook[level] ?? []).filter(
          (entry) => !spellbookEntryIsEmpty(entry),
        );
        if (entries.length === 0) return null;
        return (
          // `wrap` on the group as well as the section: a wizard can have thirty spells at one
          // level, and a group told to stay whole would be pushed to a page it still overruns.
          // `minPresenceAhead` is what keeps the level heading off the foot of a page with its
          // first spell overleaf — the same defect the entry line's `wrap={false}` fixes, one
          // level up, and 20pt is a heading and a line of spells.
          <View key={level} style={styles.spellbookGroup} wrap minPresenceAhead={20}>
            <SubHeading>{t("pdf.spellbook.group", { level })}</SubHeading>
            <View style={styles.spellbookEntries}>
              {entries.map((entry, index) => (
                <SpellbookEntryLine key={index} entry={entry} t={t} />
              ))}
            </View>
          </View>
        );
      })}
      <Note>{t("pdf.spellbook.note")}</Note>
    </Section>
  );
}

/**
 * The warnings, printed as the engine sent them.
 *
 * Unlike the on-screen panel, these lines are **not** rebuilt from `code` and `params`: the
 * rewriting logic lives in `RuleWarnings.tsx`, which is a DOM component, and duplicating it here
 * would put the same sentence-building in two places to drift apart. An exported sheet carries a
 * handful of English lines under a translated heading; the screen is where a player reads them.
 */
function Warnings({ derived, translator: { t } }: Props) {
  const warnings = derived.warnings ?? [];
  if (warnings.length === 0) return null;
  return (
    <View style={styles.warning}>
      <SubHeading>{t("sheet.warnings.title")}</SubHeading>
      {warnings.map((warning, index) => (
        <Text key={index} style={[styles.freeText, { fontSize: 6.5 }]}>
          • {warning.message}
        </Text>
      ))}
      <Note>{t("sheet.warnings.note")}</Note>
    </View>
  );
}

export function CharacterSheetDocument({ character, derived, translator, definitions }: Props) {
  const props = { character, derived, translator, definitions };
  const { t } = translator;
  // The third page prints only when there is a book to print. A blank page headed SPELLBOOK on
  // every fighter's export is what `Attacks` refuses five blank frames of, one scale up.
  const hasSpellbook = !spellbookIsEmpty(readSpellBook(character.spells_raw).spellbook);
  // Alphabetical in the document's language, by the same rule the screen uses — sorted before
  // the column is split, so the overflow continues the alphabet rather than restarting it.
  const skills = sortBySkillName(
    derived.skills ?? [],
    (skill) => skill.skill_id,
    definitions,
    translator,
  );
  const columnSkills = skills.slice(0, SKILL_ROWS_IN_COLUMN);
  const overflowSkills = skills.slice(SKILL_ROWS_IN_COLUMN);
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  return (
    <Document
      title={t("pdf.documentTitle", { name: character.name || t("characters.unnamed") })}
      author={character.player_name || undefined}
    >
      <Page size={PAGE.size} style={styles.page}>
        <Masthead {...props} />
        <IdentityLines {...props} />

        <View style={styles.columns}>
          <View style={styles.leftColumn}>
            <Abilities {...props} />
            <Vitals {...props} />
            <ArmorClass {...props} />
            <CombatNumbers {...props} />
            <SavingThrows {...props} />
            <Attacks {...props} />
          </View>
          <View style={styles.rightColumn}>
            <SkillsTable
              skills={columnSkills}
              title={t("pdf.section.skills")}
              byId={byId}
              translator={translator}
            />
          </View>
        </View>

        {overflowSkills.length > 0 && (
          <SkillsTable
            skills={overflowSkills}
            title={t("pdf.section.skillsContinued")}
            byId={byId}
            translator={translator}
          />
        )}

        <Footer {...props} />
      </Page>

      <Page size={PAGE.size} style={styles.page}>
        <Masthead {...props} />
        <Row style={{ marginBottom: 7 }}>
          <RuledField label={t("field.campaign")} value={blank(character.campaign, t)} flex={3} />
          <RuledField
            label={t("field.experiencePoints")}
            value={String(character.experience_points ?? 0)}
            flex={1}
          />
        </Row>
        <View style={styles.columns}>
          <View style={styles.thirdColumn}>
            <Gear {...props} />
            <Money {...props} />
          </View>
          <View style={styles.thirdColumn}>
            <Possessions {...props} />
          </View>
          <View style={[styles.thirdColumn, { paddingRight: 0 }]}>
            <NamedList
              title={t("pdf.section.feats")}
              entries={character.feats ?? []}
              empty={t("pdf.feats.empty")}
              t={t}
            />
            <NamedList
              title={t("pdf.section.specialAbilities")}
              entries={character.special_abilities ?? []}
              empty={t("pdf.specialAbilities.empty")}
              t={t}
            />
            <Languages {...props} />
          </View>
        </View>
        {/* Below the three columns rather than inside one: a character with two casting classes
            needs two blocks side by side, and a third of a page does not hold one of them. */}
        <Spells {...props} />
        <Warnings {...props} />
        <Footer {...props} />
      </Page>

      {hasSpellbook && (
        <Page size={PAGE.size} style={styles.page}>
          {/* A page that can be read on its own has to name the character on it: a spellbook
              separated from the two sheets in front of it is otherwise anybody's. */}
          <Masthead {...props} />
          <Spellbook {...props} />
          <Footer {...props} />
        </Page>
      )}
    </Document>
  );
}
