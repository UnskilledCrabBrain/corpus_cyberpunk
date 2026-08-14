import {
  effectiveHackingDifficulty,
  getHackingAccess,
  getHackingAction
} from "./features/hacking-rules.mjs?v=0.6.37";
import { fallbackText, t } from "./i18n.mjs?v=0.6.37";

export class CorpusActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  getRollData() {
    const data = super.getRollData();
    data.derived = this.system.derived;
    return data;
  }

  get equippedArmor() {
    return this.items.find((item) => item.type === "armor" && item.system.equipped) ?? null;
  }

  get actionPointSpends() {
    return Object.values(this.getFlag("corpus", "actionPointSpends") ?? {})
      .sort((a, b) => (b.createdTime ?? 0) - (a.createdTime ?? 0));
  }

  get latestRefundableActionPointSpend() {
    return this.actionPointSpends.find((spend) => spend.spent > 0 && !spend.refunded) ?? null;
  }

  async spendActionPoints(cost, { reason = "", sourceId = null, allowInsufficient = true } = {}) {
    const actionPoints = this.system.resources?.actionPoints;
    if (!actionPoints) return null;

    const requested = Math.max(0, Math.floor(Number(cost) || 0));
    const current = Math.max(actionPoints.min ?? 0, Math.floor(Number(actionPoints.value) || 0));
    if (!allowInsufficient && requested > current) return null;

    const spendId = sourceId || foundry.utils.randomID(16);
    const spent = Math.min(current, requested);
    const overrun = Math.max(0, requested - current);
    const record = {
      id: spendId,
      sourceId,
      reason: String(reason ?? "").trim(),
      cost: requested,
      spent,
      overrun,
      before: current,
      after: Math.max(actionPoints.min ?? 0, current - spent),
      refunded: false,
      createdTime: Date.now(),
      userId: game.user.id
    };

    await this.update({
      "system.resources.actionPoints.value": record.after,
      [`flags.corpus.actionPointSpends.${spendId}`]: record
    });
    return record;
  }

  async refundActionPoints(spendId) {
    const record = this.getFlag("corpus", `actionPointSpends.${spendId}`);
    const actionPoints = this.system.resources?.actionPoints;
    if (!record || !actionPoints || record.refunded || !record.spent) return false;

    const current = Math.max(actionPoints.min ?? 0, Math.floor(Number(actionPoints.value) || 0));
    const maximum = Math.max(current, Math.floor(Number(actionPoints.max) || 0));
    await this.update({
      "system.resources.actionPoints.value": Math.min(maximum, current + record.spent),
      [`flags.corpus.actionPointSpends.${spendId}.refunded`]: true,
      [`flags.corpus.actionPointSpends.${spendId}.refundedTime`]: Date.now(),
      [`flags.corpus.actionPointSpends.${spendId}.refundedBy`]: game.user.id
    });
    return true;
  }

  async resetActionPoints() {
    const actionPoints = this.system.resources?.actionPoints;
    if (!actionPoints) return;

    await this.update({
      "system.resources.actionPoints.value": actionPoints.max
    });
  }

  async applyDamage(amount, { sourceId = null } = {}) {
    amount = Math.max(0, Math.round(Number(amount) || 0));
    const wounds = this.system.resources?.wounds;
    if (!wounds) return false;
    if (sourceId && this.getFlag("corpus", `appliedDamage.${sourceId}`)) return false;

    const update = {
      "system.resources.wounds.value": Math.max(wounds.min, wounds.value - amount)
    };
    if (sourceId) update[`flags.corpus.appliedDamage.${sourceId}`] = true;

    await this.update(update);
    return true;
  }

  async heal(amount) {
    amount = Math.max(0, Math.round(Number(amount) || 0));
    const wounds = this.system.resources?.wounds;
    if (!wounds) return;

    await this.update({
      "system.resources.wounds.value": Math.min(wounds.max, wounds.value + amount)
    });
  }

  async rollSkill(skillId, { modifier = 0 } = {}) {
    const skillConfig = CONFIG.Corpus.skills[skillId];
    if (!skillConfig) return null;

    const skillValue = this.system.skills[skillId]?.value ?? 0;
    const attributeValue = this.system.attributes[skillConfig.attribute]?.value ?? 0;
    const attributeHalf = Math.floor(attributeValue / 2);
    const formula = buildFormula(["1d10", skillValue, attributeHalf, modifier]);
    const roll = await new Roll(formula, this.getRollData()).evaluate();
    const flavor = game.i18n.format("CORPUS.Roll.ActiveSkill", {
      skill: game.i18n.localize(skillConfig.label),
      attribute: game.i18n.localize(CONFIG.Corpus.attributes[skillConfig.attribute].label)
    });

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor
    });

    return roll;
  }

  async rollHacking({
    actionId = null,
    modifier = null,
    targetDefense = null,
    access = null,
    actionPointSpend = null
  } = {}) {
    const skillConfig = CONFIG.Corpus.skills.cyberhacking;
    if (!skillConfig) return null;

    const hacking = this.system.hacking ?? {};
    const action = getHackingAction(actionId ?? hacking.action);
    const accessId = access ?? hacking.access ?? "none";
    const baseDifficulty = Math.max(0, Math.floor(Number(targetDefense ?? hacking.targetDefense) || 0));
    const difficulty = effectiveHackingDifficulty(baseDifficulty, accessId);
    const rollModifier = Math.floor(Number(modifier ?? hacking.modifier) || 0);
    const skillValue = this.system.skills.cyberhacking?.value ?? 0;
    const reasonHalf = Math.floor((this.system.attributes.reason?.value ?? 0) / 2);
    const formula = buildFormula(["1d10", skillValue, reasonHalf, rollModifier]);
    const roll = await new Roll(formula, this.getRollData()).evaluate();
    const success = roll.total >= difficulty;
    const accessConfig = getHackingAccess(accessId);

    const content = await renderTemplate("systems/corpus/templates/features/hacking-roll-card.hbs", {
      actor: this.name,
      action: t(action.label.key, action.label.fallback),
      apCost: action.apCost,
      formula,
      total: roll.total,
      baseDifficulty,
      difficulty,
      access: t(accessConfig.label.key, accessConfig.label.fallback),
      modifier: rollModifier,
      risk: fallbackText(action.risk),
      success,
      actionPointSpend: formatActionPointSpend(actionPointSpend),
      labels: localizeHackingRollCard()
    });

    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      rolls: [roll],
      flags: {
        corpus: {
          hacking: {
            actionId: action.id,
            baseDifficulty,
            difficulty,
            access: accessId,
            modifier: rollModifier,
            success
          },
          actionPointSpend: chatActionPointSpendFlag(actionPointSpend)
        }
      }
    });

    return { roll, success, difficulty, message };
  }

  async rollAttribute(attributeId, { modifier = 0, skillId = null } = {}) {
    const attributeConfig = CONFIG.Corpus.attributes[attributeId];
    if (!attributeConfig) return null;

    const attributeValue = this.system.attributes[attributeId]?.value ?? 0;
    const skillValue = skillId ? Math.floor((this.system.skills[skillId]?.value ?? 0) / 2) : 0;
    const formula = buildFormula(["1d10", attributeValue, skillValue, modifier]);
    const flavor = game.i18n.format("CORPUS.Roll.PassiveAttribute", {
      attribute: game.i18n.localize(attributeConfig.label)
    });

    const roll = await new Roll(formula, this.getRollData()).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor
    });

    return roll;
  }

  async toggleEquippedItem(itemId) {
    const item = this.items.get(itemId);
    if (!item || !("equipped" in item.system)) return;

    const equipped = !item.system.equipped;
    const updates = [];
    if (item.type === "armor" && equipped) {
      for (const armor of this.items.filter((candidate) => candidate.type === "armor" && candidate.system.equipped)) {
        if (armor.id !== item.id) updates.push({ _id: armor.id, "system.equipped": false });
      }
    }
    updates.push({ _id: item.id, "system.equipped": equipped });
    await this.updateEmbeddedDocuments("Item", updates);
  }

  async toggleActiveItem(itemId) {
    const item = this.items.get(itemId);
    if (!item || !("active" in item.system)) return;
    await item.update({ "system.active": !item.system.active });
  }

  async rollWeaponAttack(
    weaponId,
    { modifier = 0, target = null, actionPointSpend = null, bpModifier = 0, attackOptions = [] } = {}
  ) {
    const weapon = this.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") return null;
    if (!weapon.system.equipped) {
      ui.notifications.warn(game.i18n.localize("CORPUS.Combat.WeaponNotEquipped"));
      return null;
    }
    if (!Roll.validate(weapon.damageFormula)) {
      ui.notifications.error(game.i18n.localize("CORPUS.Combat.InvalidDamageFormula"));
      return null;
    }

    const targetActor = target?.actor ?? target ?? null;
    const attackParts = this.#getWeaponAttackParts(weapon, modifier);
    const attackRoll = await new Roll(buildFormula(["1d10", ...attackParts]), this.getRollData()).evaluate();
    const defense = targetActor?.type === "npc" ? targetActor.system.combat?.defense ?? 0 : null;
    const hit = defense === null ? null : attackRoll.total >= defense;
    const bp = Math.max(0, Number(weapon.system.bp) || 0) + Math.max(0, Number(bpModifier) || 0);

    const content = await renderTemplate("systems/corpus/templates/attack-card.hbs", {
      attacker: this.name,
      weapon: weapon.name,
      target: targetActor?.name ?? game.i18n.localize("CORPUS.Combat.NoTarget"),
      attackTotal: attackRoll.total,
      defense,
      hit,
      unresolved: hit === null,
      missed: hit === false,
      bp,
      attackOptions,
      canRollDamage: Boolean(targetActor && hit !== false),
      actionPointSpend: formatActionPointSpend(actionPointSpend),
      labels: localizeAttackCard()
    });

    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      rolls: [attackRoll],
      flags: {
        corpus: {
          pendingDamage: {
            actorUuid: this.uuid,
            targetUuid: targetActor?.uuid ?? null,
            weaponUuid: weapon.uuid,
            weapon: weapon.name,
            formula: weapon.damageFormula,
            bp
          },
          actionPointSpend: chatActionPointSpendFlag(actionPointSpend)
        }
      }
    });

    return { attackRoll, hit, message };
  }

  #getWeaponAttackParts(weapon, modifier) {
    if (this.type === "npc") return [this.system.combat?.attackBonus ?? 0, modifier];

    const melee = weapon.system.attackMode === "melee";
    const skillId = melee ? "melee" : "shooting";
    const attributeId = melee ? "physique" : "reflexes";
    return [
      this.system.skills[skillId]?.value ?? 0,
      Math.floor((this.system.attributes[attributeId]?.value ?? 0) / 2),
      modifier
    ];
  }
}

export class CorpusItem extends Item {
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    const equippedValue = foundry.utils.getProperty(changed, "system.equipped")
      ?? changed["system.equipped"];
    const equippingArmor = this.type === "armor" && equippedValue === true;
    if (!equippingArmor || !this.actor) return;

    const updates = this.actor.items
      .filter((item) => item.type === "armor" && item.id !== this.id && item.system.equipped)
      .map((item) => ({ _id: item.id, "system.equipped": false }));
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
  }

  get hasRoll() {
    return Boolean(this.system.roll?.trim());
  }

  get damageFormula() {
    const formula = String(this.system.damageFormula ?? "").trim();
    return formula || String(this.system.damage ?? 0);
  }

  async roll() {
    if (!this.hasRoll) return null;

    const roll = await new Roll(this.system.roll, this.actor?.getRollData() ?? {}).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: this.name
    });
    return roll;
  }
}

function buildFormula(parts) {
  return parts
    .map((part) => Number(part) === part ? signedNumber(part) : part)
    .filter((part) => part !== "+ 0")
    .join(" ");
}

function signedNumber(value) {
  if (!value) return "+ 0";
  return value > 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
}

function localizeAttackCard() {
  const keys = [
    "Attack", "Attacker", "Target", "Hit", "Miss", "Unresolved", "AttackOptions", "RollDamage"
  ];
  return {
    ...Object.fromEntries(keys.map((key) => [key, game.i18n.localize(`CORPUS.Combat.${key}`)])),
    ...localizeActionPointLabels()
  };
}

function localizeHackingRollCard() {
  return {
    Action: t("CORPUS.Hacking.Action", { en: "Action", ru: "Действие" }),
    AP: t("CORPUS.Hacking.APCost", { en: "AP", ru: "ОД" }),
    Formula: t("CORPUS.Hacking.Formula", { en: "Formula", ru: "Формула" }),
    Total: t("CORPUS.Hacking.Total", { en: "Total", ru: "Итог" }),
    BaseDifficulty: t("CORPUS.Hacking.BaseDifficulty", { en: "Base difficulty", ru: "Базовая Сл" }),
    EffectiveDifficulty: t("CORPUS.Hacking.EffectiveDifficulty", { en: "Effective difficulty", ru: "Итоговая Сл" }),
    Access: t("CORPUS.Hacking.Access", { en: "Access", ru: "Доступ" }),
    Modifier: t("CORPUS.Hacking.Modifier", { en: "Modifier", ru: "Модификатор" }),
    Risk: t("CORPUS.Hacking.Risk", { en: "Risk", ru: "Риск" }),
    Success: t("CORPUS.Hacking.Success", { en: "Success", ru: "Успех" }),
    Failure: t("CORPUS.Hacking.Failure", { en: "Failure", ru: "Провал" }),
    ...localizeActionPointLabels()
  };
}

function localizeActionPointLabels() {
  return {
    ActionPoints: t("CORPUS.ActionPoints.Label", { en: "AP", ru: "ОД" }),
    APSpent: t("CORPUS.ActionPoints.Spent", { en: "Spent", ru: "Списано" }),
    APNotSpent: t("CORPUS.ActionPoints.NotSpent", { en: "Not spent", ru: "Не списано" }),
    APReason: t("CORPUS.ActionPoints.Reason", { en: "Reason", ru: "Причина" }),
    APOverrun: t("CORPUS.ActionPoints.Overrun", { en: "Short", ru: "Не хватило" }),
    RefundAP: t("CORPUS.ActionPoints.Refund", { en: "Refund AP", ru: "Вернуть ОД" })
  };
}

function formatActionPointSpend(spend) {
  if (!spend) return null;

  const didSpend = Boolean(spend.id && spend.spent > 0);
  return {
    id: spend.id,
    actorUuid: spend.actorUuid,
    cost: spend.cost ?? 0,
    spent: spend.spent ?? 0,
    overrun: spend.overrun ?? 0,
    reason: spend.reason ?? "",
    didSpend,
    canRefund: didSpend && !spend.refunded
  };
}

function chatActionPointSpendFlag(spend) {
  if (!spend?.id || !spend?.actorUuid) return null;

  return {
    actorUuid: spend.actorUuid,
    spendId: spend.id
  };
}

export function calculateArmorDamage({ damage, bp = 0, structure = 0, mitigation = 0 }) {
  const incoming = Math.max(0, Number(damage) || 0);
  const penetration = Math.max(0, Number(bp) || 0);
  const armorStructure = Math.max(0, Number(structure) || 0);
  const armorMitigation = Math.max(0, Number(mitigation) || 0);
  const protection = Math.max(armorStructure - penetration, 0) + armorMitigation;
  return Math.max(0, incoming - protection);
}
