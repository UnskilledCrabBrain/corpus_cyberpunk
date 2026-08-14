import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULES = path.resolve(ROOT, "..", "Rules");
const PACKS = path.join(ROOT, "packs");
const CLASSIC_LEVEL = process.env.FOUNDRY_CLASSIC_LEVEL
  ?? "E:/FVT/Foundry Virtual Tabletop/resources/app/node_modules/classic-level";
const { ClassicLevel } = require(CLASSIC_LEVEL);

const SOURCE = {
  weapons: "Список оружия и гранат — канон 1.3",
  armor: "Броня и укрытия — канон 1.2",
  implants: "Импланты — канон 1.3",
  genetics: "Генетика — канон 1.3",
  maneuvers: "Манёвры — канон 1.4"
};

const files = {
  weapons: "Список_оружия_и_гранат_канон_1.3.txt",
  armor: "Броня_и_укрытия_канон_1.2.txt",
  implants: "Импланты_канон_1.3_простые_карточки.txt",
  genetics: "Генетика_канон_1.3_простые_карточки.txt",
  maneuvers: "Манёвры_канон_1.4.txt"
};

const texts = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, filename]) => [
  key,
  await fs.readFile(path.join(RULES, filename), "utf8")
])));

const packs = {
  "corpus-weapons": parseWeapons(texts.weapons),
  "corpus-armor": parseArmor(texts.armor),
  "corpus-implants": parseSimpleCards(texts.implants, {
    pack: "corpus-implants",
    type: "implant",
    source: SOURCE.implants,
    img: "icons/commodities/tech/cog-brass.webp",
    costLabel: "Слоты",
    costField: "slotCost"
  }),
  "corpus-genetics": parseSimpleCards(texts.genetics, {
    pack: "corpus-genetics",
    type: "genetic",
    source: SOURCE.genetics,
    img: "icons/magic/life/heart-cross-strong-flame-green.webp",
    costLabel: "Лимит",
    costField: "limitCost"
  }),
  "corpus-maneuvers": parseManeuvers(texts.maneuvers)
};

await fs.mkdir(PACKS, { recursive: true });
for (const [pack, items] of Object.entries(packs)) await writePack(pack, items);

console.log(Object.entries(packs).map(([pack, items]) => `${pack}: ${items.length}`).join("\n"));

function parseWeapons(text) {
  const items = [];
  let section = null;

  for (const line of lines(text)) {
    if (line.startsWith("2. ОГНЕСТРЕЛЬНОЕ")) section = "ranged";
    else if (line.startsWith("4. БЛИЖНЕЕ")) section = "melee";
    else if (line.startsWith("6. ГРАНАТЫ")) section = "grenade";
    if (!line.startsWith("|")) continue;

    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (!cells.length || cells[0] === "Оружие" || cells[0] === "Тип гранаты" || /^-+$/.test(cells[0])) continue;

    if (section === "ranged" && cells.length === 9) {
      const [name, comfortableRange, maximumRange, damage, weightClass, speed, magazine, bp, properties] = cells;
      const system = baseSystem([
        `Комфортная дистанция: ${comfortableRange}`,
        `Максимальная дистанция: ${maximumRange}`,
        `Урон: ${damage}`,
        `Вес: ${weightClass}`,
        `Скорость: ${speed}`,
        `Магазин/барабан: ${magazine}`,
        `BP: ${bp}`,
        `Свойства: ${properties}`
      ], SOURCE.weapons, `огнестрельное; ${weightClass}; ${properties}`);
      Object.assign(system, {
        attackMode: "ranged",
        damageFormula: diceFormula(damage),
        damage: 0,
        damageType: "piercing",
        bp: number(bp),
        range: rangeCategory(maximumRange),
        comfortableRange,
        maximumRange,
        weightClass,
        speed: number(speed, 1),
        magazine,
        actionCost: 1,
        equipped: false
      });
      items.push(item("corpus-weapons", name, "weapon", "icons/weapons/guns/gun-pistol-brass.webp", system));
    }

    else if (section === "melee" && cells.length === 7) {
      const [name, damage, weightClass, speed, baseBp, damageType, properties] = cells;
      const finalBp = Math.min(5, number(baseBp) + 1);
      const system = baseSystem([
        `Урон: ${damage}`,
        `Вес: ${weightClass}`,
        `Скорость: ${speed}`,
        `Базовый BP: ${baseBp}; итоговый BP с бонусом ближнего боя: ${finalBp}`,
        `Тип урона: ${damageType}`,
        `Свойства: ${properties}`
      ], SOURCE.weapons, `ближнее; ${weightClass}; ${damageType}; ${properties}`);
      Object.assign(system, {
        attackMode: "melee",
        damageFormula: diceFormula(damage),
        damage: 0,
        damageType: damageTypeId(damageType),
        bp: finalBp,
        range: "close",
        comfortableRange: "ближний бой",
        maximumRange: "ближний бой",
        weightClass,
        speed: number(speed, 1),
        magazine: "",
        actionCost: 1,
        equipped: false
      });
      items.push(item("corpus-weapons", name, "weapon", "icons/weapons/swords/sword-guard-bronze.webp", system));
    }

    else if (section === "grenade" && cells.length === 4) {
      const [name, distance, radius, effect] = cells;
      const system = baseSystem([
        `Дальность броска: ${distance}`,
        `Радиус: ${radius}`,
        `Эффект: ${effect}`
      ], SOURCE.weapons, `граната; радиус ${radius}`);
      Object.assign(system, { quantity: 1, weight: 0, actionCost: 1 });
      items.push(item("corpus-weapons", name, "consumable", "icons/weapons/thrown/bomb-fuse-black-grey.webp", system));
    }
  }
  return items;
}

function parseArmor(text) {
  const sourceLines = lines(text);
  const start = sourceLines.findIndex((line) => line.startsWith("4. СПРАВОЧНИК БРОНЕКОМПЛЕКТОВ"));
  const end = sourceLines.findIndex((line) => line.startsWith("5. МОДУЛИ БРОНИ"));
  const items = [];

  for (let index = start; index < end; index++) {
    const name = sourceLines[index];
    if (!name || !sourceLines[index + 1]?.startsWith("- Категория:")) continue;
    const details = [];
    for (let cursor = index + 1; cursor < end && sourceLines[cursor].startsWith("- "); cursor++) {
      details.push(sourceLines[cursor].slice(2));
    }
    const category = field(details, "Категория");
    const protection = field(details, "Защита");
    const structure = number(protection.match(/С\s*(\d+)/i)?.[1]);
    const mitigation = number(protection.match(/См\s*(\d+)/i)?.[1]);
    const system = baseSystem(details, SOURCE.armor, `броня; ${category}`);
    Object.assign(system, { structure, mitigation, weight: 0, equipped: false });
    items.push(item("corpus-armor", name, "armor", "icons/equipment/chest/breastplate-layered-leather-brown.webp", system));
  }
  return items;
}

function parseSimpleCards(text, options) {
  return cardBlocks(text).map(({ name, body }) => {
    const costLine = body.find((line) => line.startsWith(`${options.costLabel}:`)) ?? "";
    const typeLine = body.find((line) => line.startsWith("Тип:")) ?? "";
    const categoryLine = body.find((line) => line.startsWith("Категория:")) ?? "";
    const system = baseSystem(body, options.source, `${typeLine.replace("Тип:", "").trim()}; ${categoryLine.replace("Категория:", "").trim()}`);
    system[options.costField] = number(costLine.match(/\d+/)?.[0]);
    system.active = options.type === "genetic";
    if (options.type === "implant") system.actionCost = 0;
    return item(options.pack, name, options.type, options.img, system);
  });
}

function parseManeuvers(text) {
  const names = [
    "Первая помощь в бою",
    "Медпомощь в бою",
    "Прицеливание",
    "Стрельба в движении",
    "Выстрел из укрытия",
    "Быстрая перезарядка",
    "Сильный удар",
    "Прицельный укол",
    "Захват",
    "Подножка",
    "Толчок"
  ];
  return namedBlocks(text, names).map(({ name, body }) => {
    const joined = body.join(" ");
    const actionCost = name === "Стрельба в движении"
      ? 0
      : number(joined.match(/Стоимость:\s*(\d+)\s*ОД/i)?.[1]
        ?? joined.match(/(\d+)\s*ОД/i)?.[1], 1);
    const bp = number(joined.match(/\+(\d+)\s*BP/i)?.[1]);
    const accuracyMatch = joined.match(/([+–—-])\s*(\d+)\s*к\s*попаданию/i);
    const accuracy = accuracyMatch ? number(accuracyMatch[2]) * (accuracyMatch[1] === "+" ? 1 : -1) : 0;
    const system = baseSystem(body, SOURCE.maneuvers, "манёвр");
    Object.assign(system, {
      maneuverType: maneuverType(name, joined, bp, accuracy),
      actionCost,
      bp,
      accuracy
    });
    return item("corpus-maneuvers", name, "maneuver", "icons/skills/melee/sword-stuck-glowing-pink.webp", system);
  });
}

function namedBlocks(text, names) {
  const sourceLines = lines(text);
  const starts = sourceLines
    .map((line, index) => names.includes(line) ? index : -1)
    .filter((index) => index >= 0);
  return starts.map((start, index) => {
    const next = starts[index + 1] ?? sourceLines.length;
    let body = sourceLines.slice(start + 1, next);
    const nextSection = body.findIndex((line) => /^\d+\.\s/.test(line));
    if (nextSection >= 0) body = body.slice(0, nextSection);
    while (!body.at(-1)) body.pop();
    return { name: sourceLines[start], body };
  });
}

function cardBlocks(text) {
  const sourceLines = lines(text);
  const starts = [];
  for (let i = 0; i < sourceLines.length - 1; i++) {
    if (!sourceLines[i] || /^\d+\./.test(sourceLines[i])) continue;
    if (/^-{3,}$/.test(sourceLines[i + 1])) starts.push(i);
  }
  return starts.map((start, index) => {
    const next = starts[index + 1] ?? sourceLines.length;
    let body = sourceLines.slice(start + 2, next);
    const nextSection = body.findIndex((line) => /^\d+\.\s/.test(line));
    if (nextSection >= 0) body = body.slice(0, nextSection);
    while (!body.at(-1)) body.pop();
    return { name: sourceLines[start], body };
  });
}

function baseSystem(details, source, tags) {
  return {
    description: detailsHtml(details, source),
    tags: tags.split(";").map((tag) => tag.trim()).filter(Boolean).join(", ")
  };
}

function item(pack, name, type, img, system) {
  const _id = id(`${pack}:${name}`);
  return {
    _id,
    name,
    type,
    img,
    system,
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: { corpus: { source: true } },
    _stats: {
      duplicateSource: null,
      coreVersion: "13.351",
      systemId: "corpus",
      systemVersion: "0.6.0",
      createdTime: 1783555200000,
      modifiedTime: 1783555200000,
      lastModifiedBy: null,
      exportSource: null
    }
  };
}

async function writePack(name, items) {
  const directory = path.join(PACKS, name);
  if (!path.resolve(directory).startsWith(path.resolve(PACKS) + path.sep)) throw new Error(`Unsafe pack path: ${directory}`);
  await fs.rm(directory, { recursive: true, force: true });
  const db = new ClassicLevel(directory, { valueEncoding: "json" });
  await db.open();
  await db.batch(items.map((document) => ({
    type: "put",
    key: `!items!${document._id}`,
    value: document
  })));
  await db.close();
}

function detailsHtml(details, source) {
  const rows = details.filter(Boolean).map((line) => `<li>${escapeHtml(line.replace(/^-\s*/, ""))}</li>`).join("");
  return `<p><strong>Источник:</strong> ${escapeHtml(source)}</p><ul>${rows}</ul>`;
}

function lines(text) {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim());
}

function field(details, label) {
  return details.find((line) => line.startsWith(`${label}:`))?.slice(label.length + 1).trim() ?? "";
}

function number(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function diceFormula(value) {
  return value.toLowerCase().replaceAll("к", "d").replaceAll(" ", "");
}

function damageTypeId(value) {
  const text = value.toLowerCase();
  if (text.includes("реж")) return "slashing";
  if (text.includes("дроб")) return "blunt";
  return "piercing";
}

function rangeCategory(value) {
  const distances = value.match(/\d+/g)?.map(Number) ?? [0];
  const maximum = Math.max(...distances);
  if (maximum <= 12) return "close";
  if (maximum <= 35) return "medium";
  return "far";
}

function maneuverType(name, text, bp, accuracy) {
  if (/Захват|Подножка|Толчок/i.test(name)) return "control";
  if (/укрыт|движен|перезаряд/i.test(text)) return "position";
  if (bp > 0) return "penetration";
  if (accuracy !== 0 || /прицел/i.test(text)) return "accuracy";
  return "damage";
}

function id(value) {
  return crypto.createHash("sha256").update(value).digest("base64url").slice(0, 16);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
