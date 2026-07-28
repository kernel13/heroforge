/**
 * The French dictionary.
 *
 * Typed as `Dictionary`, so a key added to `en.ts` and not translated here fails `tsc` — and
 * therefore CI — rather than falling through to English at runtime in front of a user.
 *
 * Skill names are not here: they are reference data and come from `GET /api/skills`.
 *
 * Terminology follows the French D&D 3.5 vocabulary in general use — *classe d'armure*, *jet de
 * sauvegarde*, *rang*, *lutte* — rather than a literal rendering of the English. These are this
 * project's own translations; the SRD itself is published in English.
 */
import type { Dictionary } from "./en";

export const fr: Dictionary = {
  // ── Shell ────────────────────────────────────────────────────────────────────────────────
  "app.title": "Gestionnaire de feuilles de personnage",
  "app.signOut": "Se déconnecter",
  "app.loading": "Chargement…",
  "app.loadingSheet": "Chargement de la feuille…",
  "app.characterNotOpened": "Ce personnage n'a pas pu être ouvert.",
  // Noms propres : l'édition du System Reference Document et le titre de la licence. Comme les
  // noms de langue, ils restent identiques — voir en.ts.
  "app.srd": "SRD 3.5",
  "app.srdLicence": "Open Game License",
  "app.footer.ogl":
    "Mécaniques de jeu issues du System Reference Document, utilisées sous licence Open Game License 1.0a. Voir {link}.",
  "app.footer.oglLink": "la licence",
  "app.footer.icons":
    "Icônes de section provenant de {link}, sous licence CC BY 3.0. Voir {credits}.",
  "app.footer.iconsCredits": "les crédits des icônes",
  "app.footer.fonts":
    "Titres composés en Cinzel et MedievalSharp, sous licence SIL Open Font License. Voir {credits}.",
  "app.footer.fontsCredits": "les crédits des polices",

  // ── Langue ───────────────────────────────────────────────────────────────────────────────
  "language.choose": "Choisir une langue",
  // Les noms de langue restent dans leur propre langue — voir en.ts.
  "language.en": "English",
  "language.fr": "Français",
  "language.en.short": "EN",
  "language.fr.short": "FR",

  // ── Connexion, inscription, vérification, réinitialisation ───────────────────────────────
  "auth.description":
    "Tenez une feuille de personnage D&D 3.5 qui fait elle-même ses calculs — classe d'armure, jets de sauvegarde, totaux de compétences, lutte, initiative et charge.",
  "auth.tab.login": "Se connecter",
  "auth.tab.register": "Créer un compte",
  "auth.tab.forgot": "Mot de passe oublié",
  "auth.email": "Adresse e-mail",
  "auth.password": "Mot de passe",
  "auth.newPassword": "Nouveau mot de passe",
  "auth.submit.login": "Se connecter",
  "auth.submit.register": "Créer le compte",
  "auth.submit.forgot": "Envoyer le lien",
  "auth.notice.registered":
    "Consultez votre boîte mail et suivez le lien pour confirmer votre adresse. Vous pourrez vous connecter une fois l'adresse confirmée.",
  "auth.notice.reset":
    "Si un compte existe pour cette adresse, un lien de réinitialisation est en route.",
  "auth.landing.passwordChanged": "Mot de passe modifié",
  "auth.landing.addressConfirmed": "Adresse confirmée",
  "auth.landing.choosePassword": "Choisissez un nouveau mot de passe",
  "auth.landing.confirmAddress": "Confirmez votre adresse",
  "auth.landing.setPassword": "Définir le mot de passe",
  "auth.landing.confirm": "Confirmer",
  "auth.landing.signIn": "Se connecter",

  "error.credentials":
    "Cette adresse e-mail et ce mot de passe ne correspondent à aucun compte, ou l'adresse n'est pas encore confirmée.",
  "error.invalid":
    "Quelque chose dans ce formulaire n'a pas été accepté. Vérifiez l'adresse et la longueur du mot de passe.",
  "error.rateLimited":
    "Trop de tentatives. Patientez un instant, puis réessayez.",
  "error.notFound": "Cet élément n'existe plus.",
  "error.server":
    "Le serveur a rencontré un problème. Rien de ce que vous avez saisi n'est perdu — réessayez.",
  "error.unreachable": "Impossible de joindre le serveur.",
  "error.generic": "Une erreur est survenue. Veuillez réessayer.",

  // ── Liste des personnages ────────────────────────────────────────────────────────────────
  "characters.title": "Vos personnages",
  "characters.new": "Nouveau personnage",
  "characters.namePlaceholder": "Nom",
  "characters.create": "Créer",
  "characters.creating": "Création…",
  "characters.loading": "Chargement…",
  "characters.loadFailed": "Impossible de charger vos personnages.",
  "characters.empty":
    "Rien ici pour l'instant. Créez un personnage et les calculs commencent à se faire tout seuls.",
  "characters.unnamed": "Personnage sans nom",
  "characters.noClass": "Pas encore de classe",
  "characters.noClassHint":
    "Ouvrez la feuille et ajoutez-en une — le niveau se calcule ensuite tout seul.",
  "characters.delete": "Supprimer",
  "characters.deleteNamed": "Supprimer {name}",
  "characters.levelCap": "Niveau",
  "characters.level": "Niveau {level}",
  "characters.levelUnset": "—",
  "characters.raceUnset": "Race non renseignée",
  "characters.campaignUnset": "Aucune campagne",
  "characters.justNow": "À l'instant",
  "characters.open": "Ouvrir {name}",
  "characters.portraitAdd": "Ajouter un portrait pour {name}",
  "characters.portraitChange": "Changer le portrait de {name}",
  "characters.portraitRemove": "Retirer le portrait de {name}",
  "characters.portraitSaving": "Enregistrement du portrait…",
  "characters.portraitType": "Choisissez une image PNG, JPEG, WebP ou GIF.",
  "characters.portraitUnreadable": "Cette image n'a pas pu être lue.",
  "characters.portraitFailed": "Le portrait n'a pas pu être enregistré.",

  // ── Cadre de la feuille ──────────────────────────────────────────────────────────────────
  "sheet.back": "Tous les personnages",
  "sheet.characterLevel": "Niveau de personnage {level}",
  "sheet.addClassBelow": " — ajoutez une classe ci-dessous",
  "sheet.portrait": "Portrait",
  "sheet.portraitEmpty":
    "Pas encore de portrait. Ajoutez-en un depuis la liste des personnages.",
  "sheet.pages": "Pages de la feuille de personnage",
  "sheet.page1": "Page 1",
  "sheet.page2": "Page 2",
  "sheet.page3": "Page 3",
  "sheet.warnings.title": "À regarder de plus près",
  "sheet.warnings.note":
    "Signalé, et non refusé — les règles maison et le contenu personnalisé font partie du jeu.",

  // ── La colonne des valeurs calculées ─────────────────────────────────────────────────────
  "rail.title": "Calculé pour vous",
  "rail.who.race": "Un personnage {race}, d’alignement {alignment}",
  "rail.who.raceOnly": "Un personnage {race}",
  "rail.who.alignmentOnly": "D’alignement {alignment}",
  "rail.who.deity": "au service de {deity}",
  "rail.who.unnamed": "Un personnage dont rien n’est encore rempli.",
  "rail.abilityModifiers": "Mod. de caractéristique",
  "rail.parts.show": "Comment ce nombre est obtenu",
  "rail.parts.base": "Base",
  "rail.parts.armour": "Armure",
  "rail.parts.shield": "Bouclier",
  "rail.parts.dexApplied": "Dextérité appliquée",
  "rail.parts.natural": "Armure naturelle",
  "rail.parts.deflection": "Parade",
  "rail.parts.size": "Taille",
  "rail.parts.misc": "Divers",
  "rail.parts.baseAttack": "Bonus de base à l’attaque",
  "rail.parts.strength": "Force",
  "rail.hitPoints": "Points de vie",
  "rail.hitPoints.ofTotal": "Sur",
  "rail.hitPoints.damageReduction": "RD",
  "rail.hitPoints.nonlethal": "Non-létaux",
  "rail.saves": "Jets de sauvegarde",
  "rail.save.fortitude": "Vig.",
  "rail.save.reflex": "Réf.",
  "rail.save.will": "Vol.",
  "rail.load": "Charge",
  "rail.load.carrying": "Transporte {weight} — charge {category}.",
  "rail.load.aria":
    "Poids transporté par rapport aux limites légère, intermédiaire et lourde",
  "rail.warnings": "{count} à regarder de plus près",

  // ── Enregistrement automatique ───────────────────────────────────────────────────────────
  "save.saved": "Toutes les modifications sont enregistrées",
  "save.pending": "Modifications non enregistrées",
  "save.saving": "Enregistrement…",
  "save.failed": "Vos modifications ne sont pas enregistrées.",
  "save.retry": "Réessayer",
  "save.conflict":
    "Ce personnage a été modifié dans un autre onglet ou une autre fenêtre. Rechargez pour voir la version actuelle avant d'enregistrer de nouveau — vos modifications restent affichées ici.",

  // ── Export ───────────────────────────────────────────────────────────────────────────────
  "export.button": "Exporter en PDF",
  "export.busy": "Préparation du PDF…",
  "export.failed":
    "Le PDF n'a pas pu être généré. Rien n'a été perdu — réessayez.",

  // ── Avertissements de règles ─────────────────────────────────────────────────────────────
  "warning.ranks_over_maximum":
    "{skill} : {ranks} rangs dépassent le maximum {kind} de {max} au niveau de personnage {level}.",
  "warning.kind.class": "de classe",
  "warning.kind.cross_class": "hors classe",
  "warning.dex_bonus_exceeds_max_dex":
    "Le bonus de Dextérité de {dex} dépasse le bonus de Dextérité maximal de l'armure, qui est de {max} ; la CA utilise {applied}.",
  "warning.overloaded":
    "Une charge de {weight} dépasse la charge maximale de {max}. Le personnage ne peut plus se déplacer sous ce poids.",
  "warning.unknown_skill":
    "La compétence {id} ne figure pas dans la liste de référence.",

  // ── Titres de section ────────────────────────────────────────────────────────────────────
  "panel.character": "Personnage",
  "panel.classLevel": "Classe et niveau",
  "panel.abilities": "Caractéristiques",
  "panel.hitPoints": "Points de vie",
  "panel.armorClass": "Classe d'armure",
  "panel.initiativeGrapple": "Initiative et lutte",
  "panel.savingThrows": "Jets de sauvegarde",
  "panel.attacks": "Attaques",
  "panel.skills": "Compétences",
  "panel.campaign": "Campagne",
  "panel.gear": "Équipement",
  "panel.possessions": "Possessions",
  "panel.money": "Argent",
  "panel.feats": "Dons",
  "panel.specialAbilities": "Capacités spéciales",
  "panel.languages": "Langues",
  "panel.spells": "Sorts",
  "panel.spellbook": "Grimoire",

  // ── Ligne d'identité ─────────────────────────────────────────────────────────────────────
  "field.characterName": "Nom du personnage",
  "field.player": "Joueur",
  "field.race": "Race",
  "field.alignment": "Alignement",
  "field.deity": "Divinité",
  "field.size": "Taille",
  "field.age": "Âge",
  "field.gender": "Sexe",
  "field.height": "Hauteur",
  "field.weight": "Poids",
  "field.eyes": "Yeux",
  "field.hair": "Cheveux",
  "field.skin": "Peau",
  "field.campaign": "Campagne",
  "field.experiencePoints": "Points d'expérience",

  // ── Caractéristiques ─────────────────────────────────────────────────────────────────────
  "ability.strength": "Force",
  "ability.dexterity": "Dextérité",
  "ability.constitution": "Constitution",
  "ability.intelligence": "Intelligence",
  "ability.wisdom": "Sagesse",
  "ability.charisma": "Charisme",
  "abilities.head.ability": "Caractéristique",
  "abilities.head.score": "Valeur",
  "abilities.head.modifier": "Modificateur",
  "abilities.head.tempScore": "Valeur temp.",
  "abilities.head.modifierInUse": "Modificateur utilisé",
  "abilities.aria.score": "Valeur de {ability}",
  "abilities.aria.modifier": "Modificateur de {ability}",
  "abilities.aria.tempScore": "Valeur temporaire de {ability}",

  // ── Points de vie ────────────────────────────────────────────────────────────────────────
  "hp.total": "Total",
  "hp.current": "Actuels",
  "hp.nonlethal": "Dégâts non létaux",
  "hp.damageReduction": "Réduction de dégâts",
  "hp.speed": "Vitesse de déplacement",
  "hp.spellResistance": "Résistance à la magie",

  // ── Classe d'armure ──────────────────────────────────────────────────────────────────────
  "ac.total": "Classe d'armure",
  "ac.touch": "CA de contact",
  "ac.flatFooted": "CA pris au dépourvu",
  "ac.formula":
    "10 + armure {armor} + bouclier {shield} + Dextérité {dex} + taille {size} + naturelle {natural} + parade {deflection} + divers {misc}",
  "ac.armorBonus": "Bonus d'armure",
  "ac.armorBonus.title": "Provient de l'emplacement d'armure, page 2",
  "ac.shieldBonus": "Bonus de bouclier",
  "ac.shieldBonus.title": "Provient de l'emplacement de bouclier, page 2",
  "ac.dexApplied": "Bonus de Dextérité appliqué",
  "ac.dexApplied.title": "Limité par le bonus de Dextérité maximal de l'armure",
  "ac.natural": "Armure naturelle",
  "ac.deflection": "Parade",
  "ac.size": "Modificateur de taille",
  "ac.misc": "Modificateur divers",

  // ── Initiative et lutte ──────────────────────────────────────────────────────────────────
  "init.initiative": "Initiative",
  "init.grapple": "Lutte",
  "init.dexUncapped": "Modificateur de Dextérité (non plafonné)",
  "init.dexUncapped.title":
    "Non plafonné : le bonus de Dextérité maximal de l'armure limite la CA, pas l'initiative",
  "init.initiativeMisc": "Initiative divers",
  "init.baseAttackBonus": "Bonus de base à l'attaque",
  "init.strengthGrapple": "Modificateur de Force (lutte)",
  "init.grappleSize": "Modificateur de taille (lutte)",
  "init.grappleMisc": "Lutte divers",
  "init.note.size":
    "Le modificateur de taille pour la lutte n'est pas celui de la classe d'armure. Une créature de taille P a +1 à la CA mais −4 en lutte.",
  "init.note.bab":
    "Le bonus de base à l'attaque se saisit ici plutôt qu'il n'est calculé : l'obtenir demande les tables de progression des classes, qui ne font pas partie de cette phase.",

  // ── Jets de sauvegarde ───────────────────────────────────────────────────────────────────
  "save.fortitude": "Vigueur",
  "save.reflex": "Réflexes",
  "save.will": "Volonté",
  "saves.head.save": "Jet",
  "saves.head.base": "Base",
  "saves.head.ability": "Caractéristique",
  "saves.head.magic": "Magie",
  "saves.head.misc": "Divers",
  "saves.head.temporary": "Temporaire",
  "saves.aria.total": "Total de {save}",
  "saves.aria.base": "Jet de base de {save}",
  "saves.aria.magic": "Magie de {save}",
  "saves.aria.misc": "Divers de {save}",
  "saves.aria.temporary": "Temporaire de {save}",
  "saves.conditional": "Modificateurs conditionnels",
  "saves.note":
    "Les jets de sauvegarde de base se saisissent ici pour la même raison que le bonus de base à l'attaque.",

  // ── Attaques ─────────────────────────────────────────────────────────────────────────────
  "attacks.note":
    "Le bonus d'attaque et les dégâts sont saisis ici plutôt que calculés : les obtenir demande les données des armes, les modificateurs de taille et les attaques itératives issues du bonus de base à l'attaque.",
  "attacks.legend": "Attaque {n}",
  "attacks.name": "Nom",
  "attacks.attackBonus": "Bonus d'attaque",
  "attacks.damage": "Dégâts",
  "attacks.critical": "Critique",
  "attacks.range": "Portée",
  "attacks.type": "Type",
  "attacks.ammunition": "Munitions",
  "attacks.notes": "Notes",

  // ── Compétences ──────────────────────────────────────────────────────────────────────────
  "skills.head.class": "Classe",
  "skills.head.class.title":
    "Cochez les compétences que votre classe traite comme compétences de classe",
  "skills.head.skill": "Compétence",
  "skills.head.keyAbility": "Caractéristique clé",
  "skills.head.total": "Total",
  "skills.head.ranks": "Rangs",
  "skills.head.ability": "Caractéristique",
  "skills.head.armour": "Armure",
  "skills.head.armour.title": "Malus d'armure aux tests, doublé pour Natation",
  "skills.head.misc": "Divers",
  "skills.head.maxRanks": "Rangs max.",
  "skills.aria.classSkill": "{skill} est une compétence de classe",
  "skills.aria.name": "Nom de la compétence",
  "skills.aria.specialisation": "Spécialisation de {skill}",
  "skills.aria.total": "Total de {skill}",
  "skills.aria.ranks": "Rangs de {skill}",
  "skills.aria.remove": "Supprimer {skill}",
  "skills.totalRanks": "{total} rangs répartis",
  "skills.aria.totalRanks": "Total des rangs répartis",
  "skills.aria.misc": "Modificateur divers de {skill}",
  "skills.placeholder.specialisation": "spécialisation",
  "skills.trainedOnly": "Formation nécessaire",
  "skills.acp": "Le malus d'armure aux tests s'applique",
  "skills.acpDouble": "Le malus d'armure aux tests s'applique deux fois",
  "skills.addRow": "Ajouter une ligne de compétence",
  "skills.newSkill": "Nouvelle compétence",
  // « hors classe » est le mot de `warning.kind.cross_class` : le même terme sur le même panneau.
  "skills.note.ranks":
    "Les rangs sont des nombres entiers. Le maximum dans une compétence est le niveau du personnage + 3, ou la moitié de ce total, arrondie à l'inférieur, pour une compétence hors classe.",
  "skills.note.total": "Le total s'affiche dès qu'une compétence a au moins un rang.",

  // ── Classe et niveau ─────────────────────────────────────────────────────────────────────
  "classLevels.class": "Classe",
  "classLevels.level": "Niveau",
  "classLevels.remove": "Retirer la classe {n}",
  "classLevels.add": "Ajouter une classe",
  "classLevels.note":
    "La somme de ces niveaux donne le niveau de personnage qui fixe le maximum de rangs dans chaque compétence.",

  // ── Équipement ───────────────────────────────────────────────────────────────────────────
  "gear.slot.armour": "Armure",
  "gear.slot.shield": "Bouclier",
  "gear.slot.protective": "Objet de protection",
  "gear.note":
    "Les malus aux tests s'écrivent comme dans la table des armures — une armure de plates complète est à −6, pas 6. Total appliqué : {total}.",
  "gear.name": "Nom",
  "gear.type": "Type",
  "gear.acBonus": "Bonus de CA",
  "gear.maxDex": "Dex. max.",
  "gear.checkPenalty": "Malus aux tests",
  "gear.spellFailure": "Risque d'échec des sorts %",
  "gear.speed": "Vitesse",
  "gear.weight": "Poids (lb)",
  "gear.special": "Propriétés spéciales",
  "gear.remove": "Retirer",

  // ── Possessions et charge ────────────────────────────────────────────────────────────────
  "possessions.head.item": "Objet",
  "possessions.head.page": "Pg.",
  "possessions.head.page.title": "Référence de page dans les règles",
  // Le total sous cette colonne est en kilogrammes, mais ce que l'on saisit ici reste en livres —
  // c'est l'unité du moteur de règles. La colonne le dit plutôt que de le laisser deviner.
  "possessions.head.weight": "Poids (lb)",
  "possessions.aria.item": "Objet {n} de la possession",
  "possessions.aria.page": "Page de la possession {n}",
  "possessions.aria.weight": "Poids de la possession {n}",
  "possessions.aria.remove": "Retirer la possession {n}",
  "possessions.add": "Ajouter un objet",
  "possessions.totalWeight": "Poids total transporté",
  "possessions.load": "Charge",
  "possessions.lightLoad": "Charge légère",
  "possessions.mediumLoad": "Charge intermédiaire",
  "possessions.heavyLoad": "Charge lourde",
  "possessions.liftOverHead": "Soulever au-dessus de la tête",
  "possessions.liftOffGround": "Soulever du sol",
  "possessions.pushOrDrag": "Pousser ou tirer",
  "possessions.note":
    "Le poids indiqué sur la ligne d'identité est celui du personnage lui-même et n'entre pas dans ce calcul.",
  "load.light": "légère",
  "load.medium": "intermédiaire",
  "load.heavy": "lourde",
  "load.overloaded": "surchargée",
  // Kept for a weight this build could not read as a number, which is passed through in the unit it
  // arrived in rather than relabelled. Every load the engine returns is shown in kilograms.
  "unit.lb": "lb",
  "unit.kg": "kg",

  // ── Argent ───────────────────────────────────────────────────────────────────────────────
  "money.platinum": "Platine",
  "money.gold": "Or",
  "money.silver": "Argent",
  "money.copper": "Cuivre",

  // ── Dons, capacités spéciales, langues, sorts ────────────────────────────────────────────
  "lists.head.name": "Nom",
  "lists.head.page": "Pg.",
  "lists.head.page.title": "Référence de page dans les règles",
  "lists.aria.name": "Nom de {list} {n}",
  "lists.aria.page": "Page de {list} {n}",
  "lists.aria.remove": "Retirer {list} {n}",
  "lists.add": "Ajouter",
  "languages.aria.name": "Langue {n}",
  "languages.aria.remove": "Retirer la langue {n}",
  "languages.add": "Ajouter une langue",
  // ── Le grimoire, page 3 ──────────────────────────────────────────────────────────────────
  "spellbook.head.name": "Sort",
  "spellbook.head.school": "École",
  "spellbook.group": "Sorts de niveau {level}",
  "spellbook.add": "Ajouter",
  "spellbook.aria.add": "Ajouter un sort de niveau {level}",
  "spellbook.aria.name": "Nom du sort {n} de niveau {level}",
  "spellbook.aria.school": "École du sort {n} de niveau {level}",
  "spellbook.aria.page": "Page du sort {n} de niveau {level}",
  "spellbook.aria.remove": "Retirer le sort {n} de niveau {level}",
  "spellbook.note":
    "Ce qui est inscrit dans le grimoire, et non ce qui en est préparé. Le nombre de sorts de chaque niveau que le personnage connaît et peut lancer par jour est la grille de la page 2.",

  "spells.notes.label": "Notes",
  "spells.note":
    "Conservé tel quel. Les sorts par jour, les sorts en bonus, les DD des jets de sauvegarde et le risque d'échec des sorts profanes ne sont pas calculés dans cette phase : rien de ce qui est saisi ici n'est perdu en attendant.",

  // ── Classes de lanceur de sorts ──────────────────────────────────────────────────────────
  "spells.caster.unnamed": "Classe de lanceur de sorts {n}",
  "spells.caster.numbered": "{name} ({n})",
  "spells.caster.rename": "Renommer {caster}",
  "spells.caster.placeholder": "Saisissez votre classe",
  "spells.caster.domains": "Domaines / spécialisation",
  "spells.caster.saveDcMod": "Mod. de DD",
  "spells.caster.arcaneFailure": "Échec profane %",
  "spells.aria.class": "Classe de lanceur de sorts {n}",
  "spells.aria.domains": "Domaines / spécialisation de {caster}",
  "spells.aria.saveDcMod": "Mod. de DD de {caster}",
  "spells.aria.arcaneFailure": "Échec profane de {caster} %",
  "spells.aria.known": "Sorts connus de niveau {level} de {caster}",
  "spells.aria.saveDc": "DD des sorts de niveau {level} de {caster}",
  "spells.aria.perDay": "Sorts par jour de niveau {level} de {caster}",
  "spells.aria.bonus": "Sorts en bonus de niveau {level} de {caster}",
  "spells.aria.remove": "Retirer {caster}",
  "spells.head.level": "Niveau",
  "spells.head.known": "Sorts connus",
  "spells.head.saveDc": "DD des sorts",
  "spells.head.perDay": "Sorts par jour",
  "spells.head.bonus": "Sorts en bonus",
  "spells.add": "Ajouter une classe de lanceur de sorts",
  "spells.remove": "Retirer",
  "spells.casters.note":
    "Un bloc par classe de lanceur de sorts. La classe qui lance les sorts est saisie ici plutôt que lue dans les niveaux de classe : les données de référence des classes viendront dans une phase ultérieure.",
  "spells.level.0": "0",
  "spells.level.1": "1er",
  "spells.level.2": "2e",
  "spells.level.3": "3e",
  "spells.level.4": "4e",
  "spells.level.5": "5e",
  "spells.level.6": "6e",
  "spells.level.7": "7e",
  "spells.level.8": "8e",
  "spells.level.9": "9e",

  // ── Le PDF exporté ───────────────────────────────────────────────────────────────────────
  "pdf.documentTitle": "{name} — fiche de personnage",
  "pdf.filename": "{name} — feuille de personnage.pdf",
  "pdf.filenameFallback": "personnage",
  "pdf.footer.page": "Fiche de personnage — page {page} sur {total}",
  "pdf.footer.ogl":
    "Mécaniques de jeu issues du System Reference Document, sous licence Open Game License 1.0a.",
  "pdf.blank": "—",
  "pdf.characterLevel": "niveau de personnage {level}",
  "pdf.classFallback": "Classe",
  "pdf.section.abilities": "Caractéristiques",
  "pdf.section.vitals": "Points de vie et déplacement",
  "pdf.section.armorClass": "Classe d'armure",
  "pdf.section.combat": "Initiative, attaque et lutte",
  "pdf.section.saves": "Jets de sauvegarde",
  "pdf.section.attacks": "Attaques",
  "pdf.section.skills": "Compétences",
  "pdf.section.skillsContinued": "Compétences (suite)",
  "pdf.section.gear": "Équipement",
  "pdf.section.possessions": "Autres possessions",
  "pdf.section.money": "Argent",
  "pdf.section.feats": "Dons",
  "pdf.section.specialAbilities": "Capacités spéciales",
  "pdf.section.languages": "Langues",
  "pdf.section.spells": "Sorts",
  "pdf.section.spellbook": "Grimoire",
  "pdf.abilities.note":
    "‡ signale la valeur dont provient le modificateur. Une valeur temporaire remplace la valeur de base partout où la feuille l'utilise ; la base est donc estompée plutôt que retirée.",
  "pdf.field.classAndLevel": "Classe et niveau",
  "pdf.field.totalHp": "PV totaux",
  "pdf.field.wounds": "Blessures / actuels",
  "pdf.field.nonlethal": "Non létaux",
  "pdf.field.damageReduction": "Réd. dégâts",
  "pdf.field.touchAc": "CA de contact",
  "pdf.field.flatFootedAc": "CA pris au dépourvu",
  "pdf.field.base": "Base",
  "pdf.field.armour": "Armure",
  "pdf.field.shield": "Bouclier",
  "pdf.field.dex": "Dex.",
  "pdf.field.natural": "Naturelle",
  "pdf.field.deflection": "Parade",
  "pdf.field.misc": "Divers",
  "pdf.field.spellResistance": "Rés. à la magie",
  "pdf.field.spellFailure": "Échec sorts",
  "pdf.ac.note":
    "Le bonus de Dextérité indiqué est celui réellement appliqué après le maximum imposé par l'armure, et il vaut aussi bien pour la CA de contact que pour la CA pris au dépourvu.",
  "pdf.part.dexMod": "Mod. Dex.",
  "pdf.part.miscMod": "Mod. divers",
  "pdf.part.baseAttack": "Attaque base",
  "pdf.part.strMod": "Mod. For.",
  "pdf.part.sizeMod": "Mod. taille",
  "pdf.part.baseSave": "Jet de base",
  "pdf.part.abilityMod": "Mod. caract.",
  "pdf.part.magicMod": "Mod. magie",
  "pdf.part.tempMod": "Mod. temp.",
  "pdf.combat.note":
    "Le bonus de base à l'attaque est saisi plutôt que calculé — l'obtenir demande les tables de progression des classes.",
  "pdf.attacks.empty": "Aucune attaque enregistrée.",
  "pdf.skills.head.key": "Clé",
  "pdf.skills.head.abil": "Caract.",
  "pdf.skills.head.acp": "MAT",
  "pdf.skills.note":
    "Une case pleine indique une compétence de classe. † ne peut pas être utilisée sans formation. Les rangs sont des nombres entiers, et le maximum dans une compétence est le niveau du personnage + 3, ou la moitié de ce total arrondie à l'inférieur pour une compétence hors classe. Une compétence sans rang n'affiche pas de total.",
  "pdf.gear.slot.armour": "Armure / objet de protection",
  "pdf.gear.slot.shield": "Bouclier / objet de protection",
  "pdf.gear.note":
    "Les malus aux tests s'écrivent comme dans la table des armures — une armure de plates complète est à −6, pas 6.",
  "pdf.possessions.empty": "Rien de transporté.",
  "pdf.possessions.head.wt": "Poids",
  "pdf.possessions.note":
    "Le poids transporté provient des possessions et de l'armure portée, saisies en livres ; les charges ci-dessus sont converties en kilogrammes. Le poids de la ligne d'identité est celui du personnage lui-même et n'y entre pas.",
  "pdf.feats.empty": "Aucun don enregistré.",
  "pdf.specialAbilities.empty": "Aucune capacité spéciale enregistrée.",
  "pdf.languages.empty": "Aucune enregistrée.",
  "pdf.spells.empty": "Aucun sort enregistré.",
  "pdf.spells.notesHeading": "Notes",
  "pdf.spells.domains": "Domaines / école de spécialisation",
  "pdf.spells.saveDcMod": "Mod. DD",
  "pdf.spells.arcaneFailure": "Échec profane",
  // Abrégés : la colonne fait quelques points de large. La note ci-dessous les écrit en toutes
  // lettres, comme le fait « Poids » pour les possessions.
  "pdf.spells.head.level": "Niv.",
  "pdf.spells.head.known": "Connus",
  "pdf.spells.head.saveDc": "DD",
  "pdf.spells.head.perDay": "Par jour",
  "pdf.spells.head.bonus": "Suppl.",
  "pdf.spells.note":
    "Connus = sorts connus, DD = degré de difficulté des jets de sauvegarde, Suppl. = sorts en bonus. Ces valeurs sont saisies et non calculées : les déduire demande les tables de progression des classes. Les sorts eux-mêmes figurent dans les notes à côté de cette grille, et ceux qui sont consignés dans le grimoire sont imprimés avec la feuille.",
  "pdf.spellbook.group": "Niveau {level}",
  "pdf.spellbook.note":
    "Ce qui est consigné dans le grimoire, et non ce qui en est préparé. Le nombre de sorts connus et lançables par jour à chaque niveau figure dans la grille de la page précédente. Un niveau dont aucun sort n’est consigné n’est pas imprimé.",
  "pdf.page.label": "p. {page}",
};
