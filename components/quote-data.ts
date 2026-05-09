"use client";

export type QuoteItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  reason: string;
  lineTotal: number;
};

export type QuoteBreakdown = {
  label: string;
  value: string;
};

export type SavedQuote = {
  id: string;
  title: string;
  problemSummary: string;
  diagnosis: string;
  items: QuoteItem[];
  breakdown: QuoteBreakdown[];
  subtotal: number;
  createdAt: string;
  source: "api" | "local";
};

export type Recommendation = Omit<SavedQuote, "id" | "createdAt" | "source">;

const STORAGE_KEY = "qbuild-ai.saved-quotes";

const defaultQuotes: SavedQuote[] = [
  {
    id: "demo-roof-leak",
    title: "Atap bocor 15 m2",
    problemSummary:
      "Atap kamar bocor setelah hujan. Area estimasi 15 m2 dan perlu waterproofing dua lapis.",
    diagnosis:
      "Kemungkinan rembesan pada dak/atap. Prioritas: bersihkan permukaan, tutup retakan dengan membran, lalu aplikasikan pelapis anti bocor dua lapis.",
    items: [
      {
        id: "waterproof-20kg",
        name: "Pelapis Anti Bocor Q-Seal 20 kg",
        category: "Waterproofing",
        quantity: 2,
        unit: "pail",
        unitPrice: 425000,
        lineTotal: 850000,
        reason:
          "Kebutuhan 30 kg dibulatkan menjadi 2 pail agar cukup untuk dua lapis.",
      },
      {
        id: "fiber-membrane",
        name: "Membran Fiber Retakan 10 m",
        category: "Pendukung",
        quantity: 1,
        unit: "roll",
        unitPrice: 15000,
        lineTotal: 15000,
        reason: "Memperkuat sambungan, sudut, dan retakan aktif sebelum coating.",
      },
      {
        id: "paint-roller",
        name: "Roller Aplikasi Waterproofing",
        category: "Alat",
        quantity: 1,
        unit: "pcs",
        unitPrice: 35000,
        lineTotal: 35000,
        reason: "Mempercepat aplikasi lapisan agar rata di area atap.",
      },
    ],
    breakdown: [
      { label: "Area", value: "15 m2" },
      { label: "Kebutuhan", value: "15 x 2 lapis x 1 kg = 30 kg" },
      { label: "Pembulatan", value: "30 kg -> 2 pail @20 kg" },
      { label: "Subtotal", value: "Rp900.000" },
    ],
    subtotal: 900000,
    createdAt: new Date().toISOString(),
    source: "local",
  },
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function isSavedQuote(value: unknown): value is SavedQuote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Partial<SavedQuote>;
  return (
    typeof quote.id === "string" &&
    typeof quote.title === "string" &&
    typeof quote.problemSummary === "string" &&
    typeof quote.diagnosis === "string" &&
    Array.isArray(quote.items) &&
    Array.isArray(quote.breakdown) &&
    typeof quote.subtotal === "number" &&
    typeof quote.createdAt === "string"
  );
}

export function readLocalQuotes(): SavedQuote[] {
  if (typeof window === "undefined") return defaultQuotes;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultQuotes;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultQuotes;
    const quotes = parsed.filter(isSavedQuote);
    return quotes.length > 0 ? quotes : defaultQuotes;
  } catch {
    return defaultQuotes;
  }
}

export function writeLocalQuote(recommendation: Recommendation): SavedQuote {
  const quote: SavedQuote = {
    ...recommendation,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `quote-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: "local",
  };

  const existing = readLocalQuotes().filter((item) => item.id !== quote.id);
  const next = [quote, ...existing].slice(0, 20);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return quote;
}

export async function loadQuotes(): Promise<SavedQuote[]> {
  try {
    const response = await fetch("/api/quotes", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      const quotes = Array.isArray(payload) ? payload : payload.quotes;
      if (Array.isArray(quotes)) {
        return quotes.filter(isSavedQuote).map((quote) => ({
          ...quote,
          source: "api" as const,
        }));
      }
    }
  } catch {
    // Client fallback keeps the demo usable when the API is not available yet.
  }

  return readLocalQuotes();
}

export async function loadQuote(id: string): Promise<SavedQuote | null> {
  try {
    const response = await fetch(`/api/quotes/${id}`, { cache: "no-store" });
    if (response.ok) {
      const quote = await response.json();
      if (isSavedQuote(quote)) return { ...quote, source: "api" };
    }
  } catch {
    // Client fallback keeps the detail route usable for competition demo.
  }

  return readLocalQuotes().find((quote) => quote.id === id) ?? null;
}

export async function saveQuote(
  recommendation: Recommendation,
): Promise<SavedQuote> {
  try {
    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recommendation),
    });

    if (response.ok) {
      const quote = await response.json();
      if (isSavedQuote(quote)) return { ...quote, source: "api" };
    }
  } catch {
    // Fall through to local persistence.
  }

  return writeLocalQuote(recommendation);
}

export function buildRecommendation(prompt: string): Recommendation {
  const normalized = prompt.toLowerCase();
  const isPaint =
    normalized.includes("cat") ||
    normalized.includes("dinding") ||
    normalized.includes("tembok") ||
    normalized.includes("repaint");
  const areaMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(m2|meter|m²)/);
  const area = areaMatch ? Number(areaMatch[1].replace(",", ".")) : isPaint ? 24 : 15;

  if (isPaint) {
    const coats = 2;
    const coverageM2PerKg = 8;
    const requiredKg = Math.ceil((area * coats) / coverageM2PerKg);
    const paintPails = Math.ceil(requiredKg / 5);
    const items: QuoteItem[] = [
      {
        id: "interior-paint-5kg",
        name: "Cat Interior Premium 5 kg",
        category: "Cat tembok",
        quantity: paintPails,
        unit: "pail",
        unitPrice: 185000,
        lineTotal: paintPails * 185000,
        reason:
          "Dipilih untuk pengecatan ulang tembok interior dengan dua lapis.",
      },
      {
        id: "wall-primer-5kg",
        name: "Alkali Primer Tembok 5 kg",
        category: "Primer",
        quantity: 1,
        unit: "pail",
        unitPrice: 145000,
        lineTotal: 145000,
        reason: "Membantu warna akhir rata dan mengunci permukaan dinding.",
      },
      {
        id: "paint-tray-set",
        name: "Set Roller dan Bak Cat",
        category: "Alat",
        quantity: 1,
        unit: "set",
        unitPrice: 55000,
        lineTotal: 55000,
        reason: "Peralatan dasar agar aplikasi cat cepat dan rapi.",
      },
    ];
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return {
      title: `Repaint tembok ${area} m2`,
      problemSummary: `Tembok perlu dicat ulang pada area sekitar ${area} m2.`,
      diagnosis:
        "Permukaan dinding perlu dibersihkan, diberi primer bila belang/lembap ringan, lalu dicat dua lapis.",
      items,
      breakdown: [
        { label: "Area", value: `${area} m2` },
        {
          label: "Kebutuhan cat",
          value: `${area} x ${coats} lapis / ${coverageM2PerKg} m2 per kg = ${requiredKg} kg`,
        },
        { label: "Pembulatan", value: `${requiredKg} kg -> ${paintPails} pail @5 kg` },
        { label: "Subtotal", value: formatCurrency(subtotal) },
      ],
      subtotal,
    };
  }

  const coats = 2;
  const coverageKgPerM2 = 1;
  const requiredKg = Math.ceil(area * coats * coverageKgPerM2);
  const pails = Math.ceil(requiredKg / 20);
  const items: QuoteItem[] = [
    {
      id: "waterproof-20kg",
      name: "Pelapis Anti Bocor Q-Seal 20 kg",
      category: "Waterproofing",
      quantity: pails,
      unit: "pail",
      unitPrice: 425000,
      lineTotal: pails * 425000,
      reason: "Produk utama untuk menutup rembesan atap/dak dua lapis.",
    },
    {
      id: "fiber-membrane",
      name: "Membran Fiber Retakan 10 m",
      category: "Pendukung",
      quantity: 1,
      unit: "roll",
      unitPrice: 15000,
      lineTotal: 15000,
      reason: "Dipakai pada retakan, sudut, dan sambungan sebelum pelapis.",
    },
    {
      id: "paint-roller",
      name: "Roller Aplikasi Waterproofing",
      category: "Alat",
      quantity: 1,
      unit: "pcs",
      unitPrice: 35000,
      lineTotal: 35000,
      reason: "Aplikasi lebih rata dan cepat pada permukaan luas.",
    },
  ];
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    title: `Atap bocor ${area} m2`,
    problemSummary: `Atap atau dak bocor setelah hujan dengan area sekitar ${area} m2.`,
    diagnosis:
      "Masalah paling mungkin adalah rembesan pada dak/atap. Bersihkan area, perbaiki retakan dengan membran, lalu aplikasikan waterproofing dua lapis silang.",
    items,
    breakdown: [
      { label: "Area", value: `${area} m2` },
      {
        label: "Kebutuhan",
        value: `${area} x ${coats} lapis x ${coverageKgPerM2} kg = ${requiredKg} kg`,
      },
      { label: "Pembulatan", value: `${requiredKg} kg -> ${pails} pail @20 kg` },
      { label: "Subtotal", value: formatCurrency(subtotal) },
    ],
    subtotal,
  };
}
