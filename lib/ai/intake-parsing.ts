export function normalizeText(value: string) {
  return value.toLowerCase();
}

const numberWords: Record<string, number> = {
  nol: 0,
  setengah: 0.5,
  separuh: 0.5,
  seperempat: 0.25,
  satu: 1,
  se: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  "dua belas": 12,
  "tiga belas": 13,
  "empat belas": 14,
  "lima belas": 15,
  "enam belas": 16,
  "tujuh belas": 17,
  "delapan belas": 18,
  "sembilan belas": 19,
  "dua puluh": 20,
};

const knownColors = [
  "putih tulang",
  "abu-abu",
  "abu abu",
  "broken white",
  "off white",
  "krem",
  "cream",
  "beige",
  "putih",
  "hitam",
  "merah",
  "biru",
  "hijau",
  "kuning",
  "coklat",
  "brown",
  "orange",
  "oranye",
  "pink",
  "ungu",
  "navy",
  "tosca",
  "teal",
  "gold",
  "silver",
];

export function parseIndonesianNumber(value: string): number | null {
  const normalized = normalizeText(value).replace(",", ".").trim();
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  if (normalized in numberWords) return numberWords[normalized];

  const mixedFraction = normalized.match(/^(.+?)\s+(setengah|separuh|seperempat)$/);
  if (mixedFraction) {
    const base = parseIndonesianNumber(mixedFraction[1]);
    const fraction = numberWords[mixedFraction[2]];
    return base && fraction ? base + fraction : null;
  }

  return null;
}

export function extractMeasure(text: string, unitPattern: string) {
  const normalized = normalizeText(text);
  const numericPattern = new RegExp(
    `\\b(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})\\b`,
    "i",
  );
  const numericMatch = normalized.match(numericPattern);
  if (numericMatch) return Number(numericMatch[1].replace(",", "."));

  const wordPattern = new RegExp(
    `\\b((?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas|tiga belas|empat belas|lima belas|enam belas|tujuh belas|delapan belas|sembilan belas|dua puluh)(?:\\s+(?:setengah|separuh|seperempat))?|setengah|separuh|seperempat)\\s+(${unitPattern})\\b`,
    "i",
  );
  const wordMatch = normalized.match(wordPattern);
  return wordMatch ? parseIndonesianNumber(wordMatch[1]) : null;
}

export function extractAreaM2(text: string) {
  return extractMeasure(text, "m2|m²|meter persegi");
}

export function extractAreaM2FromClarification(
  previousQuestion: string,
  currentReply: string,
) {
  const question = normalizeText(previousQuestion);
  if (
    !/\b(luas|area|terdampak|dikerjakan)\b/i.test(question) ||
    /\b(pipa|sambungan)\b/i.test(question)
  ) {
    return null;
  }

  const explicitArea = extractAreaM2(currentReply);
  if (explicitArea) return explicitArea;

  const reply = normalizeText(currentReply).trim();
  const ambiguousMeter = extractMeasure(reply, "meter|m");
  if (ambiguousMeter) return ambiguousMeter;

  if (/^(?:sekitar|kurang lebih|kira-kira)?\s*[a-z0-9,. -]+\s*$/i.test(reply)) {
    return parseIndonesianNumber(
      reply.replace(/^(sekitar|kurang lebih|kira-kira)\s+/i, ""),
    );
  }

  return null;
}

export function extractLengthM(text: string) {
  return extractMeasure(text, "meter|m");
}

export function extractColor(text: string) {
  const normalized = normalizeText(text);
  const explicit = normalized.match(
    /\b(?:warna|cat warna|mau warna|ingin warna)\s+([a-z -]{3,24})\b/i,
  );
  if (explicit) {
    const value = explicit[1].trim();
    const matched = knownColors.find((color) => value.includes(color));
    return matched ?? value.split(/\s+/).slice(0, 2).join(" ");
  }

  return knownColors.find((color) => normalized.includes(color)) ?? null;
}
