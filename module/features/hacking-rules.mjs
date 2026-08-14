export const HACKING_ACCESS = {
  none: {
    difficultyModifier: 0,
    label: {
      key: "CORPUS.Hacking.Access.None",
      fallback: { en: "No access", ru: "Нет доступа" }
    }
  },
  connected: {
    difficultyModifier: -2,
    label: {
      key: "CORPUS.Hacking.Access.Connected",
      fallback: { en: "Connected", ru: "Подключение" }
    }
  },
  deep: {
    difficultyModifier: -4,
    label: {
      key: "CORPUS.Hacking.Access.Deep",
      fallback: { en: "Deep Access", ru: "Глубокий доступ" }
    }
  }
};

export const HACKING_ACTIONS = [
  {
    id: "ping",
    apCost: 1,
    label: { key: "CORPUS.Hacking.Actions.Ping", fallback: { en: "Ping", ru: "Ping" } },
    risk: { en: "First Ping: Trace +0; repeat Ping: Trace +1.", ru: "Первый Ping: Trace +0; повторный Ping: Trace +1." }
  },
  {
    id: "connect",
    apCost: 1,
    label: { key: "CORPUS.Hacking.Actions.Connect", fallback: { en: "Connect", ru: "Connect" } },
    risk: { en: "Failure: Remote Trace +2; Direct Trace +1 or local alarm.", ru: "Провал: Remote Trace +2; Direct Trace +1 или локальная тревога." }
  },
  {
    id: "deepAccess",
    apCost: 1,
    label: { key: "CORPUS.Hacking.Actions.DeepAccess", fallback: { en: "Deep Access", ru: "Deep Access" } },
    risk: { en: "Requires Connected. Failure: Trace +3 and possible countermeasure.", ru: "Требует Connected. Провал: Trace +3 и возможная контрмера." }
  },
  {
    id: "jam",
    apCost: 1,
    label: { key: "CORPUS.Hacking.Actions.Jam", fallback: { en: "Jam", ru: "Jam" } },
    risk: { en: "Risk: Trace +1; brute overload may add Heat +1.", ru: "Риск: Trace +1; грубая перегрузка может дать Heat +1." }
  },
  {
    id: "spoofSignal",
    apCost: 1,
    label: { key: "CORPUS.Hacking.Actions.SpoofSignal", fallback: { en: "Spoof Signal", ru: "Spoof Signal" } },
    risk: { en: "Risk: Trace +1; serious systems may cause Trace +2 on failure.", ru: "Риск: Trace +1; серьёзные системы при провале могут дать Trace +2." }
  },
  {
    id: "unlockDisable",
    apCost: 2,
    label: { key: "CORPUS.Hacking.Actions.UnlockDisable", fallback: { en: "Unlock / Disable", ru: "Unlock / Disable" } },
    risk: { en: "Risk: Trace +1, or Trace +2 for protected systems.", ru: "Риск: Trace +1, или Trace +2 для защищённых систем." }
  },
  {
    id: "implantJam",
    apCost: 2,
    label: { key: "CORPUS.Hacking.Actions.ImplantJam", fallback: { en: "Implant Jam", ru: "Implant Jam" } },
    risk: { en: "Failure: Heat +1; protected implants may cause neuroshock.", ru: "Провал: Heat +1; защищённые импланты могут ответить нейрошоком." }
  },
  {
    id: "overrideTakeover",
    apCost: 3,
    label: { key: "CORPUS.Hacking.Actions.OverrideTakeover", fallback: { en: "Override / Takeover", ru: "Override / Takeover" } },
    risk: { en: "Requires Connected; protected targets may require Deep Access. Risk: Trace +3.", ru: "Требует Connected; защищённые цели могут требовать Deep Access. Риск: Trace +3." }
  },
  {
    id: "emergencyKill",
    apCost: 3,
    label: { key: "CORPUS.Hacking.Actions.EmergencyKill", fallback: { en: "Emergency Kill", ru: "Emergency Kill" } },
    risk: { en: "Requires Connected; often needs Deep Access or Direct. Risk: Trace +3, Heat +1.", ru: "Требует Connected; часто нужен Deep Access или Direct. Риск: Trace +3, Heat +1." }
  }
];

export function getHackingAction(actionId) {
  return HACKING_ACTIONS.find((action) => action.id === actionId) ?? HACKING_ACTIONS[1];
}

export function getHackingAccess(accessId) {
  return HACKING_ACCESS[accessId] ?? HACKING_ACCESS.none;
}

export function effectiveHackingDifficulty(targetDefense, accessId) {
  const base = Math.max(0, Math.floor(Number(targetDefense) || 0));
  return Math.max(0, base + getHackingAccess(accessId).difficultyModifier);
}
