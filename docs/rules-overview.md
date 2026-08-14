# Corpus Rules Overview

This implementation currently follows:

- `ЯДРО СИСТЕМЫ 1.1_обновлено.txt`
- `Характеристики_и_навыки_канон_1.3.txt`

## Core Roll Logic

Active trained action:

```text
1d10 + Skill + floor(Attribute / 2) + Modifiers
```

Passive check or resistance:

```text
1d10 + Attribute + Modifiers
```

Passive check with a clearly relevant skill:

```text
1d10 + Attribute + floor(Skill / 2) + Modifiers
```

## Attributes

- Physique
- Reflexes
- Reason
- Synchronization
- Influence
- Resilience
- Humanity

## Skills

Each attribute has three linked skills.

- Physique: Melee, Athletics, Load
- Reflexes: Shooting, Evasion, Piloting
- Reason: Cyberhacking, Technology, Analysis
- Synchronization: Implants, Technoadaptation, Cyberlink
- Influence: Persuasion, Deception, Intimidation
- Resilience: Will, Endurance, Resistance
- Humanity: Empathy, First Aid, Trust

## Derived Parameters

- Carry weight: `Physique * 8 + 10 kg`
- Implant slots: `Synchronization * 2`
- Genetic limit: `Resilience + Humanity`
- Wounds: `Resilience * 3`
- Initiative: `1d10 + Reflexes + modifiers`

## Combat Automation

The system currently supports:

- Action Points: base 3, maximum 4 with bonuses
- melee/ranged weapon attack rolls and formula-based damage
- NPC Defense and direct NPC attack bonuses
- armor Structure, Mitigation, and BP reduction
- confirmed damage application from chat
- implants and slot cost
- maneuvers by type

Detailed automation for Action Points, aiming, distance, damage-type effects, and maneuver resolution is still pending.
