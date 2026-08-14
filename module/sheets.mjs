import { CORPUS } from "./config.mjs?v=0.6.37";
import { prepareActorFeatureTabs } from "./features/index.mjs?v=0.6.37";
import { getHackingAction } from "./features/hacking-rules.mjs?v=0.6.37";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;

const ACTOR_ITEM_SECTIONS = [
  {
    id: "inventory",
    label: "CORPUS.Actor.Tabs.Inventory",
    icon: "fa-solid fa-briefcase",
    types: ["weapon", "armor", "equipment", "consumable"]
  },
  {
    id: "modifications",
    label: "CORPUS.Actor.Tabs.Modifications",
    icon: "fa-solid fa-microchip",
    types: ["implant", "genetic", "ability", "trait"]
  },
  {
    id: "conditions",
    label: "CORPUS.Actor.Tabs.Conditions",
    icon: "fa-solid fa-heart-pulse",
    types: ["condition"]
  },
  {
    id: "maneuvers",
    label: "CORPUS.Actor.Tabs.Maneuvers",
    icon: "fa-solid fa-person-running",
    types: ["maneuver"]
  }
];

const MODIFICATION_LOCATIONS = ["head", "arms", "legs", "torso", "other"];
const CORPUS_INFO_POPOVER_PORTALS = new WeakMap();

globalThis.document?.addEventListener("click", onAllocationStepClick);

function CorpusDocumentSheetMixin(Base) {
  return class extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["corpus", "sheet"],
    window: {
      resizable: true
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const document = this.document;

    return {
      ...context,
      document,
      system: document.system,
      source: document.toObject(),
      type: document.type
    };
  }
  };
}

export class CorpusActorSheet extends CorpusDocumentSheetMixin(
  HandlebarsApplicationMixin(ActorSheetV2)
) {
  static DEFAULT_OPTIONS = {
    classes: ["corpus", "sheet", "actor"],
    position: {
      width: 1080,
      height: 760
    },
    actions: {
      setTab: onSetTab,
      rollAttribute: onRollAttribute,
      rollSkill: onRollSkill,
      rollHacking: onRollHacking,
      openItem: onOpenItem,
      createItem: onCreateItem,
      deleteItem: onDeleteItem,
      toggleEquipped: onToggleEquipped,
      toggleActive: onToggleActive,
      attackWeapon: onAttackWeapon,
      completeCreation: onCompleteCreation,
      reopenCreation: onReopenCreation,
      resetCreation: onResetCreation,
      allocateCreation: onAllocateCreation,
      advanceCharacter: onAdvanceCharacter,
      spendActionPoints: onSpendActionPoints,
      resetActionPoints: onResetActionPoints,
      refundActionPoints: onRefundActionPoints
    }
  };

  static PARTS = {
    form: {
      template: "systems/corpus/templates/actor-sheet-0.6.37.hbs"
    }
  };

  _activeTab = "main";
  _inventoryFilter = "";

  async _onRender(context, options) {
    await super._onRender(context, options);
    updateRollInfoPanels(this.element);
    setupCorpusInfoPopovers(this.element);
    this.element.addEventListener("input", (event) => {
      if (event.target.matches('[name^="system.attributes."], [name^="system.skills."], [name^="system.resources.wounds."], [name^="system.resources.actionPoints."]')) {
        updateRollInfoPanels(this.element);
      }
    });

    const search = this.element.querySelector("[data-inventory-search]");
    if (!search) return;

    search.value = this._inventoryFilter;
    filterInventory(this.element, this._inventoryFilter);
    search.addEventListener("input", (event) => {
      this._inventoryFilter = event.currentTarget.value;
      filterInventory(this.element, this._inventoryFilter);
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const attributes = Object.entries(CORPUS.attributes).map(([id, config]) => ({
      id,
      label: localizeLabel(config.label),
      value: actor.system.attributes[id]?.value ?? 0
    }));
    const skills = Object.entries(CORPUS.skills).map(([id, config]) => {
      const attributeLabel = localizeLabel(CORPUS.attributes[config.attribute].label);
      const skillValue = actor.system.skills[id]?.value ?? 0;

      return {
        id,
        label: localizeLabel(config.label),
        value: skillValue,
        attribute: config.attribute,
        attributeLabel
      };
    });
    const attributeGroups = attributes.map((attribute) => ({
      ...attribute,
      skills: skills.filter((skill) => skill.attribute === attribute.id)
    }));
    const wounds = actor.system.resources.wounds;
    const actionPoints = actor.system.resources.actionPoints;
    const attributeLabel = (id) => attributes.find((attribute) => attribute.id === id)?.label ?? id;

    const hud = {
      wounds: hudStat("CORPUS.Actor.Wounds", [attributeLabel("resilience")]),
      actionPoints: hudStat("CORPUS.Actor.ActionPoints"),
      initiative: hudStat("CORPUS.Actor.Derived.Initiative", [attributeLabel("reflexes")]),
      carryWeight: hudStat("CORPUS.Actor.Derived.CarryWeight", [attributeLabel("physique")]),
      implantSlots: hudStat("CORPUS.Actor.Derived.ImplantSlots", [attributeLabel("synchronization")]),
      geneticLimit: hudStat("CORPUS.Actor.Derived.GeneticLimit", [
        attributeLabel("resilience"),
        attributeLabel("humanity")
      ])
    };
    const featureTabs = await prepareActorFeatureTabs(actor, this._activeTab);

    return {
      ...context,
      actor,
      isCharacter: actor.type === "character",
      isNpc: actor.type === "npc",
      typeLabel: game.i18n.localize(`CORPUS.Actor.Types.${actor.type}`),
      attributeGroups,
      creation: actor.type === "character" ? prepareCreationContext(actor) : null,
      featureTabs,
      woundsPercent: percent(wounds.value, wounds.max),
      actionPointsPercent: percent(actionPoints.value, actionPoints.max),
      canRefundActionPoints: Boolean(actor.latestRefundableActionPointSpend),
      hud,
      tabs: {
        main: this._activeTab === "main",
        biography: this._activeTab === "biography"
      },
      itemSections: buildItemSections(actor, this._activeTab, hud),
      infoLabels: rollInfoLabels()
    };
  }
}

function onSetTab(event, target) {
  event.preventDefault();
  const tab = target.dataset.tab;
  if (!tab) return;

  this._activeTab = tab;
  const sheet = target.closest(".corpus-sheet");
  sheet?.querySelectorAll("[data-tab]").forEach((element) => {
    element.classList.toggle("is-active", element.dataset.tab === tab);
  });
  sheet?.querySelectorAll("[data-tab-panel]").forEach((element) => {
    element.classList.toggle("is-active", element.dataset.tabPanel === tab);
  });
}

async function onRollAttribute(event, target) {
  event.preventDefault();
  await syncActorRollInputs(this.actor, this.element);
  await this.actor.rollAttribute(target.dataset.attributeId);
}

async function onRollSkill(event, target) {
  event.preventDefault();
  await syncActorRollInputs(this.actor, this.element);
  await this.actor.rollSkill(target.dataset.skillId);
}

async function onRollHacking(event, target) {
  event.preventDefault();
  await syncActorRollInputs(this.actor, this.element);
  const panel = target.closest('[data-tab-panel="hacking"]');
  const valueOf = (name) => panel?.querySelector(`[name="${name}"]`)?.value;
  const action = getHackingAction(valueOf("system.hacking.action"));
  const localizedAction = game.i18n.localize(action.label.key);
  const actionLabel = localizedAction === action.label.key
    ? action.label.fallback?.[game.i18n.lang] ?? action.label.fallback?.en ?? action.id
    : localizedAction;
  const actionPointSpend = await spendActionPointsForAction(this.actor, {
    cost: action.apCost,
    reason: actionLabel
  });

  await this.actor.rollHacking({
    actionId: action.id,
    modifier: Number(valueOf("system.hacking.modifier")) || 0,
    targetDefense: Number(valueOf("system.hacking.targetDefense")) || 0,
    access: valueOf("system.hacking.access"),
    actionPointSpend
  });
}

async function onSpendActionPoints(event) {
  event.preventDefault();
  await requestActionPointSpend(this.actor, {
    cost: 1,
    reason: game.i18n.localize("CORPUS.ActionPoints.ManualReason"),
    manual: true
  });
}

async function onResetActionPoints(event) {
  event.preventDefault();
  await this.actor.resetActionPoints();
}

async function onRefundActionPoints(event) {
  event.preventDefault();
  const spend = this.actor.latestRefundableActionPointSpend;
  if (!spend) {
    ui.notifications.info(game.i18n.localize("CORPUS.ActionPoints.NothingToRefund"));
    return;
  }
  await this.actor.refundActionPoints(spend.id);
}

async function requestActionPointSpend(actor, { cost = 1, reason = "", manual = false } = {}) {
  const actionPoints = actor.system.resources?.actionPoints;
  if (!actionPoints) return null;

  const current = Math.floor(Number(actionPoints.value) || 0);
  const maximum = Math.floor(Number(actionPoints.max) || 0);
  const safeCost = Math.max(0, Math.floor(Number(cost) || 0));
  const safeReason = foundry.utils.escapeHTML(reason || game.i18n.localize("CORPUS.ActionPoints.ManualReason"));
  const warning = safeCost > current
    ? `<p class="ap-warning">${game.i18n.format("CORPUS.ActionPoints.Insufficient", {
      current,
      cost: safeCost
    })}</p>`
    : "";

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("CORPUS.ActionPoints.DialogTitle") },
    content: `
      <div class="corpus-ap-dialog">
        <p class="ap-current">${game.i18n.format("CORPUS.ActionPoints.Current", {
          current,
          max: maximum
        })}</p>
        ${warning}
        <label>
          <span>${game.i18n.localize("CORPUS.ActionPoints.Cost")}</span>
          <input type="number" name="cost" value="${safeCost}" min="0" step="1">
        </label>
        <label>
          <span>${game.i18n.localize("CORPUS.ActionPoints.Reason")}</span>
          <input type="text" name="reason" value="${safeReason}">
        </label>
      </div>
    `,
    buttons: [
      {
        action: "spend",
        label: game.i18n.localize("CORPUS.ActionPoints.SpendAndContinue"),
        icon: "fa-solid fa-bolt",
        default: true,
        callback: (dialogEvent, button) => ({
          mode: "spend",
          cost: Number(button.form.elements.cost.value) || 0,
          reason: button.form.elements.reason.value
        })
      },
      {
        action: "free",
        label: game.i18n.localize("CORPUS.ActionPoints.ContinueWithoutSpending"),
        icon: "fa-solid fa-forward",
        callback: (dialogEvent, button) => ({
          mode: "free",
          cost: Number(button.form.elements.cost.value) || 0,
          reason: button.form.elements.reason.value
        })
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  }, { rejectClose: false });

  if (!result) return null;
  const finalCost = Math.max(0, Math.floor(Number(result.cost) || 0));
  const finalReason = String(result.reason ?? "").trim();

  if (result.mode === "free") {
    return {
      cost: finalCost,
      spent: 0,
      overrun: 0,
      reason: finalReason
    };
  }

  if (finalCost > current) ui.notifications.warn(game.i18n.localize("CORPUS.ActionPoints.InsufficientWarning"));
  const spend = await actor.spendActionPoints(finalCost, {
    reason: finalReason,
    allowInsufficient: true
  });
  if (manual || !spend) return spend;

  return {
    ...spend,
    actorUuid: actor.uuid
  };
}

async function spendActionPointsForAction(actor, { cost = 1, reason = "" } = {}) {
  const actionPoints = actor.system.resources?.actionPoints;
  if (!actionPoints) return null;

  const current = Math.floor(Number(actionPoints.value) || 0);
  const finalCost = Math.max(0, Math.floor(Number(cost) || 0));
  if (finalCost > current) {
    ui.notifications.warn(game.i18n.localize("CORPUS.ActionPoints.InsufficientWarning"));
  }

  const spend = await actor.spendActionPoints(finalCost, {
    reason,
    allowInsufficient: true
  });
  if (!spend) return null;

  return {
    ...spend,
    actorUuid: actor.uuid
  };
}

function onOpenItem(event, target) {
  event.preventDefault();
  const itemId = target.closest("[data-item-id]")?.dataset.itemId;
  this.actor.items.get(itemId)?.sheet.render(true);
}

async function onCreateItem(event, target) {
  event.preventDefault();
  let type = target.dataset.itemType;
  const availableTypes = target.dataset.itemTypes?.split(",").filter(Boolean) ?? [];
  if (!type && availableTypes.length) {
    type = await chooseItemType(availableTypes);
  }
  if (!CONFIG.Item.dataModels[type]) return;

  const location = target.dataset.itemLocation;
  const [item] = await this.actor.createEmbeddedDocuments("Item", [{
    name: game.i18n.format("CORPUS.Item.New", {
      type: game.i18n.localize(`CORPUS.Item.Types.${type}`)
    }),
    type,
    system: location ? { location } : {}
  }]);
  item?.sheet.render(true);
}

async function chooseItemType(types) {
  const options = types.map((type) => (
    `<option value="${type}">${game.i18n.localize(`CORPUS.Item.Types.${type}`)}</option>`
  )).join("");

  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("CORPUS.Item.ChooseType") },
    content: `<div class="form-group"><label>${game.i18n.localize("CORPUS.Item.Type")}</label><div class="form-fields"><select name="type">${options}</select></div></div>`,
    buttons: [
      {
        action: "create",
        label: game.i18n.localize("CORPUS.Item.Create"),
        icon: "fa-solid fa-plus",
        default: true,
        callback: (dialogEvent, button) => button.form.elements.type.value
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  }, { rejectClose: false });
}

function onAllocationStepClick(event) {
  const control = event.target.closest("[data-allocation-step]");
  if (!control) return;

  const input = control.closest(".allocation-stepper")?.querySelector("input[type='number']");
  if (!input) return;

  event.preventDefault();
  const step = Number(control.dataset.allocationStep) || 0;
  const min = Number(input.min) || 0;
  const value = Math.max(min, Math.floor((Number(input.value) || min) + step));
  input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function onDeleteItem(event, target) {
  event.preventDefault();
  const itemId = target.closest("[data-item-id]")?.dataset.itemId;
  const item = this.actor.items.get(itemId);
  if (!item) return;

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("CORPUS.Item.Delete") },
    content: `<p>${game.i18n.format("CORPUS.Item.DeleteConfirm", {
      name: foundry.utils.escapeHTML(item.name)
    })}</p>`
  }, { rejectClose: false });
  if (confirmed) await item.delete();
}

async function onToggleEquipped(event, target) {
  event.preventDefault();
  const itemId = target.closest("[data-item-id]")?.dataset.itemId;
  await this.actor.toggleEquippedItem(itemId);
}

async function onToggleActive(event, target) {
  event.preventDefault();
  const itemId = target.closest("[data-item-id]")?.dataset.itemId;
  await this.actor.toggleActiveItem(itemId);
}

async function onAttackWeapon(event, target) {
  event.preventDefault();
  await syncActorRollInputs(this.actor, this.element);
  const itemId = target.closest("[data-item-id]")?.dataset.itemId;
  const weapon = this.actor.items.get(itemId);
  if (!weapon) return;
  if (!weapon.system.equipped) {
    return ui.notifications.warn(game.i18n.localize("CORPUS.Combat.WeaponNotEquipped"));
  }
  if (!Roll.validate(weapon.damageFormula)) {
    return ui.notifications.error(game.i18n.localize("CORPUS.Combat.InvalidDamageFormula"));
  }
  const targets = [...game.user.targets];
  if (targets.length > 1) {
    return ui.notifications.warn(game.i18n.localize("CORPUS.Combat.OneTargetOnly"));
  }

  const attackSetup = await openAttackSetupDialog(this.actor, weapon);
  if (!attackSetup) return;

  const actionPointSpend = await spendActionPointsForAction(this.actor, {
    cost: attackSetup.actionPointCost,
    reason: attackSetup.reason
  });

  try {
    await this.actor.rollWeaponAttack(itemId, {
      modifier: attackSetup.modifier,
      target: targets[0] ?? null,
      actionPointSpend,
      bpModifier: attackSetup.bpModifier,
      attackOptions: attackSetup.options
    });
  } catch (error) {
    ui.notifications.error(game.i18n.localize("CORPUS.Combat.AttackFailed"));
    console.error("Corpus | Failed to roll weapon attack", error);
  }
}

async function openAttackSetupDialog(actor, weapon) {
  const baseCost = Math.max(0, Math.floor(Number(weapon.system.actionCost ?? 1) || 0));
  const attackFormula = weaponAttackFormula(weapon, actor);
  const aimLabel = game.i18n.localize("CORPUS.Combat.Aim");
  const aimAccuracyLabel = game.i18n.localize("CORPUS.Combat.AimAccuracy");
  const aimBpLabel = game.i18n.localize("CORPUS.Combat.AimBP");

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("CORPUS.Combat.AttackWithWeapon", { weapon: weapon.name }) },
    content: `
      <div class="corpus-attack-dialog">
        <div class="attack-summary">
          <span>${game.i18n.localize("CORPUS.Combat.BaseFormula")}</span>
          <strong>${foundry.utils.escapeHTML(attackFormula)}</strong>
        </div>
        <label>
          <span>${game.i18n.localize("CORPUS.Combat.Modifier")}</span>
          <input type="number" name="modifier" value="0" step="1">
        </label>
        <label>
          <span>${game.i18n.localize("CORPUS.Combat.Circumstance")}</span>
          <select name="circumstance">
            <option value="">${game.i18n.localize("CORPUS.Combat.CircumstanceOther")}</option>
            <option value="cover">${game.i18n.localize("CORPUS.Combat.CircumstanceCover")}</option>
            <option value="range">${game.i18n.localize("CORPUS.Combat.CircumstanceRange")}</option>
            <option value="zone">${game.i18n.localize("CORPUS.Combat.CircumstanceZone")}</option>
          </select>
        </label>
        <label class="attack-check">
          <span>${aimLabel}</span>
          <input type="checkbox" name="aim">
        </label>
        <label>
          <span>${game.i18n.localize("CORPUS.Combat.AimEffect")}</span>
          <select name="aimEffect">
            <option value="accuracy">${aimAccuracyLabel}</option>
            <option value="bp">${aimBpLabel}</option>
          </select>
        </label>
        <p class="attack-note">${game.i18n.localize("CORPUS.Combat.AimHint")}</p>
      </div>
    `,
    buttons: [
      {
        action: "attack",
        label: game.i18n.localize("CORPUS.Combat.RollAttack"),
        icon: "fa-solid fa-dice-d10",
        default: true,
        callback: (dialogEvent, button) => {
          const form = button.form;
          const aim = Boolean(form.elements.aim.checked);
          const aimEffect = form.elements.aimEffect.value;
          const manualModifier = Number(form.elements.modifier.value) || 0;
          const aimAccuracy = aim && aimEffect === "accuracy" ? 2 : 0;
          const bpModifier = aim && aimEffect === "bp" ? 1 : 0;
          const circumstance = form.elements.circumstance.value;
          const options = [];
          if (aim) options.push(aimEffect === "bp" ? aimBpLabel : aimAccuracyLabel);
          if (circumstance) {
            options.push(game.i18n.localize(`CORPUS.Combat.Circumstance.${capitalize(circumstance)}`));
          }

          return {
            modifier: manualModifier + aimAccuracy,
            bpModifier,
            actionPointCost: baseCost + (aim ? 2 : 0),
            reason: [weapon.name, aim ? aimLabel : ""].filter(Boolean).join(" + "),
            options
          };
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  }, { rejectClose: false });

  return result;
}

async function syncActorRollInputs(actor, element) {
  const form = element?.querySelector("form") ?? element;
  if (!form) return;

  const update = {};
  const collect = (root, path) => {
    for (const id of Object.keys(root)) {
      const input = form.querySelector(`[name="system.${path}.${id}.value"]`);
      if (!input) continue;

      const value = Math.max(0, Math.floor(Number(input.value) || 0));
      if (value !== actor.system[path]?.[id]?.value) update[`system.${path}.${id}.value`] = value;
    }
  };

  collect(CORPUS.attributes, "attributes");
  collect(CORPUS.skills, "skills");

  if (Object.keys(update).length) await actor.update(update);
}

function updateRollInfoPanels(element) {
  const form = element?.querySelector("form") ?? element;
  if (!form) return;

  const inputValue = (name, fallback = 0) => {
    const input = form.querySelector(`[name="${name}"]`);
    return Math.floor(Number(input?.value ?? fallback) || 0);
  };
  const attributeValue = (id) => inputValue(`system.attributes.${id}.value`);
  const skillValue = (id) => inputValue(`system.skills.${id}.value`);
  const setText = (root, selector, value) => {
    const target = root.querySelector(selector);
    if (target) target.textContent = String(value);
  };
  const setOutput = (kind, value) => {
    for (const output of form.querySelectorAll(`[data-info-output="${kind}"]`)) {
      if ("value" in output) output.value = value;
      else output.textContent = String(value);
    }
  };

  const resilience = attributeValue("resilience");
  const woundsMaxInput = form.querySelector('[name="system.resources.wounds.max"]');
  const woundsMax = woundsMaxInput ? inputValue("system.resources.wounds.max") : resilience * 3;
  const derived = {
    initiative: attributeValue("reflexes"),
    woundsMax,
    actionPointsValue: inputValue("system.resources.actionPoints.value"),
    actionPointsMax: inputValue("system.resources.actionPoints.max"),
    carryWeight: attributeValue("physique") * 8 + 10,
    implantSlots: attributeValue("synchronization") * 2,
    geneticLimit: attributeValue("resilience") + attributeValue("humanity")
  };

  setOutput("initiative", derived.initiative);
  setOutput("woundsMax", derived.woundsMax);
  setOutput("actionPointsValue", derived.actionPointsValue);
  setOutput("actionPointsMax", derived.actionPointsMax);
  setOutput("carryWeight", derived.carryWeight);
  setOutput("implantSlots", derived.implantSlots);
  setOutput("geneticLimit", derived.geneticLimit);

  for (const panel of form.querySelectorAll("[data-corpus-info]")) {
    switch (panel.dataset.corpusInfo) {
      case "attribute": {
        const value = attributeValue(panel.dataset.attributeId);
        setText(panel, '[data-info-value="attribute"]', value);
        setText(panel, '[data-info-value="total"]', signedNumber(value));
        break;
      }
      case "skill": {
        const skill = skillValue(panel.dataset.skillId);
        const halfAttribute = Math.floor(attributeValue(panel.dataset.attributeId) / 2);
        setText(panel, '[data-info-value="skill"]', signedNumber(skill));
        setText(panel, '[data-info-value="attributeHalf"]', signedNumber(halfAttribute));
        setText(panel, '[data-info-value="total"]', signedNumber(skill + halfAttribute));
        break;
      }
      case "wounds": {
        setText(panel, '[data-info-value="attribute"]', resilience);
        setText(panel, '[data-info-value="current"]', inputValue("system.resources.wounds.value"));
        setText(panel, '[data-info-value="maximum"]', derived.woundsMax);
        break;
      }
      case "actionPoints":
        setText(panel, '[data-info-value="current"]', derived.actionPointsValue);
        setText(panel, '[data-info-value="maximum"]', derived.actionPointsMax);
        break;
      case "initiative":
        setText(panel, '[data-info-value="attribute"]', attributeValue("reflexes"));
        setText(panel, '[data-info-value="total"]', signedNumber(derived.initiative));
        break;
      case "carryWeight":
        setText(panel, '[data-info-value="attribute"]', attributeValue("physique"));
        setText(panel, '[data-info-value="total"]', derived.carryWeight);
        break;
      case "implantSlots":
        setText(panel, '[data-info-value="attribute"]', attributeValue("synchronization"));
        setText(panel, '[data-info-value="total"]', derived.implantSlots);
        break;
      case "geneticLimit":
        setText(panel, '[data-info-value="resilience"]', attributeValue("resilience"));
        setText(panel, '[data-info-value="humanity"]', attributeValue("humanity"));
        setText(panel, '[data-info-value="total"]', derived.geneticLimit);
        break;
      default:
        break;
    }
  }
}

function setupCorpusInfoPopovers(element) {
  const form = element?.querySelector("form") ?? element;
  if (!form) return;

  const owners = new Set();
  for (const popover of form.querySelectorAll(".corpus-info-popover")) {
    const owner = popover.closest(".has-corpus-info, .skill-row, .attribute-card > header");
    if (owner) owners.add(owner);
  }

  for (const owner of owners) {
    if (owner.dataset.corpusInfoReady) continue;
    owner.dataset.corpusInfoReady = "true";

    owner.addEventListener("mouseenter", () => positionCorpusInfoPopover(owner));
    owner.addEventListener("focusin", () => positionCorpusInfoPopover(owner));
    owner.addEventListener("mouseleave", () => resetCorpusInfoPopover(owner));
    owner.addEventListener("focusout", (event) => {
      if (!owner.contains(event.relatedTarget)) resetCorpusInfoPopover(owner);
    });
  }
}

function positionCorpusInfoPopover(owner) {
  const popover = owner.querySelector(".corpus-info-popover")
    || CORPUS_INFO_POPOVER_PORTALS.get(owner)?.popover;
  if (!popover) return;

  let portal = CORPUS_INFO_POPOVER_PORTALS.get(owner);
  if (!portal) {
    portal = {
      popover,
      parent: popover.parentElement,
      nextSibling: popover.nextSibling
    };
    CORPUS_INFO_POPOVER_PORTALS.set(owner, portal);
  }
  popover.classList.add("corpus-info-portal");
  document.body.appendChild(popover);

  popover.classList.add("is-measuring");
  const popoverRect = popover.getBoundingClientRect();
  const ownerRect = owner.getBoundingClientRect();
  popover.classList.remove("is-measuring");

  const margin = 8;
  const gap = 6;
  const width = popoverRect.width;
  const height = popoverRect.height;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  const preferredLeft = ownerRect.right - width;
  const preferredTop = ownerRect.top - height - gap;
  const fallbackTop = ownerRect.bottom + gap;

  const left = clampNumber(preferredLeft, margin, maxLeft);
  const top = preferredTop >= margin
    ? clampNumber(preferredTop, margin, maxTop)
    : clampNumber(fallbackTop, margin, maxTop);

  popover.style.setProperty("--corpus-popover-left", `${Math.round(left)}px`);
  popover.style.setProperty("--corpus-popover-top", `${Math.round(top)}px`);
  popover.classList.add("is-positioned");
}

function resetCorpusInfoPopover(owner) {
  const portal = CORPUS_INFO_POPOVER_PORTALS.get(owner);
  const popover = owner.querySelector(".corpus-info-popover") ?? portal?.popover;
  if (!popover) return;

  popover.classList.remove("is-positioned", "is-measuring", "corpus-info-portal");
  popover.style.removeProperty("--corpus-popover-left");
  popover.style.removeProperty("--corpus-popover-top");

  if (portal?.parent?.isConnected) {
    portal.parent.insertBefore(popover, portal.nextSibling?.isConnected ? portal.nextSibling : null);
  }
  CORPUS_INFO_POPOVER_PORTALS.delete(owner);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function onCompleteCreation(event) {
  event.preventDefault();
  const creation = prepareCreationContext(this.actor);
  if (!creation.hasConcept) {
    return ui.notifications.warn(game.i18n.localize("CORPUS.Actor.Creation.ConceptRequired"));
  }
  if (!creation.canComplete) {
    return ui.notifications.warn(game.i18n.localize("CORPUS.Actor.Creation.PointsRequired"));
  }
  await this.actor.update({ "system.creation.complete": true });
}

async function onReopenCreation(event) {
  event.preventDefault();
  await this.actor.update({ "system.creation.complete": false });
}

async function onResetCreation(event) {
  event.preventDefault();
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("CORPUS.Actor.Creation.Reset") },
    content: `<p>${game.i18n.localize("CORPUS.Actor.Creation.ResetConfirm")}</p>`
  }, { rejectClose: false });
  if (!confirmed) return;

  const update = { "system.creation.complete": false };
  for (const id of Object.keys(CORPUS.attributes)) update[`system.attributes.${id}.value`] = 1;
  for (const id of Object.keys(CORPUS.skills)) update[`system.skills.${id}.value`] = 0;
  await this.actor.update(update);
}

async function onAllocateCreation(event) {
  event.preventDefault();
  const result = await openAllocationDialog(this.actor, { creation: true });
  if (!result) return;

  const modeId = CORPUS.creationModes[result.mode] ? result.mode : "standard";
  const mode = CORPUS.creationModes[modeId];
  const attributes = readAllocationValues(result, "attributes", CORPUS.attributes, 1);
  const skills = readAllocationValues(result, "skills", CORPUS.skills, 0);
  const attributeSpent = Object.values(attributes).reduce((sum, value) => sum + value - 1, 0);
  const skillSpent = Object.values(skills).reduce((sum, value) => sum + value, 0);

  if (attributeSpent > mode.attributePoints || skillSpent > mode.skillPoints) {
    return ui.notifications.warn(game.i18n.localize("CORPUS.Actor.Creation.BudgetExceeded"));
  }

  const update = {
    "system.creation.mode": modeId,
    "system.creation.complete": false
  };
  for (const [id, value] of Object.entries(attributes)) update[`system.attributes.${id}.value`] = value;
  for (const [id, value] of Object.entries(skills)) update[`system.skills.${id}.value`] = value;
  await this.actor.update(update);
}

async function onAdvanceCharacter(event) {
  event.preventDefault();
  const available = this.actor.system.advancement?.points ?? 0;

  const result = await openAllocationDialog(this.actor, { creation: false });
  if (!result) return;

  const attributes = readAllocationValues(result, "attributes", CORPUS.attributes, 1);
  const skills = readAllocationValues(result, "skills", CORPUS.skills, 0);
  let spent = 0;

  for (const [id, value] of Object.entries(attributes)) {
    const current = this.actor.system.attributes[id].value;
    if (value < current) return ui.notifications.warn(game.i18n.localize("CORPUS.Actor.Advancement.NoDecrease"));
    spent += value - current;
  }
  for (const [id, value] of Object.entries(skills)) {
    const current = this.actor.system.skills[id].value;
    if (value < current) return ui.notifications.warn(game.i18n.localize("CORPUS.Actor.Advancement.NoDecrease"));
    spent += value - current;
  }
  if (spent < 1) return;
  if (spent > available) {
    return ui.notifications.warn(game.i18n.localize("CORPUS.Actor.Advancement.NotEnoughPoints"));
  }

  const update = { "system.advancement.points": available - spent };
  for (const [id, value] of Object.entries(attributes)) update[`system.attributes.${id}.value`] = value;
  for (const [id, value] of Object.entries(skills)) update[`system.skills.${id}.value`] = value;
  await this.actor.update(update);
}

async function openAllocationDialog(actor, { creation }) {
  const title = game.i18n.localize(creation
    ? "CORPUS.Actor.Creation.Allocate"
    : "CORPUS.Actor.Advancement.Title");
  const modeOptions = Object.entries(CORPUS.creationModes).map(([id, config]) => {
    const selected = id === actor.system.creation.mode ? " selected" : "";
    return `<option value="${id}"${selected}>${game.i18n.localize(config.label)}</option>`;
  }).join("");
  const attributeFields = allocationFields(actor.system.attributes, CORPUS.attributes, 1, { steppers: !creation });
  const skillFields = allocationFields(actor.system.skills, CORPUS.skills, 0, { steppers: !creation });
  const available = actor.system.advancement?.points ?? 0;

  const content = `
    <div class="corpus-allocation-dialog ${creation ? "" : "is-advancement"}">
      ${creation ? `
        <label class="allocation-mode">
          <span>${game.i18n.localize("CORPUS.Actor.Creation.Mode")}</span>
          <select name="mode">${modeOptions}</select>
        </label>
      ` : `
        <p class="allocation-points">${game.i18n.format("CORPUS.Actor.Advancement.Available", { points: available })}</p>
      `}
      <div class="allocation-columns">
        <section><h3>${game.i18n.localize("CORPUS.Actor.Creation.AttributePoints")}</h3>${attributeFields}</section>
        <section><h3>${game.i18n.localize("CORPUS.Actor.Creation.SkillPoints")}</h3>${skillFields}</section>
      </div>
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    position: creation ? { width: 720, height: 720 } : { width: 540, height: 560 },
    content,
    buttons: [
      {
        action: "save",
        label: game.i18n.localize("Save"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (dialogEvent, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  }, { rejectClose: false });
}

function allocationFields(values, config, min, { steppers = false } = {}) {
  return Object.entries(config).map(([id, entry]) => {
    const value = Math.max(min, Number(values[id]?.value) || min);
    const label = foundry.utils.escapeHTML(game.i18n.localize(entry.label));
    const fieldName = `${config === CORPUS.attributes ? "attributes" : "skills"}.${id}`;
    const fieldMin = steppers ? value : min;
    const input = `<input type="number" name="${fieldName}" value="${value}" min="${fieldMin}" step="1">`;

    return `
      <label class="allocation-field">
        <span>${label}</span>
        ${steppers ? `
          <span class="allocation-stepper">
            <button type="button" data-allocation-step="-1" aria-label="-"><i class="fa-solid fa-minus"></i></button>
            ${input}
            <button type="button" data-allocation-step="1" aria-label="+"><i class="fa-solid fa-plus"></i></button>
          </span>
        ` : input}
      </label>`;
  }).join("");
}

function readAllocationValues(result, path, config, min) {
  return Object.fromEntries(Object.keys(config).map((id) => [
    id,
    Math.max(min, Math.floor(Number(foundry.utils.getProperty(result, `${path}.${id}`)) || min))
  ]));
}

function percent(value, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function buildFormulaPreview(parts) {
  return parts
    .map((part) => Number(part) === part ? signedNumber(part) : part)
    .filter((part) => part !== "+ 0")
    .join(" ");
}

function signedNumber(value) {
  if (!value) return "+ 0";
  return value > 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
}

function prepareCreationContext(actor) {
  const modeId = CORPUS.creationModes[actor.system.creation?.mode]
    ? actor.system.creation.mode
    : "standard";
  const mode = CORPUS.creationModes[modeId];
  const attributeSpent = Object.values(actor.system.attributes)
    .reduce((total, attribute) => total + Math.max(0, attribute.value - 1), 0);
  const skillSpent = Object.values(actor.system.skills)
    .reduce((total, skill) => total + Math.max(0, skill.value), 0);
  const attributeRemaining = mode.attributePoints - attributeSpent;
  const skillRemaining = mode.skillPoints - skillSpent;
  const hasConcept = Boolean(actor.system.concept?.trim());

  return {
    complete: Boolean(actor.system.creation?.complete),
    modeLabel: game.i18n.localize(mode.label),
    advancementPoints: actor.system.advancement?.points ?? 0,
    modes: Object.entries(CORPUS.creationModes).map(([value, config]) => ({
      value,
      label: game.i18n.localize(config.label),
      selected: value === modeId
    })),
    attributeSpent,
    attributeBudget: mode.attributePoints,
    attributeRemaining,
    attributePercent: percent(attributeSpent, mode.attributePoints),
    attributeOver: attributeRemaining < 0,
    skillSpent,
    skillBudget: mode.skillPoints,
    skillRemaining,
    skillPercent: percent(skillSpent, mode.skillPoints),
    skillOver: skillRemaining < 0,
    hasConcept,
    canComplete: hasConcept && attributeRemaining === 0 && skillRemaining === 0
  };
}

function localizeLabel(key) {
  return game.i18n.localize(key);
}

function rollInfoLabels() {
  const ru = game.i18n.lang === "ru";
  return {
    attributeValue: ru ? "Значение характеристики" : "Attribute value",
    skillValue: ru ? "Значение навыка" : "Skill value",
    halfAttribute: ru ? "1/2 характеристики" : "1/2 attribute",
    currentModifier: ru ? "Текущий модификатор" : "Current modifier",
    currentValue: ru ? "Текущее значение" : "Current value",
    maximum: ru ? "Максимум" : "Maximum",
    base: ru ? "База" : "Base",
    resilience: localizeLabel("CORPUS.Actor.Attributes.Resilience"),
    reflexes: localizeLabel("CORPUS.Actor.Attributes.Reflexes"),
    physique: localizeLabel("CORPUS.Actor.Attributes.Physique"),
    synchronization: localizeLabel("CORPUS.Actor.Attributes.Synchronization"),
    humanity: localizeLabel("CORPUS.Actor.Attributes.Humanity")
  };
}

function hudStat(labelKey, attributes = []) {
  const tooltipKey = attributes.length
    ? "CORPUS.Actor.LinkedAttributes"
    : "CORPUS.Actor.NoLinkedAttribute";

  return {
    label: localizeLabel(labelKey),
    tooltip: game.i18n.format(tooltipKey, {
      attributes: attributes.join(" + ")
    })
  };
}

function buildItemSections(actor, activeTab, hud) {
  return ACTOR_ITEM_SECTIONS.map((section) => {
    const listLayout = section.id === "inventory" || section.id === "modifications";
    const inventorySummary = section.id === "inventory" && actor.type === "character"
      ? buildInventorySummary(actor, hud)
      : null;
    return {
      ...section,
      label: game.i18n.localize(section.label),
      active: section.id === activeTab,
      listLayout,
      inventoryColumns: section.id === "inventory",
      compactList: listLayout,
      showCredits: section.id === "inventory" && actor.type === "character",
      inventorySummary,
      stats: buildSectionStats(actor, section.id, hud),
      groups: section.id === "modifications"
        ? buildModificationGroups(actor, section.types)
        : buildItemGroups(actor, section.types)
    };
  });
}

function buildInventorySummary(actor, hud) {
  const currentWeight = actor.items.reduce((total, item) => {
    const weight = Number(item.system.weight) || 0;
    const quantity = Math.max(1, Number(item.system.quantity) || 1);
    return total + weight * quantity;
  }, 0);
  const formattedWeight = Number.isInteger(currentWeight)
    ? currentWeight
    : Number(currentWeight.toFixed(1));

  return {
    carryLabel: hud.carryWeight.label,
    currentWeight: formattedWeight,
    maximumWeight: actor.system.derived.carryWeight,
    creditsLabel: game.i18n.localize("CORPUS.Actor.Credits"),
    credits: actor.system.currency?.credits ?? 0
  };
}

function buildSectionStats(actor, sectionId, hud) {
  switch (sectionId) {
    case "inventory":
      return [];
    case "modifications":
      return [
        {
          ...hud.implantSlots,
          infoKind: "implantSlots",
          isImplantSlots: true,
          value: actor.system.derived.implantSlots
        },
        {
          ...hud.geneticLimit,
          infoKind: "geneticLimit",
          isGeneticLimit: true,
          value: actor.system.derived.geneticLimit
        }
      ];
    default:
      return [];
  }
}

function buildItemGroups(actor, types) {
  return types.map((type) => ({
    type,
    label: game.i18n.localize(`CORPUS.Item.Types.${type}`),
    items: actor.items
      .filter((item) => item.type === type)
      .map((item) => prepareItemListEntry(item, actor))
      .sort((a, b) => a.name.localeCompare(b.name))
  }));
}

function buildModificationGroups(actor, types) {
  return MODIFICATION_LOCATIONS.map((location) => ({
    location,
    label: game.i18n.localize(`CORPUS.Item.Locations.${capitalize(location)}`),
    createTypes: types.join(","),
    items: actor.items
      .filter((item) => types.includes(item.type) && (item.system.location || "other") === location)
      .map((item) => prepareItemListEntry(item, actor))
      .sort((a, b) => a.name.localeCompare(b.name))
  }));
}

function prepareItemListEntry(item, actor = item.actor) {
  const summary = itemSummary(item);
  const typeLabel = game.i18n.localize(`CORPUS.Item.Types.${item.type}`);
  const tags = item.system.tags ?? "";
  const meta = itemMeta(item, summary);
  const attackFormula = item.type === "weapon" ? weaponAttackFormula(item, actor) : "";

  return {
    ...item.toObject(),
    isWeapon: item.type === "weapon",
    isEquippable: "equipped" in item.system,
    isActivatable: "active" in item.system,
    equipped: Boolean(item.system.equipped),
    active: Boolean(item.system.active),
    typeLabel,
    summary,
    meta,
    attackFormula,
    attackTooltip: [game.i18n.localize("CORPUS.Combat.Attack"), attackFormula].filter(Boolean).join(" | "),
    searchText: [item.name, typeLabel, tags, summary, ...meta.map((entry) => entry.label)].filter(Boolean).join(" "),
    quantity: item.system.quantity ?? 1,
    weight: itemWeight(item)
  };
}

function weaponAttackFormula(item, actor) {
  if (!actor) return "";
  if (actor.type === "npc") {
    return buildFormulaPreview(["1d10", actor.system.combat?.attackBonus ?? 0]);
  }

  const melee = item.system.attackMode === "melee";
  const skillId = melee ? "melee" : "shooting";
  const attributeId = melee ? "physique" : "reflexes";
  return buildFormulaPreview([
    "1d10",
    actor.system.skills[skillId]?.value ?? 0,
    Math.floor((actor.system.attributes[attributeId]?.value ?? 0) / 2)
  ]);
}

function itemWeight(item) {
  if (item.type === "weapon") return item.system.weightClass || "—";
  const weight = Number(item.system.weight) || 0;
  return weight > 0 ? `${weight} ${game.i18n.localize("CORPUS.Common.Kilograms")}` : "—";
}

function filterInventory(sheet, query) {
  const normalized = query.trim().toLocaleLowerCase(game.i18n.lang);
  for (const group of sheet.querySelectorAll(".inventory-list .item-group")) {
    let visible = 0;
    for (const row of group.querySelectorAll(".item-row")) {
      const searchText = row.dataset.searchText?.toLocaleLowerCase(game.i18n.lang) ?? "";
      row.hidden = Boolean(normalized) && !searchText.includes(normalized);
      if (!row.hidden) visible++;
    }
    group.hidden = Boolean(normalized) && visible === 0;
  }
}

function itemMeta(item, summary) {
  const meta = [
    { label: game.i18n.localize(`CORPUS.Item.Types.${item.type}`), kind: "type" }
  ];

  if (summary) meta.push({ label: summary, kind: "primary" });

  switch (item.type) {
    case "weapon":
      addMeta(meta, itemRangePair(item), "range");
      addMeta(meta, item.system.bp ? `BP ${item.system.bp}` : "", "bp");
      addMeta(meta, item.system.speed ? `${game.i18n.localize("CORPUS.Item.Speed")}: ${item.system.speed}` : "", "speed");
      break;
    case "armor":
      addMeta(meta, item.system.weight ? `${item.system.weight} ${game.i18n.localize("CORPUS.Common.Kilograms")}` : "", "weight");
      break;
    case "equipment":
      addMeta(meta, item.system.weight ? `${item.system.weight} ${game.i18n.localize("CORPUS.Common.Kilograms")}` : "", "weight");
      break;
    case "consumable":
      addMeta(meta, item.system.weight ? `${item.system.weight} ${game.i18n.localize("CORPUS.Common.Kilograms")}` : "", "weight");
      addMeta(meta, `${game.i18n.localize("CORPUS.Item.ActionCost")}: ${item.system.actionCost}`, "action");
      break;
    case "implant":
    case "ability":
    case "maneuver":
      addMeta(meta, `${game.i18n.localize("CORPUS.Item.ActionCost")}: ${item.system.actionCost}`, "action");
      break;
    default:
      break;
  }

  return meta;
}

function addMeta(meta, label, kind) {
  if (label) meta.push({ label, kind });
}

function itemRangePair(item) {
  const comfortable = String(item.system.comfortableRange ?? "").trim();
  const maximum = String(item.system.maximumRange ?? "").trim();
  if (comfortable && maximum) return `${comfortable}/${maximum}`;
  return comfortable || maximum;
}

function itemSummary(item) {
  switch (item.type) {
    case "weapon": return item.damageFormula;
    case "armor": return `C ${item.system.structure} / ${game.i18n.localize("CORPUS.Item.MitigationShort")} ${item.system.mitigation}`;
    case "equipment":
    case "consumable": return game.i18n.format("CORPUS.Item.QuantitySummary", { quantity: item.system.quantity });
    case "implant": return game.i18n.format("CORPUS.Item.SlotSummary", { slots: item.system.slotCost });
    case "genetic": return game.i18n.format("CORPUS.Item.LimitSummary", { limit: item.system.limitCost });
    case "condition": return item.system.duration || game.i18n.localize(`CORPUS.Item.ConditionCategories.${capitalize(item.system.category)}`);
    case "maneuver": return game.i18n.format("CORPUS.Item.ActionCostSummary", { cost: item.system.actionCost });
    case "ability": return game.i18n.format("CORPUS.Item.ActionCostSummary", { cost: item.system.actionCost });
    case "trait": return game.i18n.format("CORPUS.Item.RankSummary", { rank: item.system.rank });
    default: return "";
  }
}

function capitalize(value) {
  const text = String(value ?? "");
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export class CorpusItemSheet extends CorpusDocumentSheetMixin(
  HandlebarsApplicationMixin(ItemSheetV2)
) {
  static DEFAULT_OPTIONS = {
    classes: ["corpus", "sheet", "item"],
    position: {
      width: 540,
      height: 500
    },
    actions: {
      setTab: onSetTab,
      toggleDescriptionEdit: onToggleDescriptionEdit,
      toggleDetailsEdit: onToggleDetailsEdit,
      saveItem: onSaveItem
    }
  };

  static PARTS = {
    form: {
      template: "systems/corpus/templates/item-sheet-0.6.37.hbs"
    }
  };

  _activeTab = "description";
  _descriptionEditing = false;
  _detailsEditing = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const description = this.item.system.description ?? "";

    return {
      ...context,
      item: this.item,
      isEquipment: this.item.type === "equipment",
      isConsumable: this.item.type === "consumable",
      isAbility: this.item.type === "ability",
      isTrait: this.item.type === "trait",
      isWeapon: this.item.type === "weapon",
      isArmor: this.item.type === "armor",
      isImplant: this.item.type === "implant",
      isGenetic: this.item.type === "genetic",
      isModification: ["implant", "genetic", "ability", "trait"].includes(this.item.type),
      isCondition: this.item.type === "condition",
      isManeuver: this.item.type === "maneuver",
      typeLabel: game.i18n.localize(`CORPUS.Item.Types.${this.item.type}`),
      tabs: {
        details: this._activeTab === "details",
        description: this._activeTab === "description"
      },
      descriptionEditing: this._descriptionEditing,
      detailsEditing: this._detailsEditing,
      descriptionHTML: await enrichItemDescription(this.item, description),
      summaryRows: itemSheetSummary(this.item),
      attackModes: localizeRecord(CORPUS.attackModes, this.item.system.attackMode),
      damageFormula: this.item.type === "weapon" ? this.item.damageFormula : null,
      damageTypes: localizeRecord(CORPUS.damageTypes, this.item.system.damageType),
      maneuverTypes: localizeRecord(CORPUS.maneuverTypes, this.item.system.maneuverType),
      conditionCategories: localizeRecord(CORPUS.conditionCategories, this.item.system.category),
      bodyLocations: localizeRecord(
        Object.fromEntries(MODIFICATION_LOCATIONS.map((location) => [
          location,
          `CORPUS.Item.Locations.${capitalize(location)}`
        ])),
        this.item.system.location
      )
    };
  }
}

function onToggleDescriptionEdit(event) {
  event.preventDefault();
  this._descriptionEditing = !this._descriptionEditing;
  this.render();
}

function onToggleDetailsEdit(event) {
  event.preventDefault();
  this._detailsEditing = !this._detailsEditing;
  this.render();
}

async function onSaveItem(event, target) {
  event.preventDefault();
  await saveItemSheetForm(this, target.closest("form"));

  if (target.dataset.finishEdit) {
    this._descriptionEditing = false;
  }
  if (target.dataset.finishDetailsEdit) {
    this._detailsEditing = false;
  }
  this.render();
}

async function saveItemSheetForm(sheet, form) {
  if (!form) return;

  syncDescriptionEditor(form);

  const FormDataExtended = foundry.applications.ux.FormDataExtended;
  const formData = new FormDataExtended(form);
  const update = formData.object;

  if (Object.keys(update).length) {
    await sheet.item.update(update);
  }
}

function syncDescriptionEditor(form) {
  const editor = form.querySelector("[data-description-editor]");
  const input = form.querySelector("[data-description-input]");
  if (editor && input) input.value = editor.innerHTML.trim();
}

async function enrichItemDescription(item, description) {
  if (!description) return "";
  if (!globalThis.TextEditor?.enrichHTML) return description;
  return TextEditor.enrichHTML(description, {
    async: true,
    relativeTo: item,
    secrets: item.isOwner
  });
}

function itemSheetSummary(item) {
  const rows = [
    { label: game.i18n.localize("CORPUS.Item.Type"), value: game.i18n.localize(`CORPUS.Item.Types.${item.type}`) }
  ];

  addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Tags"), item.system.tags);

  switch (item.type) {
    case "weapon":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.DamageFormula"), item.damageFormula);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.BP"), item.system.bp);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.DamageType"), localizedConfigValue(CORPUS.damageTypes, item.system.damageType));
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Range"), itemRangePair(item));
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Speed"), item.system.speed);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Magazine"), item.system.magazine);
      break;
    case "armor":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Structure"), item.system.structure);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Mitigation"), item.system.mitigation);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Weight"), item.system.weight);
      break;
    case "equipment":
    case "consumable":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Quantity"), item.system.quantity);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Weight"), item.system.weight);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.ActionCost"), item.system.actionCost);
      break;
    case "implant":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.SlotCost"), item.system.slotCost);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.ActionCost"), item.system.actionCost);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Active"), item.system.active ? game.i18n.localize("CORPUS.Item.Active") : "");
      break;
    case "genetic":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.LimitCost"), item.system.limitCost);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Active"), item.system.active ? game.i18n.localize("CORPUS.Item.Active") : "");
      break;
    case "condition":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.ConditionCategory"), localizedConfigValue(CORPUS.conditionCategories, item.system.category));
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Duration"), item.system.duration);
      break;
    case "maneuver":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.ManeuverType"), localizedConfigValue(CORPUS.maneuverTypes, item.system.maneuverType));
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.ActionCost"), item.system.actionCost);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.BP"), item.system.bp);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Accuracy"), item.system.accuracy);
      break;
    case "ability":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.ActionCost"), item.system.actionCost);
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Roll"), item.system.roll);
      break;
    case "trait":
      addSummaryRow(rows, game.i18n.localize("CORPUS.Item.Rank"), item.system.rank);
      break;
    default:
      break;
  }

  return rows;
}

function addSummaryRow(rows, label, value) {
  if (value === null || value === undefined || value === "") return;
  rows.push({ label, value });
}

function localizedConfigValue(record, value) {
  const key = record?.[value];
  return key ? game.i18n.localize(key) : value;
}

function localizeRecord(record, selectedValue = null) {
  return Object.entries(record).map(([value, label]) => ({
    value,
    label: game.i18n.localize(label),
    selected: value === selectedValue
  }));
}
