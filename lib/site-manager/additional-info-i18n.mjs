const LABELS = {
  weight: {
    en: "Weight",
    zh: "重量",
    ja: "重量",
  },
  size: {
    en: "Size",
    zh: "规格",
    ja: "サイズ",
  },
  color: {
    en: "Color",
    zh: "颜色",
    ja: "カラー",
  },
};

const VALUES = {
  blue: {
    en: "blue",
    zh: "蓝色",
    ja: "ブルー",
  },
  red: {
    en: "red",
    zh: "红色",
    ja: "レッド",
  },
  green: {
    en: "green",
    zh: "绿色",
    ja: "グリーン",
  },
  orange: {
    en: "orange",
    zh: "橙色",
    ja: "オレンジ",
  },
  black: {
    en: "black",
    zh: "黑色",
    ja: "ブラック",
  },
  white: {
    en: "white",
    zh: "白色",
    ja: "ホワイト",
  },
};

function normalizeKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/^pa_/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function localizeLabel(row, locale) {
  const key = normalizeKey(row.key);
  const label = normalizeKey(row.label);
  const mapped = LABELS[key] || LABELS[label];
  return mapped?.[locale] || row.label;
}

function localizeValuePart(value, locale) {
  const key = normalizeKey(value);
  const mapped = VALUES[key];
  return mapped?.[locale] || value;
}

function localizeValue(value, locale) {
  return String(value || "")
    .split(",")
    .map((part) => {
      const raw = part.trim();
      return localizeValuePart(raw, locale);
    })
    .join(", ");
}

export function localizeAdditionalInfoRow(row, locale) {
  if (locale === "en") {
    return row;
  }
  return {
    ...row,
    label: localizeLabel(row, locale),
    value: localizeValue(row.value, locale),
  };
}
