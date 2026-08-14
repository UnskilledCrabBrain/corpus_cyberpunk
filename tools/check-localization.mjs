import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = readJson("system.json");
const LANG_FILES = Object.fromEntries(
  [...new Set(MANIFEST.languages.map((language) => language.path))]
    .map((file) => [file, readJson(file)])
);
const REQUIRED_LANGS = ["en", "ru", "ru-RU"];
const REQUIRED_KEYS = new Set([
  "CORPUS.Common.Name",
  "CORPUS.Actor.Types.character",
  "CORPUS.Actor.Types.npc",
  "TYPES.Actor.character",
  "TYPES.Actor.npc"
]);
const problems = [];

for (const lang of REQUIRED_LANGS) {
  const entry = MANIFEST.languages.find((language) => language.lang === lang);
  if (!entry) {
    problems.push(`system.json is missing language entry: ${lang}`);
    continue;
  }
  if (!LANG_FILES[entry.path]) problems.push(`Language file is missing or invalid: ${entry.path}`);
}

collectManifestKeys();
collectSourceKeys();

for (const [file, translations] of Object.entries(LANG_FILES)) {
  for (const key of [...REQUIRED_KEYS].sort()) {
    if (!(key in translations)) problems.push(`${file} is missing key: ${key}`);
  }
}

if (problems.length) {
  console.error("Corpus localization check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Corpus localization check passed: ${REQUIRED_KEYS.size} required keys, ${Object.keys(LANG_FILES).length} files.`);

function collectManifestKeys() {
  for (const actorType of Object.keys(MANIFEST.documentTypes?.Actor ?? {})) {
    REQUIRED_KEYS.add(`TYPES.Actor.${actorType}`);
    REQUIRED_KEYS.add(`CORPUS.Actor.Types.${actorType}`);
  }

  for (const itemType of Object.keys(MANIFEST.documentTypes?.Item ?? {})) {
    REQUIRED_KEYS.add(`TYPES.Item.${itemType}`);
    REQUIRED_KEYS.add(`CORPUS.Item.Types.${itemType}`);
  }
}

function collectSourceKeys() {
  for (const file of sourceFiles(["module", "templates"])) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    const patterns = [
      /game\.i18n\.(?:localize|format)\(\s*["']([^"']+)["']/g,
      /\{\{localize\s+["']([^"']+)["']/g,
      /localizeLabel\(\s*["']([^"']+)["']/g,
      /hudStat\(\s*["']([^"']+)["']/g,
      /t\(\s*["']([^"']+)["']/g
    ];

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const key = match[1];
        if (/^(CORPUS|TYPES)\./.test(key)) REQUIRED_KEYS.add(key);
      }
    }
  }
}

function sourceFiles(directories) {
  const files = [];
  for (const directory of directories) walk(directory, files);
  return files.filter((file) => /\.(mjs|hbs)$/i.test(file));
}

function walk(relativeDirectory, files) {
  for (const entry of fs.readdirSync(path.join(ROOT, relativeDirectory), { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) walk(relativePath, files);
    else files.push(relativePath);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
}
