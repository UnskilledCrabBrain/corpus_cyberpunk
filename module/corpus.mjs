import { calculateArmorDamage, CorpusActor, CorpusItem } from "./documents.mjs?v=0.6.37";
import { CORPUS } from "./config.mjs?v=0.6.37";
import {
  CharacterDataModel,
  NpcDataModel,
  AbilityDataModel,
  ArmorDataModel,
  ConditionDataModel,
  ConsumableDataModel,
  EquipmentDataModel,
  GeneticDataModel,
  ImplantDataModel,
  ManeuverDataModel,
  TraitDataModel,
  WeaponDataModel
} from "./data-models.mjs?v=0.6.37";
import { CorpusActorSheet, CorpusItemSheet } from "./sheets.mjs?v=0.6.37";

const SYSTEM_ID = "corpus";

Hooks.once("init", () => {
  void ensureCorpusLocalization();

  CONFIG.Corpus = {
    id: SYSTEM_ID,
    ...CORPUS
  };

  CONFIG.Actor.documentClass = CorpusActor;
  CONFIG.Item.documentClass = CorpusItem;

  CONFIG.Actor.dataModels = {
    character: CharacterDataModel,
    npc: NpcDataModel
  };

  CONFIG.Item.dataModels = {
    equipment: EquipmentDataModel,
    consumable: ConsumableDataModel,
    ability: AbilityDataModel,
    trait: TraitDataModel,
    weapon: WeaponDataModel,
    armor: ArmorDataModel,
    implant: ImplantDataModel,
    genetic: GeneticDataModel,
    condition: ConditionDataModel,
    maneuver: ManeuverDataModel
  };

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["resources.wounds", "resources.actionPoints"],
      value: ["attributes.reflexes.value", "currency.credits", "derived.initiative"]
    },
    npc: {
      bar: ["resources.wounds", "resources.actionPoints"],
      value: ["threat", "derived.initiative"]
    }
  };

  const { DocumentSheetConfig } = foundry.applications.apps;

  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, CorpusActorSheet, {
    types: ["character", "npc"],
    makeDefault: true,
    label: "CORPUS.Sheets.Actor"
  });

  DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, CorpusItemSheet, {
    types: [
      "equipment", "consumable", "ability", "trait", "weapon", "armor", "implant",
      "genetic", "condition", "maneuver"
    ],
    makeDefault: true,
    label: "CORPUS.Sheets.Item"
  });
});

Hooks.once("ready", async () => {
  await ensureCorpusLocalization();
  console.log("Corpus | System ready");
});

Hooks.on("renderChatMessageHTML", async (message, html) => {
  const apButton = html.querySelector?.('[data-corpus-action="refund-ap"]');
  const actionPointSpend = message.flags.corpus?.actionPointSpend;
  if (apButton && actionPointSpend?.actorUuid && actionPointSpend?.spendId) {
    await setupActionPointRefundButton(message, apButton, actionPointSpend);
  }

  const damageRollButton = html.querySelector?.('[data-corpus-action="roll-damage"]');
  const pendingDamage = message.flags.corpus?.pendingDamage;
  if (damageRollButton && pendingDamage?.targetUuid) {
    await setupDamageRollButton(message, damageRollButton, pendingDamage);
  }

  const button = html.querySelector?.('[data-corpus-action="apply-damage"]');
  const damage = message.flags.corpus?.damage;
  if (!button || !damage?.targetUuid) return;

  const target = await fromUuid(damage.targetUuid);
  if (!(target instanceof Actor)) {
    button.disabled = true;
    return;
  }

  const applied = target.getFlag("corpus", `appliedDamage.${message.id}`);
  const allowed = game.user.isGM || target.isOwner;
  if (applied) {
    markDamageButtonApplied(button);
    return;
  }
  if (!allowed) {
    button.disabled = true;
    button.dataset.tooltip = game.i18n.localize("CORPUS.Combat.NoPermission");
    return;
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const didApply = await target.applyDamage(damage.amount, { sourceId: message.id });
      if (didApply) markDamageButtonApplied(button);
      else markDamageButtonApplied(button);
    } catch (error) {
      button.disabled = false;
      ui.notifications.error(game.i18n.localize("CORPUS.Combat.ApplyFailed"));
      console.error("Corpus | Failed to apply damage", error);
    }
  });
});

async function setupDamageRollButton(message, button, pendingDamage) {
  if (message.flags.corpus?.damageRolled) {
    markDamageRolled(button);
    return;
  }

  const target = await fromUuid(pendingDamage.targetUuid);
  if (!(target instanceof Actor)) {
    button.disabled = true;
    return;
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const actor = pendingDamage.actorUuid ? await fromUuid(pendingDamage.actorUuid) : null;
      const damageRoll = await new Roll(pendingDamage.formula, actor?.getRollData?.() ?? {}).evaluate();
      const armor = target.equippedArmor ?? null;
      const rawDamage = Math.max(0, Math.floor(Number(damageRoll.total) || 0));
      const bp = Math.max(0, Number(pendingDamage.bp) || 0);
      const structure = Math.max(0, Number(armor?.system.structure) || 0);
      const mitigation = Math.max(0, Number(armor?.system.mitigation) || 0);
      const finalDamage = calculateArmorDamage({
        damage: rawDamage,
        bp,
        structure,
        mitigation
      });
      const content = await renderTemplate("systems/corpus/templates/damage-card.hbs", {
        attacker: actor?.name ?? message.speaker.alias ?? "",
        weapon: pendingDamage.weapon,
        target: target.name,
        rawDamage,
        bp,
        armor: armor?.name ?? game.i18n.localize("CORPUS.Combat.NoArmor"),
        structure,
        mitigation,
        finalDamage,
        canApply: true,
        labels: localizeDamageCard()
      });

      await ChatMessage.create({
        speaker: actor instanceof Actor ? ChatMessage.getSpeaker({ actor }) : message.speaker,
        content,
        rolls: [damageRoll],
        flags: {
          corpus: {
            damage: {
              targetUuid: target.uuid,
              amount: finalDamage
            }
          }
        }
      });
      await message.update({ "flags.corpus.damageRolled": true });
      markDamageRolled(button);
    } catch (error) {
      button.disabled = false;
      ui.notifications.error(game.i18n.localize("CORPUS.Combat.DamageFailed"));
      console.error("Corpus | Failed to roll damage", error);
    }
  });
}

async function setupActionPointRefundButton(message, button, actionPointSpend) {
  const actor = await fromUuid(actionPointSpend.actorUuid);
  if (!(actor instanceof Actor)) {
    button.disabled = true;
    return;
  }

  const record = actor.getFlag("corpus", `actionPointSpends.${actionPointSpend.spendId}`);
  const allowed = game.user.isGM || actor.isOwner;
  if (!record || record.refunded) {
    markActionPointRefunded(button);
    return;
  }
  if (!allowed) {
    button.disabled = true;
    button.dataset.tooltip = game.i18n.localize("CORPUS.ActionPoints.NoPermission");
    return;
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const didRefund = await actor.refundActionPoints(actionPointSpend.spendId);
      if (didRefund) markActionPointRefunded(button);
      else markActionPointRefunded(button);
    } catch (error) {
      button.disabled = false;
      ui.notifications.error(game.i18n.localize("CORPUS.ActionPoints.RefundFailed"));
      console.error("Corpus | Failed to refund action points", error);
    }
  });
}

function markActionPointRefunded(button) {
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("CORPUS.ActionPoints.Refunded")}`;
}

function markDamageButtonApplied(button) {
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("CORPUS.Combat.DamageApplied")}`;
}

function markDamageRolled(button) {
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("CORPUS.Combat.DamageRolled")}`;
}

function localizeDamageCard() {
  const keys = [
    "Damage", "Target", "RawDamage", "Armor", "Structure", "Mitigation", "FinalDamage", "ApplyDamage"
  ];
  return Object.fromEntries(keys.map((key) => [key, game.i18n.localize(`CORPUS.Combat.${key}`)]));
}

async function ensureCorpusLocalization() {
  const probes = [
    "CORPUS.Common.Name",
    "CORPUS.Actor.Credits",
    "CORPUS.Actor.Tabs.Hacking",
    "TYPES.Actor.character"
  ];
  if (probes.every((key) => game.i18n.localize(key) !== key)) return;

  const lang = game.i18n.lang ?? "en";
  const candidates = [
    `systems/corpus/lang/${lang}.json`,
    lang.startsWith("ru") ? "systems/corpus/lang/ru.json" : "systems/corpus/lang/en.json",
    "systems/corpus/lang/en.json"
  ];

  for (const path of [...new Set(candidates)]) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;

      const translations = await response.json();
      mergeCorpusTranslations(translations);
      console.warn(`Corpus | Loaded fallback localization from ${path}`);
      return;
    } catch (error) {
      console.warn(`Corpus | Failed to load fallback localization from ${path}`, error);
    }
  }
}

function mergeCorpusTranslations(translations) {
  const currentTranslations = game.i18n.translations;
  Object.assign(currentTranslations, translations);

  const langTranslations = currentTranslations?.[game.i18n.lang];
  if (langTranslations && typeof langTranslations === "object" && !Array.isArray(langTranslations)) {
    Object.assign(langTranslations, translations);
  }
}
