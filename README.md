# Corpus

Corpus is a custom game system package for Foundry Virtual Tabletop v13.

## Development Install

Foundry expects a system package folder under:

```text
{userData}/Data/systems/corpus
```

For local development, place or symlink this repository at that path, then start Foundry and create a world using the **Corpus** system.

The folder name must match the manifest id exactly:

```json
"id": "corpus"
```

If the folder is named `Corpus`, `Corpus-main`, or anything other than `corpus`, Foundry can show the system as **Invalid**.

## Current Scope

- Foundry v13 `system.json` manifest.
- Actor types: `character`, `npc`.
- Item types: `equipment`, `consumable`, `ability`, `trait`, `weapon`, `armor`, `implant`, `genetic`, `condition`, `maneuver`.
- System data models for actors and items based on the first Corpus rules files.
- Seven canonical attributes and twenty-one linked skills.
- Dialog-based point-budget character creation with low, standard, and professional starts.
- Advancement-point spending without levels or experience.
- Five generated Item compendiums sourced from the canonical Rules documents.
- Derived values for carry weight, implant slots, genetic limit, wounds, and initiative.
- ApplicationV2 document sheets for actors and items.
- Grouped embedded-item management with equipment controls.
- Separate Inventory, Modifications, Conditions, and Maneuvers actor tabs.
- Melee/ranged weapon attacks, NPC Defense, armor reduction, and confirmed chat damage.
- English and Russian localization.

## Next Design Decisions

- Advancement points and downtime spending workflow.
- Aiming, distance penalties, and maneuver automation.
- Damage-type effects: piercing, slashing, blunt.

See [docs/rules-overview.md](docs/rules-overview.md) for the implemented rules snapshot.

## Rebuilding Compendiums

The LevelDB packs are generated from the sibling `Rules` directory:

```powershell
$env:FOUNDRY_CLASSIC_LEVEL="C:/path/to/Foundry/resources/app/node_modules/classic-level"
node tools/build-compendiums.mjs
```

## Checking Localization

Run this after changing sheets, labels, `system.json`, or language files:

```powershell
node tools/check-localization.mjs
```

The check verifies manifest language entries, Foundry `TYPES.*` labels, and Corpus localization keys used by the system.
