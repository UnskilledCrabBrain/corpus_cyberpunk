export const CORPUS = {
  creationModes: {
    low: {
      label: "CORPUS.Actor.Creation.Modes.Low",
      attributePoints: 12,
      skillPoints: 15
    },
    standard: {
      label: "CORPUS.Actor.Creation.Modes.Standard",
      attributePoints: 14,
      skillPoints: 18
    },
    professional: {
      label: "CORPUS.Actor.Creation.Modes.Professional",
      attributePoints: 16,
      skillPoints: 21
    }
  },
  attributes: {
    physique: {
      label: "CORPUS.Actor.Attributes.Physique"
    },
    reflexes: {
      label: "CORPUS.Actor.Attributes.Reflexes"
    },
    reason: {
      label: "CORPUS.Actor.Attributes.Reason"
    },
    synchronization: {
      label: "CORPUS.Actor.Attributes.Synchronization"
    },
    influence: {
      label: "CORPUS.Actor.Attributes.Influence"
    },
    resilience: {
      label: "CORPUS.Actor.Attributes.Resilience"
    },
    humanity: {
      label: "CORPUS.Actor.Attributes.Humanity"
    }
  },
  skills: {
    melee: {
      label: "CORPUS.Actor.Skills.Melee",
      attribute: "physique"
    },
    athletics: {
      label: "CORPUS.Actor.Skills.Athletics",
      attribute: "physique"
    },
    load: {
      label: "CORPUS.Actor.Skills.Load",
      attribute: "physique"
    },
    shooting: {
      label: "CORPUS.Actor.Skills.Shooting",
      attribute: "reflexes"
    },
    evasion: {
      label: "CORPUS.Actor.Skills.Evasion",
      attribute: "reflexes"
    },
    piloting: {
      label: "CORPUS.Actor.Skills.Piloting",
      attribute: "reflexes"
    },
    cyberhacking: {
      label: "CORPUS.Actor.Skills.Cyberhacking",
      attribute: "reason"
    },
    technology: {
      label: "CORPUS.Actor.Skills.Technology",
      attribute: "reason"
    },
    analysis: {
      label: "CORPUS.Actor.Skills.Analysis",
      attribute: "reason"
    },
    implants: {
      label: "CORPUS.Actor.Skills.Implants",
      attribute: "synchronization"
    },
    technoadaptation: {
      label: "CORPUS.Actor.Skills.Technoadaptation",
      attribute: "synchronization"
    },
    cyberlink: {
      label: "CORPUS.Actor.Skills.Cyberlink",
      attribute: "synchronization"
    },
    persuasion: {
      label: "CORPUS.Actor.Skills.Persuasion",
      attribute: "influence"
    },
    deception: {
      label: "CORPUS.Actor.Skills.Deception",
      attribute: "influence"
    },
    intimidation: {
      label: "CORPUS.Actor.Skills.Intimidation",
      attribute: "influence"
    },
    will: {
      label: "CORPUS.Actor.Skills.Will",
      attribute: "resilience"
    },
    endurance: {
      label: "CORPUS.Actor.Skills.Endurance",
      attribute: "resilience"
    },
    resistance: {
      label: "CORPUS.Actor.Skills.Resistance",
      attribute: "resilience"
    },
    empathy: {
      label: "CORPUS.Actor.Skills.Empathy",
      attribute: "humanity"
    },
    firstAid: {
      label: "CORPUS.Actor.Skills.FirstAid",
      attribute: "humanity"
    },
    trust: {
      label: "CORPUS.Actor.Skills.Trust",
      attribute: "humanity"
    }
  },
  damageTypes: {
    piercing: "CORPUS.Item.DamageTypes.Piercing",
    slashing: "CORPUS.Item.DamageTypes.Slashing",
    blunt: "CORPUS.Item.DamageTypes.Blunt"
  },
  attackModes: {
    melee: "CORPUS.Item.AttackModes.Melee",
    ranged: "CORPUS.Item.AttackModes.Ranged"
  },
  ranges: {
    close: "CORPUS.Item.Ranges.Close",
    medium: "CORPUS.Item.Ranges.Medium",
    far: "CORPUS.Item.Ranges.Far"
  },
  maneuverTypes: {
    damage: "CORPUS.Item.ManeuverTypes.Damage",
    penetration: "CORPUS.Item.ManeuverTypes.Penetration",
    control: "CORPUS.Item.ManeuverTypes.Control",
    position: "CORPUS.Item.ManeuverTypes.Position",
    accuracy: "CORPUS.Item.ManeuverTypes.Accuracy"
  },
  conditionCategories: {
    physical: "CORPUS.Item.ConditionCategories.Physical",
    combat: "CORPUS.Item.ConditionCategories.Combat",
    wound: "CORPUS.Item.ConditionCategories.Wound",
    body: "CORPUS.Item.ConditionCategories.Body",
    cyber: "CORPUS.Item.ConditionCategories.Cyber",
    digital: "CORPUS.Item.ConditionCategories.Digital",
    position: "CORPUS.Item.ConditionCategories.Position"
  }
};
