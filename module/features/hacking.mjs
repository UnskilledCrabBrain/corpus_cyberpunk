import { numberField, resourceField, signedNumberField } from "../fields.mjs?v=0.6.37";
import {
  HACKING_ACCESS,
  HACKING_ACTIONS,
  effectiveHackingDifficulty,
  getHackingAction
} from "./hacking-rules.mjs?v=0.6.37";
import { fallbackText, t } from "../i18n.mjs?v=0.6.37";

const {
  SchemaField,
  StringField
} = foundry.data.fields;

const HACKING_LABELS = {
  tab: {
    key: "CORPUS.Actor.Tabs.Hacking",
    fallback: { en: "Hacking", ru: "Хакерство" }
  },
  title: {
    key: "CORPUS.Hacking.Title",
    fallback: { en: "Hacking Console", ru: "Хакерская консоль" }
  },
  formula: {
    key: "CORPUS.Hacking.Formula",
    fallback: { en: "Cyberhacking roll", ru: "Бросок кибервзлома" }
  },
  action: {
    key: "CORPUS.Hacking.Action",
    fallback: { en: "Action", ru: "Действие" }
  },
  roll: {
    key: "CORPUS.Hacking.Roll",
    fallback: { en: "Roll hack", ru: "Бросить взлом" }
  },
  modifier: {
    key: "CORPUS.Hacking.Modifier",
    fallback: { en: "Modifier", ru: "Модификатор" }
  },
  baseDifficulty: {
    key: "CORPUS.Hacking.BaseDifficulty",
    fallback: { en: "Base difficulty", ru: "Базовая Сл" }
  },
  effectiveDifficulty: {
    key: "CORPUS.Hacking.EffectiveDifficulty",
    fallback: { en: "Effective difficulty", ru: "Итоговая Сл" }
  },
  apCost: {
    key: "CORPUS.Hacking.APCost",
    fallback: { en: "AP", ru: "ОД" }
  },
  risk: {
    key: "CORPUS.Hacking.Risk",
    fallback: { en: "Risk", ru: "Риск" }
  },
  trace: {
    key: "CORPUS.Hacking.Trace",
    fallback: { en: "Trace", ru: "След" }
  },
  heat: {
    key: "CORPUS.Hacking.Heat",
    fallback: { en: "Heat", ru: "Нагрев" }
  },
  cpu: {
    key: "CORPUS.Hacking.CPU",
    fallback: { en: "CPU", ru: "CPU" }
  },
  targetDefense: {
    key: "CORPUS.Hacking.TargetDefense",
    fallback: { en: "Target difficulty", ru: "Сложность цели" }
  },
  access: {
    key: "CORPUS.Hacking.Access",
    fallback: { en: "Access", ru: "Доступ" }
  },
  accessNone: {
    key: "CORPUS.Hacking.Access.None",
    fallback: { en: "No access", ru: "Нет доступа" }
  },
  accessConnected: {
    key: "CORPUS.Hacking.Access.Connected",
    fallback: { en: "Connected", ru: "Подключение" }
  },
  accessDeep: {
    key: "CORPUS.Hacking.Access.Deep",
    fallback: { en: "Deep Access", ru: "Глубокий доступ" }
  }
};

export const hackingFeature = {
  id: "hacking",
  icon: "fa-solid fa-network-wired",
  order: 50,
  label: HACKING_LABELS.tab,
  template: "systems/corpus/templates/features/hacking-tab.hbs",

  actorSchema() {
    return new SchemaField({
      trace: resourceField({ value: 0, max: 5 }),
      heat: resourceField({ value: 0, max: 6 }),
      cpu: resourceField({ value: 0, max: 4 }),
      targetDefense: numberField({ initial: 12 }),
      access: new StringField({ required: true, blank: false, initial: "none" }),
      action: new StringField({ required: true, blank: false, initial: "connect" }),
      modifier: signedNumberField({ initial: 0 })
    });
  },

  prepareDerivedData(system) {
    const hacking = system.hacking;
    if (!hacking) return;

    hacking.trace.value = clamp(hacking.trace.value, hacking.trace.min, hacking.trace.max);
    hacking.heat.value = clamp(hacking.heat.value, hacking.heat.min, hacking.heat.max);
    hacking.cpu.value = clamp(hacking.cpu.value, hacking.cpu.min, hacking.cpu.max);
  },

  async prepareActorTab(actor) {
    const context = prepareHackingContext(actor);

    return {
      panelClass: "hacking-panel",
      context,
      content: await renderTemplate(this.template, context)
    };
  }
};

function prepareHackingContext(actor) {
  const hacking = actor.system.hacking ?? {};
  const trace = hacking.trace ?? { min: 0, value: 0, max: 5 };
  const heat = hacking.heat ?? { min: 0, value: 0, max: 6 };
  const cpu = hacking.cpu ?? { min: 0, value: 0, max: 4 };
  const cyberhacking = actor.system.skills.cyberhacking?.value ?? 0;
  const reason = actor.system.attributes.reason?.value ?? 0;
  const access = hacking.access ?? "none";
  const actionId = getHackingAction(hacking.action).id;
  const modifier = Math.floor(Number(hacking.modifier) || 0);
  const targetDefense = hacking.targetDefense ?? 12;
  const labels = localizeLabels();
  const selectedAction = getHackingAction(actionId);
  const effectiveDifficulty = effectiveHackingDifficulty(targetDefense, access);

  return {
    trace,
    heat,
    cpu,
    action: actionId,
    modifier,
    targetDefense,
    effectiveDifficulty,
    access,
    labels,
    formulaBonus: cyberhacking + Math.floor(reason / 2) + modifier,
    formula: buildFormulaPreview(["1d10", cyberhacking, Math.floor(reason / 2), modifier]),
    selectedAction: {
      ...selectedAction,
      label: t(selectedAction.label.key, selectedAction.label.fallback),
      risk: fallbackText(selectedAction.risk)
    },
    actionOptions: HACKING_ACTIONS.map((action) => ({
      value: action.id,
      label: t(action.label.key, action.label.fallback),
      selected: action.id === actionId
    })),
    accessOptions: Object.entries(HACKING_ACCESS).map(([value, config]) => ({
      value,
      label: t(config.label.key, config.label.fallback),
      selected: value === access
    })),
    tracePercent: percent(trace.value, trace.max),
    heatPercent: percent(heat.value, heat.max),
    cpuPercent: percent(cpu.value, cpu.max)
  };
}

function localizeLabels() {
  return Object.fromEntries(
    Object.entries(HACKING_LABELS).map(([id, label]) => [
      id,
      t(label.key, label.fallback)
    ])
  );
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
