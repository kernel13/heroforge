/**
 * The English dictionary — and, because `Dictionary` is `typeof en`, the definition of what a
 * complete translation is. A key added here is a type error in `fr.ts` until it is translated,
 * which is the point: a half-translated interface is a worse experience than an untranslated one.
 *
 * Keys are flat and dotted. Nesting reads better in a file and worse everywhere else — `t()` would
 * need a path type, and a missing key would surface as `undefined` rendered into the page rather
 * than as a compile error.
 *
 * `{placeholder}` marks an interpolation. Where the substituted value is a React element rather
 * than a string — a link, an `<abbr>` — the same template is rendered through `tNodes` instead of
 * `t`, so that word order stays the translator's decision and is not hard-coded by splitting the
 * sentence into fragments at the callsite.
 *
 * Skill names are *not* here. They are reference data, they live in the `skills` table, and they
 * arrive with the rest of a skill's definition from `GET /api/skills`.
 */
export const en = {
  // ── Shell ────────────────────────────────────────────────────────────────────────────────
  "app.title": "Character sheet manager",
  "app.signOut": "Sign out",
  "app.loading": "Loading…",
  "app.loadingSheet": "Loading sheet…",
  "app.characterNotOpened": "That character could not be opened.",
  // The nav's ruleset mark. Both halves are proper names — an edition of the System Reference
  // Document and the title of a licence — so both stay as they are in every dictionary, the same
  // way the language endonyms do.
  "app.srd": "SRD 3.5",
  "app.srdLicence": "Open Game License",
  "app.footer.ogl":
    "Game mechanics from the System Reference Document, used under the Open Game License 1.0a. See {link}.",
  "app.footer.oglLink": "the licence",
  "app.footer.icons":
    "Section icons from {link} under CC BY 3.0. See {credits}.",
  "app.footer.iconsCredits": "the icon credits",
  "app.footer.fonts":
    "Headings set in Cinzel and MedievalSharp, under the SIL Open Font License. See {credits}.",
  "app.footer.fontsCredits": "the font credits",

  // ── Language ─────────────────────────────────────────────────────────────────────────────
  "language.choose": "Choose a language",
  // Endonyms, and identical in every dictionary on purpose: a French speaker looking at an
  // English interface scans for "Français", not for "French".
  "language.en": "English",
  "language.fr": "Français",
  "language.en.short": "EN",
  "language.fr.short": "FR",

  // ── Sign in, sign up, verification, reset ────────────────────────────────────────────────
  "auth.description":
    "Keep a D&D 3.5 character sheet that works out its own arithmetic — armour class, saves, skill totals, grapple, initiative, and encumbrance.",
  "auth.tab.login": "Sign in",
  "auth.tab.register": "Create an account",
  "auth.tab.forgot": "Forgot password",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.newPassword": "New password",
  "auth.submit.login": "Sign in",
  "auth.submit.register": "Create account",
  "auth.submit.forgot": "Send reset link",
  "auth.notice.registered":
    "Check your email and follow the link to confirm your address. You can sign in once it is confirmed.",
  "auth.notice.reset":
    "If that address has an account, a reset link is on its way.",
  "auth.landing.passwordChanged": "Password changed",
  "auth.landing.addressConfirmed": "Address confirmed",
  "auth.landing.choosePassword": "Choose a new password",
  "auth.landing.confirmAddress": "Confirm your address",
  "auth.landing.setPassword": "Set password",
  "auth.landing.confirm": "Confirm",
  "auth.landing.signIn": "Sign in",

  // Server errors are reported by status rather than by echoing the problem document's `detail`:
  // that string is written by the API in English and no component literal would ever cover it.
  "error.credentials":
    "That email address and password do not match an account, or the address is not confirmed yet.",
  "error.invalid":
    "Something in that form was not accepted. Check the address and the password length.",
  "error.rateLimited": "Too many attempts. Wait a moment and try again.",
  "error.notFound": "That is no longer there.",
  "error.server":
    "The server had a problem. Nothing you typed was lost — try again.",
  "error.unreachable": "Could not reach the server.",
  "error.generic": "Something went wrong. Please try again.",

  // ── The character list ───────────────────────────────────────────────────────────────────
  "characters.title": "Your characters",
  "characters.new": "New character",
  "characters.namePlaceholder": "Name",
  "characters.create": "Create",
  "characters.creating": "Creating…",
  "characters.loading": "Loading…",
  "characters.loadFailed": "Could not load your characters.",
  "characters.empty":
    "Nothing here yet. Create a character and the arithmetic starts working itself out.",
  "characters.unnamed": "Unnamed character",
  "characters.noClass": "No class yet",
  // The tile's ledger says what to do instead of leaving a gap where a list of classes would be.
  "characters.noClassHint":
    "Open the sheet and add one — the level works itself out from there.",
  "characters.delete": "Delete",
  "characters.deleteNamed": "Delete {name}",
  // The caption over the tile's gold total, and the total's own accessible name. Both, because the
  // figure is an `<output>` whose caption is a sibling element: the caption is what a reader sees
  // and the name is what a screen reader and a test address it by.
  "characters.levelCap": "Level",
  "characters.level": "Level {level}",
  // No classes typed yet, so there is no level to print and "Level 0" would be a false one.
  "characters.levelUnset": "—",
  // What the head band and the foot say where the player has filled nothing in. Set in italic, so
  // an unset field reads as unset rather than as a race called "Race not set".
  "characters.raceUnset": "Race not set",
  "characters.campaignUnset": "No campaign",
  // How long ago the character was last touched is written by `Intl.RelativeTimeFormat`, which
  // needs no dictionary — except under a minute, where it gives the bare adverb "now" and the foot
  // would read "No campaign · now".
  "characters.justNow": "Just now",
  // The card's own control names itself, rather than leaving its accessible name to be assembled
  // from the name and the race under it — "Bramwell Human" is a label nobody wrote.
  "characters.open": "Open {name}",
  // The portrait control is icon-only, so these are its accessible name and nothing else is.
  "characters.portraitAdd": "Add a portrait for {name}",
  "characters.portraitChange": "Change the portrait of {name}",
  "characters.portraitRemove": "Remove the portrait of {name}",
  "characters.portraitSaving": "Saving the portrait…",
  "characters.portraitType": "Choose a PNG, JPEG, WebP or GIF image.",
  "characters.portraitUnreadable": "That image could not be read.",
  "characters.portraitFailed": "The portrait could not be saved.",

  // ── The sheet's frame ────────────────────────────────────────────────────────────────────
  "sheet.back": "All characters",
  "sheet.characterLevel": "Character level {level}",
  "sheet.addClassBelow": " — add a class below",
  // The frame beside the identity fields. The alt is the whole of the image's accessible name;
  // the second line is shown only where there is no picture, and says where one comes from —
  // the portrait is uploaded from the character list, never from the sheet.
  "sheet.portrait": "Portrait",
  "sheet.portraitEmpty": "No portrait yet. Add one from the character list.",
  "sheet.pages": "Character sheet pages",
  "sheet.page1": "Page 1",
  "sheet.page2": "Page 2",
  "sheet.page3": "Page 3",
  "sheet.warnings.title": "Worth a look",
  "sheet.warnings.note":
    "Reported, not refused — house rules and homebrew are normal play.",

  // ── The derived rail ─────────────────────────────────────────────────────────────────────
  // Everything the engine worked out, in one place that does not scroll away. The rail's own
  // copy is here; the values it shows reuse the keys of the panels they used to sit in, because
  // they are the same facts under the same names and both suites address them by those names.
  "rail.title": "Worked out for you",
  // One sentence rather than five labelled boxes. Every part is optional — a character with no
  // race, alignment, class, or deity yet still has to read as a sentence and not as punctuation
  // with nothing between it, so the component assembles only the parts that have a value and
  // the translator keeps the joining words with them.
  "rail.who.race": "A {alignment} {race}",
  "rail.who.raceOnly": "A {race}",
  "rail.who.alignmentOnly": "{alignment}",
  "rail.who.deity": "sworn to {deity}",
  "rail.who.unnamed": "A character with nothing filled in yet.",
  "rail.abilityModifiers": "Ability modifiers",
  "rail.parts.show": "How this was worked out",
  "rail.parts.base": "Base",
  "rail.parts.armour": "Armour",
  "rail.parts.shield": "Shield",
  "rail.parts.dexApplied": "Dexterity applied",
  "rail.parts.natural": "Natural armour",
  "rail.parts.deflection": "Deflection",
  "rail.parts.size": "Size",
  "rail.parts.misc": "Misc",
  "rail.parts.baseAttack": "Base attack bonus",
  "rail.parts.strength": "Strength",
  "rail.hitPoints": "Hit points",
  "rail.hitPoints.ofTotal": "Of total",
  "rail.hitPoints.damageReduction": "DR",
  "rail.hitPoints.nonlethal": "Nonlethal",
  "rail.saves": "Saving throws",
  "rail.save.fortitude": "Fort",
  "rail.save.reflex": "Ref",
  "rail.save.will": "Will",
  "rail.load": "Load",
  "rail.load.carrying": "Carrying {weight} — a {category} load.",
  "rail.load.aria":
    "Carried weight against the light, medium, and heavy limits",
  "rail.warnings": "{count} worth a look",

  // ── Autosave ─────────────────────────────────────────────────────────────────────────────
  "save.saved": "All changes saved",
  "save.pending": "Unsaved changes",
  "save.saving": "Saving…",
  "save.failed": "Your changes are not saved.",
  "save.retry": "Try again",
  "save.conflict":
    "This character was changed in another tab or window. Reload to see the current version before saving again — your edits here are still on screen.",

  // ── Export ───────────────────────────────────────────────────────────────────────────────
  "export.button": "Export PDF",
  "export.busy": "Preparing PDF…",
  "export.failed": "The PDF could not be built. Nothing was lost — try again.",

  // ── Rules warnings, rebuilt from the code and its parameters ─────────────────────────────
  "warning.ranks_over_maximum":
    "{skill}: {ranks} ranks exceeds the {kind} maximum of {max} at character level {level}.",
  "warning.kind.class": "class",
  "warning.kind.cross_class": "cross-class",
  "warning.dex_bonus_exceeds_max_dex":
    "Dexterity bonus of {dex} exceeds the armour's maximum Dexterity bonus of {max}; AC uses {applied}.",
  // The unit is inside `{weight}` and `{max}`, not written into the sentence: the engine sends
  // pounds and the reader may be shown kilograms, and a warning that disagreed with the rail it
  // sits above would read as the engine contradicting itself.
  "warning.overloaded":
    "Carrying {weight} exceeds the maximum load of {max}. The character can no longer move under this weight.",
  "warning.unknown_skill": "Skill {id} is not in the reference list.",

  // ── Panel headings ───────────────────────────────────────────────────────────────────────
  "panel.character": "Character",
  "panel.classLevel": "Class and level",
  "panel.abilities": "Abilities",
  "panel.hitPoints": "Hit points",
  "panel.armorClass": "Armour class",
  "panel.initiativeGrapple": "Initiative and grapple",
  "panel.savingThrows": "Saving throws",
  "panel.attacks": "Attacks",
  "panel.skills": "Skills",
  "panel.campaign": "Campaign",
  "panel.gear": "Gear",
  "panel.possessions": "Possessions",
  "panel.money": "Money",
  "panel.feats": "Feats",
  "panel.specialAbilities": "Special abilities",
  "panel.languages": "Languages",
  "panel.spells": "Spells",
  "panel.spellbook": "Spellbook",

  // ── The identity line ────────────────────────────────────────────────────────────────────
  "field.characterName": "Character name",
  "field.player": "Player",
  "field.race": "Race",
  "field.alignment": "Alignment",
  "field.deity": "Deity",
  "field.size": "Size",
  "field.age": "Age",
  "field.gender": "Gender",
  "field.height": "Height",
  "field.weight": "Weight",
  "field.eyes": "Eyes",
  "field.hair": "Hair",
  "field.skin": "Skin",
  "field.campaign": "Campaign",
  "field.experiencePoints": "Experience points",

  // ── Abilities ────────────────────────────────────────────────────────────────────────────
  "ability.strength": "Strength",
  "ability.dexterity": "Dexterity",
  "ability.constitution": "Constitution",
  "ability.intelligence": "Intelligence",
  "ability.wisdom": "Wisdom",
  "ability.charisma": "Charisma",
  "abilities.head.ability": "Ability",
  "abilities.head.score": "Score",
  "abilities.head.modifier": "Modifier",
  "abilities.head.tempScore": "Temp. score",
  "abilities.head.modifierInUse": "Modifier in use",
  "abilities.aria.score": "{ability} score",
  "abilities.aria.modifier": "{ability} modifier",
  "abilities.aria.tempScore": "{ability} temporary score",

  // ── Hit points ───────────────────────────────────────────────────────────────────────────
  "hp.total": "Total",
  "hp.current": "Current",
  "hp.nonlethal": "Nonlethal damage",
  "hp.damageReduction": "Damage reduction",
  "hp.speed": "Speed",
  "hp.spellResistance": "Spell resistance",

  // ── Armour class ─────────────────────────────────────────────────────────────────────────
  "ac.total": "Armour class",
  "ac.touch": "Touch",
  "ac.flatFooted": "Flat-footed",
  "ac.formula":
    "10 + armour {armor} + shield {shield} + Dexterity {dex} + size {size} + natural {natural} + deflection {deflection} + misc {misc}",
  "ac.armorBonus": "Armour bonus",
  "ac.armorBonus.title": "From the armour slot on page 2",
  "ac.shieldBonus": "Shield bonus",
  "ac.shieldBonus.title": "From the shield slot on page 2",
  "ac.dexApplied": "Dexterity bonus applied",
  "ac.dexApplied.title": "Limited by the armour's maximum Dexterity bonus",
  "ac.natural": "Natural armour",
  "ac.deflection": "Deflection",
  "ac.size": "Size modifier",
  "ac.misc": "Misc modifier",

  // ── Initiative and grapple ───────────────────────────────────────────────────────────────
  "init.initiative": "Initiative",
  "init.grapple": "Grapple",
  "init.dexUncapped": "Dexterity modifier (uncapped)",
  "init.dexUncapped.title":
    "Uncapped: the armour's maximum Dexterity bonus limits AC, not initiative",
  "init.initiativeMisc": "Initiative misc",
  "init.baseAttackBonus": "Base attack bonus",
  "init.strengthGrapple": "Strength modifier (grapple)",
  "init.grappleSize": "Grapple size modifier",
  "init.grappleMisc": "Grapple misc",
  "init.note.size":
    "The grapple size modifier is not the armour-class size modifier. A Small creature has +1 to AC but −4 to grapple.",
  "init.note.bab":
    "Base attack bonus is typed here rather than derived: working it out needs class progression tables, which are not part of this phase.",

  // ── Saving throws ────────────────────────────────────────────────────────────────────────
  "save.fortitude": "Fortitude",
  "save.reflex": "Reflex",
  "save.will": "Will",
  "saves.head.save": "Save",
  "saves.head.base": "Base",
  "saves.head.ability": "Ability",
  "saves.head.magic": "Magic",
  "saves.head.misc": "Misc",
  "saves.head.temporary": "Temporary",
  "saves.aria.total": "{save} total",
  "saves.aria.base": "{save} base save",
  "saves.aria.magic": "{save} magic",
  "saves.aria.misc": "{save} misc",
  "saves.aria.temporary": "{save} temporary",
  "saves.conditional": "Conditional modifiers",
  "saves.note":
    "Base saves are typed here for the same reason as the base attack bonus.",

  // ── Attacks ──────────────────────────────────────────────────────────────────────────────
  "attacks.note":
    "The attack bonus and damage are written here rather than worked out: deriving them needs weapon data, size modifiers, and iterative attacks from the base attack bonus.",
  "attacks.legend": "Attack {n}",
  "attacks.name": "Name",
  "attacks.attackBonus": "Attack bonus",
  "attacks.damage": "Damage",
  "attacks.critical": "Critical",
  "attacks.range": "Range",
  "attacks.type": "Type",
  "attacks.ammunition": "Ammunition",
  "attacks.notes": "Notes",

  // ── Skills ───────────────────────────────────────────────────────────────────────────────
  "skills.head.class": "Class",
  "skills.head.class.title":
    "Mark the skills your class treats as class skills",
  "skills.head.skill": "Skill",
  "skills.head.keyAbility": "Key ability",
  "skills.head.total": "Total",
  "skills.head.ranks": "Ranks",
  "skills.head.ability": "Ability",
  "skills.head.armour": "Armour",
  "skills.head.armour.title": "Armour check penalty, doubled for Swim",
  "skills.head.misc": "Misc",
  "skills.head.maxRanks": "Max ranks",
  "skills.aria.classSkill": "{skill} is a class skill",
  "skills.aria.name": "Skill name",
  "skills.aria.specialisation": "{skill} specialisation",
  "skills.aria.total": "{skill} total",
  "skills.aria.ranks": "{skill} ranks",
  "skills.aria.remove": "Remove {skill}",
  // One key with the number interpolated as an element, not "ranks" concatenated after an
  // `<output>`: a language that puts the count elsewhere in the phrase has to be able to.
  "skills.totalRanks": "{total} ranks assigned",
  "skills.aria.totalRanks": "Total ranks assigned",
  "skills.aria.misc": "{skill} misc modifier",
  "skills.placeholder.specialisation": "specialisation",
  "skills.trainedOnly": "Trained only",
  "skills.acp": "Armour check penalty applies",
  "skills.acpDouble": "Armour check penalty applies twice",
  "skills.addRow": "Add a skill row",
  "skills.newSkill": "New skill",
  "skills.note":
    "Ranks are whole numbers, and the maximum in any skill is your character level + 3 whether it is a class skill or not. A total appears once a skill has at least one rank. {acp} marks a skill the armour check penalty applies to; {acpDouble} marks Swim, where it applies twice. {trained} marks a skill that cannot be used untrained.",

  // ── Class and level ──────────────────────────────────────────────────────────────────────
  "classLevels.class": "Class",
  "classLevels.level": "Level",
  "classLevels.remove": "Remove class {n}",
  "classLevels.add": "Add a class",
  "classLevels.note":
    "The sum of these levels is the character level that sets the maximum ranks in every skill.",

  // ── Gear ─────────────────────────────────────────────────────────────────────────────────
  "gear.slot.armour": "Armour",
  "gear.slot.shield": "Shield",
  "gear.slot.protective": "Protective item",
  "gear.note":
    "Check penalties are written as they appear on the armour table — full plate is −6, not 6. Total applied: {total}.",
  "gear.name": "Name",
  "gear.type": "Type",
  "gear.acBonus": "AC bonus",
  "gear.maxDex": "Max Dex",
  "gear.checkPenalty": "Check penalty",
  "gear.spellFailure": "Spell failure %",
  "gear.speed": "Speed",
  "gear.weight": "Weight",
  "gear.special": "Special properties",
  "gear.remove": "Remove",

  // ── Possessions and encumbrance ──────────────────────────────────────────────────────────
  "possessions.head.item": "Item",
  "possessions.head.page": "Pg.",
  "possessions.head.page.title": "Rulebook page reference",
  "possessions.head.weight": "Weight",
  "possessions.aria.item": "Possession {n} item",
  "possessions.aria.page": "Possession {n} page",
  "possessions.aria.weight": "Possession {n} weight",
  "possessions.aria.remove": "Remove possession {n}",
  "possessions.add": "Add an item",
  "possessions.totalWeight": "Total weight carried",
  "possessions.load": "Load",
  "possessions.lightLoad": "Light load",
  "possessions.mediumLoad": "Medium load",
  "possessions.heavyLoad": "Heavy load",
  "possessions.liftOverHead": "Lift over head",
  "possessions.liftOffGround": "Lift off ground",
  "possessions.pushOrDrag": "Push or drag",
  "possessions.note":
    "The weight on the identity line is the character’s own weight and plays no part in this.",
  "load.light": "light",
  "load.medium": "medium",
  "load.heavy": "heavy",
  "load.overloaded": "overloaded",
  /**
   * Pounds — the unit the engine works in, and the unit of every weight the player types.
   *
   * The *displayed* unit is the reader's, not the engine's: a French sheet prints the engine's
   * loads in kilograms. `translatorFor()` picks between these two keys; a callsite never does.
   */
  "unit.lb": "lb.",
  "unit.kg": "kg",

  // ── Money ────────────────────────────────────────────────────────────────────────────────
  "money.platinum": "Platinum",
  "money.gold": "Gold",
  "money.silver": "Silver",
  "money.copper": "Copper",

  // ── Feats, special abilities, languages, spells ──────────────────────────────────────────
  "lists.head.name": "Name",
  "lists.head.page": "Pg.",
  "lists.head.page.title": "Rulebook page reference",
  "lists.aria.name": "{list} {n} name",
  "lists.aria.page": "{list} {n} page",
  "lists.aria.remove": "Remove {list} {n}",
  "lists.add": "Add",
  "languages.aria.name": "Language {n}",
  "languages.aria.remove": "Remove language {n}",
  "languages.add": "Add a language",
  // ── The spellbook, page 3 ────────────────────────────────────────────────────────────────
  "spellbook.head.name": "Spell",
  "spellbook.head.school": "School",
  // The plain number, not the written ordinal: each language writes its own phrase around it.
  "spellbook.group": "Level {level} spells",
  "spellbook.add": "Add",
  "spellbook.aria.add": "Add a spell at level {level}",
  "spellbook.aria.name": "Level {level} spell {n} name",
  "spellbook.aria.school": "Level {level} spell {n} school",
  "spellbook.aria.page": "Level {level} spell {n} page",
  "spellbook.aria.remove": "Remove level {level} spell {n}",
  "spellbook.note":
    "What is written in the book, not what is prepared from it. How many spells of each level the character knows and can cast per day is the grid on page 2.",

  "spells.notes.label": "Notes",
  "spells.note":
    "Stored as written. Spells per day, bonus spells, save DCs, and arcane spell failure are not worked out in this phase, so nothing typed here is lost while that waits.",

  // ── Spellcasting classes ─────────────────────────────────────────────────────────────────
  // A caster's own name is what identifies it in every one of its controls' accessible names, so
  // an unnamed or a duplicated one has to be told apart some other way — see `casterNames()`.
  "spells.caster.unnamed": "Spellcasting class {n}",
  "spells.caster.numbered": "{name} ({n})",
  // The class is named in the block's own legend, not in a field under it: it is the block's
  // title, and a titled box that repeats its title in its first box wastes a row of the form.
  "spells.caster.rename": "Rename {caster}",
  "spells.caster.placeholder": "Enter your class",
  "spells.caster.domains": "Domains / specialty school",
  "spells.caster.saveDcMod": "Spell save DC mod.",
  "spells.caster.arcaneFailure": "Arcane spell failure %",
  "spells.aria.class": "Spellcasting class {n}",
  "spells.aria.domains": "{caster} domains / specialty school",
  "spells.aria.saveDcMod": "{caster} spell save DC mod.",
  "spells.aria.arcaneFailure": "{caster} arcane spell failure %",
  "spells.aria.known": "{caster} spells known, level {level}",
  "spells.aria.saveDc": "{caster} save DC, level {level}",
  "spells.aria.perDay": "{caster} spells per day, level {level}",
  "spells.aria.bonus": "{caster} bonus spells, level {level}",
  "spells.aria.remove": "Remove {caster}",
  "spells.head.level": "Level",
  "spells.head.known": "Spells known",
  "spells.head.saveDc": "Spell save DC",
  "spells.head.perDay": "Spells per day",
  "spells.head.bonus": "Bonus spells",
  "spells.add": "Add a spellcasting class",
  "spells.remove": "Remove",
  "spells.casters.note":
    "One block per spellcasting class. Which of a character's classes casts is written here rather than read from the class levels — class reference data is a later phase.",
  // The spell levels, written out rather than assembled from a number and a suffix: “1st” is an
  // English ordinal rule, and a component that builds it has put that rule in the interface.
  "spells.level.0": "0",
  "spells.level.1": "1st",
  "spells.level.2": "2nd",
  "spells.level.3": "3rd",
  "spells.level.4": "4th",
  "spells.level.5": "5th",
  "spells.level.6": "6th",
  "spells.level.7": "7th",
  "spells.level.8": "8th",
  "spells.level.9": "9th",

  // ── The exported PDF ─────────────────────────────────────────────────────────────────────
  "pdf.documentTitle": "{name} — character record",
  "pdf.filename": "{name} — character sheet.pdf",
  "pdf.filenameFallback": "character",
  "pdf.footer.page": "Character record — page {page} of {total}",
  "pdf.footer.ogl":
    "Game mechanics from the System Reference Document under the Open Game License 1.0a.",
  "pdf.blank": "—",
  "pdf.characterLevel": "character level {level}",
  "pdf.classFallback": "Class",
  "pdf.section.abilities": "Abilities",
  "pdf.section.vitals": "Hit points and speed",
  "pdf.section.armorClass": "Armour class",
  "pdf.section.combat": "Initiative, attack, and grapple",
  "pdf.section.saves": "Saving throws",
  "pdf.section.attacks": "Attacks",
  "pdf.section.skills": "Skills",
  "pdf.section.skillsContinued": "Skills continued",
  "pdf.section.gear": "Gear",
  "pdf.section.possessions": "Other possessions",
  "pdf.section.money": "Money",
  "pdf.section.feats": "Feats",
  "pdf.section.specialAbilities": "Special abilities",
  "pdf.section.languages": "Languages",
  "pdf.section.spells": "Spells",
  "pdf.abilities.note":
    "‡ marks the score the modifier was taken from. A temporary score replaces the base score everywhere the sheet uses it, so the base is set back rather than removed.",
  "pdf.field.classAndLevel": "Class and level",
  "pdf.field.totalHp": "Total HP",
  "pdf.field.wounds": "Wounds / current",
  "pdf.field.nonlethal": "Nonlethal",
  "pdf.field.damageReduction": "Damage red.",
  "pdf.field.touchAc": "Touch AC",
  "pdf.field.flatFootedAc": "Flat-footed AC",
  "pdf.field.base": "Base",
  "pdf.field.armour": "Armour",
  "pdf.field.shield": "Shield",
  "pdf.field.dex": "Dex",
  "pdf.field.natural": "Natural",
  "pdf.field.deflection": "Deflect.",
  "pdf.field.misc": "Misc",
  "pdf.field.spellResistance": "Spell resistance",
  "pdf.field.spellFailure": "Spell fail.",
  "pdf.ac.note":
    "The Dexterity bonus shown is the one actually applied after any armour maximum, and it reaches the touch and flat-footed totals alike.",
  "pdf.part.dexMod": "Dex mod.",
  "pdf.part.miscMod": "Misc mod.",
  "pdf.part.baseAttack": "Base attack",
  "pdf.part.strMod": "Str mod.",
  "pdf.part.sizeMod": "Size mod.",
  "pdf.part.baseSave": "Base save",
  "pdf.part.abilityMod": "Ability mod.",
  "pdf.part.magicMod": "Magic mod.",
  "pdf.part.tempMod": "Temp mod.",
  "pdf.combat.note":
    "The base attack bonus is written down rather than worked out — deriving it needs class progression tables.",
  "pdf.attacks.empty": "No attacks recorded.",
  "pdf.skills.head.key": "Key",
  "pdf.skills.head.abil": "Abil.",
  "pdf.skills.head.acp": "ACP",
  "pdf.skills.note":
    "A filled mark is a class skill. † may not be used untrained. Ranks are whole numbers, and the maximum in any skill is the character level + 3 whether it is a class skill or not. A skill with no ranks shows no total.",
  "pdf.gear.slot.armour": "Armour / protective item",
  "pdf.gear.slot.shield": "Shield / protective item",
  "pdf.gear.note":
    "Check penalties are written as they appear on the armour table — full plate is −6, not 6.",
  "pdf.possessions.empty": "Nothing carried.",
  "pdf.possessions.head.wt": "Wt.",
  "pdf.possessions.note":
    "Carried weight comes from possessions and worn armour. The weight on the identity line is the character’s own and plays no part in it.",
  "pdf.feats.empty": "No feats recorded.",
  "pdf.specialAbilities.empty": "No special abilities recorded.",
  "pdf.languages.empty": "None recorded.",
  "pdf.spells.empty": "No spells recorded.",
  "pdf.spells.notesHeading": "Notes",
  "pdf.spells.domains": "Domains / specialty school",
  "pdf.spells.saveDcMod": "Spell save DC mod.",
  "pdf.spells.arcaneFailure": "Arcane spell failure",
  // The grid's own headings. Separate from the screen's because the columns are a few points wide
  // and a longer translation has to be abbreviated here without being abbreviated there; the note
  // under the grid writes each of them out in full, as `pdf.possessions.head.wt` does.
  "pdf.spells.head.level": "Level",
  "pdf.spells.head.known": "Known",
  "pdf.spells.head.saveDc": "Save DC",
  "pdf.spells.head.perDay": "Per day",
  "pdf.spells.head.bonus": "Bonus",
  "pdf.spells.note":
    "Spells known, save DC, spells per day, and bonus spells are written down, not worked out: deriving them needs class progression tables. The spells themselves are in the notes beside this grid.",
  "pdf.page.label": "p. {page}",
} as const;

/** Every key a translation must supply, and the shape `fr.ts` is checked against. */
export type Dictionary = Record<keyof typeof en, string>;
export type TranslationKey = keyof typeof en;
