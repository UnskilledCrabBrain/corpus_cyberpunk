import { CORPUS } from "./config.mjs?v=0.6.37";
import { actorFeatureSchema, prepareActorFeatureData } from "./features/index.mjs?v=0.6.37";
import {
  numberField,
  resourceField,
  signedNumberField,
  valueMapSchema
} from "./fields.mjs?v=0.6.37";

const {
  BooleanField,
  HTMLField,
  NumberField,
  SchemaField,
  StringField
} = foundry.data.fields;

class CorpusActorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      resources: new SchemaField({
        wounds: resourceField({ value: 3, max: 3 }),
        actionPoints: resourceField({ value: 3, max: 3, cap: 4 })
      }),
      ...actorFeatureSchema(),
      attributes: valueMapSchema(CORPUS.attributes, 1),
      skills: valueMapSchema(CORPUS.skills, 0),
      derived: new SchemaField({
        carryWeight: numberField({ initial: 18 }),
        implantSlots: numberField({ initial: 2 }),
        geneticLimit: numberField({ initial: 2 }),
        initiative: numberField({ initial: 1 })
      }),
      biography: new HTMLField({ required: true, blank: true })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const attributes = this.attributes;
    const resources = this.resources;

    this.derived.carryWeight = attributes.physique.value * 8 + 10;
    this.derived.implantSlots = attributes.synchronization.value * 2;
    this.derived.geneticLimit = attributes.resilience.value + attributes.humanity.value;
    this.derived.initiative = attributes.reflexes.value;

    resources.wounds.value = clamp(resources.wounds.value, resources.wounds.min, resources.wounds.max);
    resources.actionPoints.max = clamp(resources.actionPoints.max, 3, 4);
    resources.actionPoints.value = clamp(
      resources.actionPoints.value,
      resources.actionPoints.min,
      resources.actionPoints.max
    );

    prepareActorFeatureData(this);
  }
}

export class CharacterDataModel extends CorpusActorDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      concept: new StringField({ required: true, blank: true }),
      origin: new StringField({ required: true, blank: true }),
      faction: new StringField({ required: true, blank: true }),
      gender: new StringField({ required: true, blank: true }),
      age: new StringField({ required: true, blank: true }),
      height: new StringField({ required: true, blank: true }),
      contacts: new StringField({ required: true, blank: true }),
      appearance: new StringField({ required: true, blank: true }),
      creation: new SchemaField({
        mode: new StringField({ required: true, blank: false, initial: "standard" }),
        complete: new BooleanField({ required: true, initial: false })
      }),
      currency: new SchemaField({
        credits: numberField({ initial: 0 })
      }),
      advancement: new SchemaField({
        points: numberField({ initial: 0 })
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.resources.wounds.max = this.attributes.resilience.value * 3;
    this.resources.wounds.value = clamp(
      this.resources.wounds.value,
      this.resources.wounds.min,
      this.resources.wounds.max
    );
  }
}

export class NpcDataModel extends CorpusActorDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      resources: new SchemaField({
        wounds: resourceField({ value: 6, max: 6 }),
        actionPoints: resourceField({ value: 3, max: 3, cap: 4 })
      }),
      role: new StringField({ required: true, blank: true }),
      threat: numberField({ initial: 1 }),
      combat: new SchemaField({
        defense: numberField({ initial: 10 }),
        attackBonus: signedNumberField({ initial: 2 })
      })
    };
  }
}

class CorpusItemDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: true, blank: true }),
      tags: new StringField({ required: true, blank: true })
    };
  }
}

export class EquipmentDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: numberField({ initial: 1 }),
      weight: new NumberField({ required: true, min: 0, initial: 0 }),
      equipped: new BooleanField({ required: true, initial: false })
    };
  }
}

export class ConsumableDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: numberField({ initial: 1 }),
      weight: new NumberField({ required: true, min: 0, initial: 0 }),
      actionCost: numberField({ initial: 1, max: 4 })
    };
  }
}

export class AbilityDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      location: new StringField({ required: true, blank: false, initial: "other" }),
      actionCost: numberField({ initial: 1, max: 4 }),
      roll: new StringField({ required: true, blank: true })
    };
  }
}

export class TraitDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      location: new StringField({ required: true, blank: false, initial: "other" }),
      rank: numberField({ initial: 1 })
    };
  }
}

export class WeaponDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      attackMode: new StringField({ required: true, blank: false, initial: "ranged" }),
      damageFormula: new StringField({ required: true, blank: true, initial: "" }),
      // Kept for compatibility with weapons created before formula-based damage.
      damage: numberField({ initial: 1 }),
      damageType: new StringField({ required: true, blank: false, initial: "piercing" }),
      bp: numberField({ initial: 0 }),
      range: new StringField({ required: true, blank: false, initial: "close" }),
      comfortableRange: new StringField({ required: true, blank: true }),
      maximumRange: new StringField({ required: true, blank: true }),
      weightClass: new StringField({ required: true, blank: true }),
      speed: numberField({ initial: 1, min: 1, max: 4 }),
      magazine: new StringField({ required: true, blank: true }),
      actionCost: numberField({ initial: 1, max: 4 }),
      equipped: new BooleanField({ required: true, initial: false })
    };
  }
}

export class ArmorDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      structure: numberField({ initial: 0 }),
      mitigation: numberField({ initial: 0 }),
      weight: new NumberField({ required: true, min: 0, initial: 0 }),
      equipped: new BooleanField({ required: true, initial: false })
    };
  }
}

export class ImplantDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      location: new StringField({ required: true, blank: false, initial: "other" }),
      slotCost: numberField({ initial: 1 }),
      active: new BooleanField({ required: true, initial: false }),
      actionCost: numberField({ initial: 0, max: 4 })
    };
  }
}

export class GeneticDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      location: new StringField({ required: true, blank: false, initial: "other" }),
      limitCost: numberField({ initial: 1 }),
      active: new BooleanField({ required: true, initial: true })
    };
  }
}

export class ConditionDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      category: new StringField({ required: true, blank: false, initial: "physical" }),
      duration: new StringField({ required: true, blank: true }),
      active: new BooleanField({ required: true, initial: true })
    };
  }
}

export class ManeuverDataModel extends CorpusItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      maneuverType: new StringField({ required: true, blank: false, initial: "damage" }),
      actionCost: numberField({ initial: 1, max: 4 }),
      bp: numberField({ initial: 0 }),
      accuracy: numberField({ initial: 0 })
    };
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
