/**
 * The sheet's icon vocabulary — one glyph per section of the character sheet.
 *
 * Icons come from Iconify's `game-icons` set, resolved at build time by `unplugin-icons` from
 * `~icons/game-icons/<name>`. Nothing is fetched from api.iconify.design at runtime: a self-hosted
 * deployment whose CORS is restricted to its own origin would otherwise put a third-party request
 * on every page load, and would render iconless on a boxed-in network.
 *
 * Naming an icon here rather than at the callsite keeps the vocabulary in one place — a section
 * and its icon are chosen together, and the same glyph means the same thing on both pages (the
 * shield is armour class and the shield slot; nothing else).
 *
 * These components carry no `aria-hidden` of their own — unlike `lucide-react`, `unplugin-icons`
 * emits the raw SVG. `Panel` and `Fieldset` hide them in the wrapper instead, so no callsite can
 * leak an icon into a heading's accessible name. Do not render one of these bare next to text.
 */
import ArmorVest from "~icons/game-icons/armor-vest";
import Backpack from "~icons/game-icons/backpack";
import Breastplate from "~icons/game-icons/breastplate";
import Character from "~icons/game-icons/character";
import Conversation from "~icons/game-icons/conversation";
import CrossedSwords from "~icons/game-icons/crossed-swords";
import DiceTwentyFacesTwenty from "~icons/game-icons/dice-twenty-faces-twenty";
import Dodge from "~icons/game-icons/dodge";
import HealthNormal from "~icons/game-icons/health-normal";
import OpenBook from "~icons/game-icons/open-book";
import PointySword from "~icons/game-icons/pointy-sword";
import PowerRing from "~icons/game-icons/power-ring";
import Rank3 from "~icons/game-icons/rank-3";
import Shield from "~icons/game-icons/shield";
import Skills from "~icons/game-icons/skills";
import Sparkles from "~icons/game-icons/sparkles";
import SpellBook from "~icons/game-icons/spell-book";
import Sprint from "~icons/game-icons/sprint";
import StarMedal from "~icons/game-icons/star-medal";
import Strong from "~icons/game-icons/strong";
import TreasureMap from "~icons/game-icons/treasure-map";
import TwoCoins from "~icons/game-icons/two-coins";

/** Page 1: the identity line, then the numbers the sheet asks you to work out. */
export const IconCharacter = Character;
export const IconClassLevel = Rank3;
export const IconAbilities = Strong;
export const IconHitPoints = HealthNormal;
export const IconArmorClass = Shield;
export const IconInitiative = Sprint;
export const IconSaves = Dodge;
export const IconAttacks = CrossedSwords;
export const IconSkills = Skills;

/** Page 2: campaign, what the character carries, and what they know. */
export const IconCampaign = TreasureMap;
export const IconGear = Breastplate;
export const IconPossessions = Backpack;
export const IconMoney = TwoCoins;
export const IconFeats = StarMedal;
export const IconSpecialAbilities = Sparkles;
export const IconLanguages = Conversation;
export const IconSpells = SpellBook;

/**
 * Page 3: the book itself.
 *
 * A different glyph from `IconSpells` on purpose. The closed, sigil-marked book is what a caster
 * *can cast*; the open one is the list of what is written inside. Giving both sections the same
 * shape would break the rule the rest of this file keeps — one glyph, one meaning — precisely
 * where the two sections are most easily confused with each other.
 */
export const IconSpellbook = OpenBook;

/** The repeated sub-blocks: one armour slot, one attack. */
export const IconArmorSlot = ArmorVest;
export const IconShieldSlot = Shield;
export const IconProtectiveItem = PowerRing;
export const IconAttack = PointySword;

/**
 * Not a section of the sheet: the mark in the nav that says which rules these are.
 *
 * A d20 is the die the SRD's whole resolution system is built on, so it names the ruleset without
 * borrowing anything the OGL does not cover — no wordmark, no logo, no trade dress. It lives here
 * with the rest for the reason the others do: it is a game-icons glyph, and every one of those has
 * to be credited in ICONS.txt.
 */
export const IconSrd = DiceTwentyFacesTwenty;
