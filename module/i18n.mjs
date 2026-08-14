export function t(key, fallback = key) {
  const localized = globalThis.game?.i18n?.localize?.(key);
  if (typeof localized === "string" && localized !== key && !localized.startsWith("CORPUS.")) {
    return localized;
  }

  return fallbackText(fallback, key);
}

export function fallbackText(fallback = "", defaultText = "") {
  if (typeof fallback === "string") return fallback || defaultText;
  if (!fallback || typeof fallback !== "object") return defaultText;

  const lang = globalThis.game?.i18n?.lang ?? "en";
  return fallback[lang] ?? fallback.en ?? Object.values(fallback)[0] ?? defaultText;
}
