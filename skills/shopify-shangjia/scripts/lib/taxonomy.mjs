export function classifyTitle(title, categoryRules, defaultKey = "fishingHooks") {
  const t = title.toLowerCase();
  for (const [key, rule] of Object.entries(categoryRules)) {
    if (rule.patterns?.some((p) => t.includes(p.toLowerCase()))) {
      return { key, taxonomyId: rule.taxonomyId, labelZh: rule.labelZh };
    }
  }
  const fallback = categoryRules[defaultKey];
  return { key: defaultKey, taxonomyId: fallback.taxonomyId, labelZh: fallback.labelZh };
}

export function resolveCollection(productType, collections) {
  for (const [name, cfg] of Object.entries(collections)) {
    if (cfg.matchProductTypes?.includes(productType)) return name;
  }
  return Object.keys(collections)[0] ?? "";
}
