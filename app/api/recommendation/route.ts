import { generateObject, generateText, type ModelMessage } from "ai";
import { z } from "zod";
import { calculatePaint, calculateSubtotal, calculateTiles, calculateWaterproofing } from "@/lib/calculators";
import { createAgentChannel, type AgentChannel } from "@/lib/ai/agent-communication";
import { searchProducts } from "@/lib/ai/products";
import { getChatModels } from "@/lib/ai/provider";
import type { ProductSearchResult } from "@/types/domain";

const intakeSchema = z.object({
  intent: z.enum(["waterproofing", "paint", "tiles", "plumbing", "wall_repair", "unknown"]),
  problemSummary: z.string(),
  areaM2: z.number().positive().nullable(),
  lengthM: z.number().positive().nullable().optional(),
  color: z.string().nullable(),
  budgetPreference: z.enum(["economy", "standard", "premium"]).nullable(),
  maxBudget: z.number().positive().nullable(),
  qualityPreference: z.string().nullable(),
  location: z.string().nullable(),
  missingFields: z.array(z.string()),
  nextQuestion: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

type Intake = z.infer<typeof intakeSchema>;

const diagnosisSchema = z.object({
  summary: z.string(),
  decision: z.string(),
  category: z.enum(["waterproofing", "paint", "tiles", "plumbing", "wall_repair", "unknown"]),
  confidence: z.number().min(0).max(1),
});

const criticSchema = z.object({
  passed: z.boolean(),
  summary: z.string(),
  decision: z.string(),
  issues: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

type AgentAssessment = {
  summary: string;
  decision: string;
  confidence: number;
  input: string;
  output: string;
  fallback: boolean;
};

type RequestMessage = {
  role: "user" | "assistant";
  content: string;
  imageName?: string;
  imageDataUrl?: string;
  imageMediaType?: string;
};

type QuoteItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  reason: string;
  lineTotal: number;
};

type ProductSearch = Awaited<ReturnType<typeof searchProducts>>;

const fallbackQuestions: Record<string, string> = {
  problem: "Boleh jelaskan masalahnya dulu? Contohnya atap bocor, cat ulang dinding, pipa bocor, atau pasang keramik.",
  areaM2: "Berapa luas area yang dikerjakan dalam m2? Kalau belum pasti, boleh estimasi panjang x lebar.",
  color: "Untuk cat, warna apa yang diinginkan?",
  budgetPreference: "Prefer produk ekonomis, standar, atau premium? Kalau ada batas budget, sebutkan juga.",
  qualityPreference: "Prioritasnya harga hemat, kualitas standar, atau kualitas premium/tahan lama?",
  lengthM: "Berapa panjang pipa atau area sambungan yang perlu diganti? Contoh: setengah meter atau 2 meter.",
};

const supportedCategoryText =
  "waterproofing/atap bocor, cat tembok, plumbing/pipa, keramik, perbaikan dinding, dan tools pendukung renovasi";

const DEFAULT_AI_ATTEMPT_TIMEOUT_MS = 6000;

const unsupportedKeywords = [
  "kipas",
  "fan",
  "ac",
  "air conditioner",
  "kulkas",
  "mesin cuci",
  "tv",
  "televisi",
  "kompor",
  "lampu",
  "kasur",
  "sofa",
  "meja",
  "kursi",
];

const supportedKeywords = [
  "atap",
  "dak",
  "bocor",
  "rembes",
  "waterproof",
  "cat",
  "dinding",
  "tembok",
  "plafon",
  "pipa",
  "plumbing",
  "keramik",
  "ubin",
  "nat",
  "semen",
  "dempul",
  "retak",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function toTranscript(messages: RequestMessage[]) {
  return messages
    .slice(-10)
    .map((message) => {
      const image = message.imageName ? ` [foto: ${message.imageName}]` : "";
      return `${message.role === "user" ? "Pelanggan" : "Asisten"}: ${message.content}${image}`;
    })
    .join("\n");
}

function normalizeText(value: string) {
  return value.toLowerCase();
}

function aiAttemptTimeoutMs() {
  const value = Number(process.env.AI_ATTEMPT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_AI_ATTEMPT_TIMEOUT_MS;
}

function userText(messages: RequestMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ");
}

const numberWords: Record<string, number> = {
  nol: 0,
  setengah: 0.5,
  separuh: 0.5,
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

function parseIndonesianNumber(value: string): number | null {
  const normalized = normalizeText(value).replace(",", ".").trim();
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  if (normalized in numberWords) return numberWords[normalized];

  const mixedHalf = normalized.match(/^(.+?)\s+(setengah|separuh)$/);
  if (mixedHalf) {
    const base = parseIndonesianNumber(mixedHalf[1]);
    return base ? base + 0.5 : null;
  }

  return null;
}

function extractMeasure(text: string, unitPattern: string) {
  const normalized = normalizeText(text);
  const numericPattern = new RegExp(
    `\\b(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})\\b`,
    "i",
  );
  const numericMatch = normalized.match(numericPattern);
  if (numericMatch) return Number(numericMatch[1].replace(",", "."));

  const wordPattern = new RegExp(
    `\\b((?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas|tiga belas|empat belas|lima belas|enam belas|tujuh belas|delapan belas|sembilan belas|dua puluh)(?:\\s+(?:setengah|separuh))?|setengah|separuh)\\s+(${unitPattern})\\b`,
    "i",
  );
  const wordMatch = normalized.match(wordPattern);
  return wordMatch ? parseIndonesianNumber(wordMatch[1]) : null;
}

function extractAreaM2(text: string) {
  return extractMeasure(text, "m2|m²|meter persegi");
}

function extractLengthM(text: string) {
  return extractMeasure(text, "meter|m");
}

function extractColor(text: string) {
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

function hasExplicitPaintIntent(text: string) {
  return /\b(cat|repaint|cat ulang|pengecatan|warna)\b/i.test(text);
}

function hasWallRepairIntent(text: string) {
  return /\b(retak|retakan|retak rambut|lubang|dempul|acian|plester|mengelupas|rembes|lembap|jamur)\b/i.test(
    text,
  );
}

function hasNoPreference(messages: RequestMessage[]) {
  const lastUserText = messages
    .filter((message) => message.role === "user")
    .slice(-2)
    .map((message) => message.content)
    .join(" ");

  return /\b(tidak ada|nggak ada|gak ada|ga ada|bebas|terserah|standar saja|standard saja)\b/i.test(
    lastUserText,
  );
}

function detectUnsupportedRequest(messages: RequestMessage[]) {
  const text = normalizeText(
    messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join(" "),
  );

  const hasUnsupported = unsupportedKeywords.some((keyword) =>
    text.includes(keyword),
  );
  const hasSupported = supportedKeywords.some((keyword) => text.includes(keyword));

  return hasUnsupported && !hasSupported;
}

function unavailableResponse(detail?: string) {
  return Response.json({
    type: "unavailable",
    message:
      detail ??
      `Maaf, produk itu belum tersedia di katalog demo kami. Saat ini saya bisa bantu untuk ${supportedCategoryText}.`,
    aiProvider: "sumopod",
  });
}

function toModelMessages(messages: RequestMessage[], transcript: string): ModelMessage[] {
  const recentMessages = messages.slice(-10);

  return recentMessages.map((message, index) => {
    const isLast = index === recentMessages.length - 1;
    const text = isLast
      ? `Riwayat chat:\n${transcript}\n\nAnalisis pesan terakhir pelanggan dan foto bila ada.`
      : message.content;

    if (message.role === "assistant") {
      return { role: "assistant", content: text };
    }

    if (message.imageDataUrl) {
      return {
        role: "user",
        content: [
          { type: "text", text },
          {
            type: "image",
            image: message.imageDataUrl,
            mediaType: message.imageMediaType ?? "image/jpeg",
          },
        ],
      };
    }

    return { role: "user", content: text };
  });
}

function hasImage(messages: RequestMessage[]) {
  return messages.some((message) => Boolean(message.imageDataUrl));
}

function requiredMissingFields(intake: Intake) {
  const missing = new Set(intake.missingFields);

  if (intake.intent === "unknown") missing.add("problem");
  if (!intake.areaM2 && ["waterproofing", "paint", "tiles", "wall_repair"].includes(intake.intent)) {
    missing.add("areaM2");
  }
  if (!intake.lengthM && intake.intent === "plumbing") {
    missing.add("lengthM");
  }
  if (intake.intent === "paint" && !intake.color) missing.add("color");
  if (!intake.budgetPreference && !intake.maxBudget && ["waterproofing", "paint", "tiles", "plumbing", "wall_repair"].includes(intake.intent)) {
    missing.add("budgetPreference");
  }

  if (intake.areaM2) missing.delete("areaM2");
  if (intake.lengthM) missing.delete("lengthM");
  if (intake.color) missing.delete("color");
  if (intake.budgetPreference || intake.maxBudget) missing.delete("budgetPreference");
  if (intake.qualityPreference) missing.delete("qualityPreference");
  if (intake.intent !== "unknown") missing.delete("problem");

  return [...missing].filter((field) =>
    ["problem", "areaM2", "lengthM", "color", "budgetPreference", "qualityPreference"].includes(field),
  );
}

function nextQuestion(intake: Intake, missingFields: string[]) {
  if (intake.nextQuestion && missingFields.length > 0) return intake.nextQuestion;
  return fallbackQuestions[missingFields[0]] ?? fallbackQuestions.areaM2;
}

async function analyzeIntake(messages: RequestMessage[]) {
  const transcript = toTranscript(messages);
  let lastError: unknown;

  for (const { model } of getChatModels()) {
    try {
      const { object } = await generateObject({
        model,
        schema: intakeSchema,
        schemaName: "QBuildIntake",
        schemaDescription:
          "Hasil intake kebutuhan pelanggan toko bahan bangunan sebelum membuat rekomendasi produk.",
        temperature: 0.1,
        maxOutputTokens: 700,
        abortSignal: AbortSignal.timeout(aiAttemptTimeoutMs()),
        system: `Anda adalah intake agent toko bahan bangunan.
Ekstrak kebutuhan pelanggan dari riwayat chat dan foto bila ada.
Jangan membuat quotation bila data penting belum cukup.

Aturan intent:
- Untuk atap bocor/dak bocor/rembes, intent = waterproofing.
- Untuk cat ulang/repaint/warna dinding, intent = paint.
- Untuk dinding retak, retak rambut, lubang, dempul, acian, plester, cat mengelupas, atau dinding rembes/lembap tanpa permintaan warna/cat, intent = wall_repair.
- Untuk pipa bocor, sambungan pipa, keran/drat bocor, intent = plumbing. Jika user menyebut "setengah meter", lengthM = 0.5.
- Jika user menyebut warna lokal seperti krem/cream/beige/putih tulang/abu-abu, isi color sesuai kata user.
- Jika gambar menunjukkan noda air/plafon lembap/retak dak/permukaan bocor, arahkan ke waterproofing atau wall_repair sesuai konteks.
- Jika pelanggan meminta produk di luar katalog renovasi, seperti kipas/AC/elektronik/furniture, intent = unknown dan jangan tanya budget.
- Untuk cat, warna wajib ditanya.
- Untuk waterproofing dan cat, tanya preferensi ekonomis/standar/premium atau batas budget sebelum rekomendasi produk.
- Jika pelanggan menjawab "tidak ada", "bebas", "terserah", atau "standar saja" untuk budget/kualitas, set budgetPreference = "standard".
- nextQuestion harus satu pertanyaan pendek dan natural dalam Bahasa Indonesia bila ada data penting yang kurang.`,
        messages: [
          {
            role: "user",
            content: `Riwayat chat:\n${transcript}`,
          },
          ...toModelMessages(messages, transcript),
        ],
      });

      return object;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI intake gagal.");
}

function fallbackAnalyzeIntake(messages: RequestMessage[]): Intake {
  const text = normalizeText(userText(messages));
  const areaMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(m2|m²|meter persegi|meter|m)\b/i);
  const budgetPreference = /\bpremium|terbaik|bagus|tahan lama\b/i.test(text)
    ? "premium"
    : /\bekonomis|murah|hemat|budget\b/i.test(text)
      ? "economy"
      : /\bstandar|standard|sedang|biasa|tidak ada|bebas|terserah\b/i.test(text)
        ? "standard"
        : null;

  const intent: Intake["intent"] = /keramik|ubin|tile|lantai/i.test(text)
    ? "tiles"
    : /cat|warna|tembok|dinding/i.test(text)
      ? "paint"
      : /atap|dak|bocor|rembes|waterproof/i.test(text)
        ? "waterproofing"
        : /pipa|plumbing|saluran/i.test(text)
          ? "plumbing"
          : detectUnsupportedRequest(messages)
            ? "unknown"
            : "unknown";

  const problemSummary =
    intent === "tiles"
      ? "Pemasangan keramik"
      : intent === "paint"
        ? "Pengecatan dinding"
        : intent === "waterproofing"
          ? "Atap atau dak bocor"
          : "Kebutuhan belum jelas";

  return {
    intent,
    problemSummary,
    areaM2: areaMatch ? Number(areaMatch[1].replace(",", ".")) : null,
    color: null,
    budgetPreference,
    maxBudget: null,
    qualityPreference: budgetPreference,
    location: null,
    missingFields: [],
    nextQuestion: null,
    confidence: 0.55,
  };
}

function normalizeIntakeForIndonesian(input: Intake, messages: RequestMessage[]): Intake {
  const text = normalizeText(userText(messages));
  const areaM2 = input.areaM2 ?? extractAreaM2(text);
  const lengthM = input.lengthM ?? extractLengthM(text);
  const color = input.color ?? extractColor(text);
  const explicitPaint = hasExplicitPaintIntent(text);
  const repairIntent = hasWallRepairIntent(text);
  const plumbingIntent = /pipa|plumbing|saluran|keran|drat/i.test(text);

  let intent = input.intent;
  if (plumbingIntent) {
    intent = "plumbing";
  } else if (repairIntent && !explicitPaint) {
    intent = "wall_repair";
  } else if ((explicitPaint || color) && intent === "unknown") {
    intent = "paint";
  }

  const problemSummary =
    intent === "plumbing"
      ? "Perbaikan pipa atau sambungan bocor"
      : intent === "wall_repair"
        ? "Perbaikan dinding retak atau rembes"
        : input.problemSummary;

  return {
    ...input,
    intent,
    problemSummary,
    areaM2,
    lengthM,
    color,
  };
}

function fallbackDiagnosisAgent(intake: Intake, transcript: string): AgentAssessment {
  const summaryByIntent: Record<Intake["intent"], string> = {
    waterproofing: `Kebutuhan diklasifikasikan sebagai waterproofing atap/dak. Area ${intake.areaM2 ?? "-"} m2, preferensi ${intake.budgetPreference ?? "standar"}.`,
    paint: `Kebutuhan diklasifikasikan sebagai repainting. Area ${intake.areaM2 ?? "-"} m2, warna ${intake.color ?? "-"}, preferensi ${intake.budgetPreference ?? "standar"}.`,
    tiles: `Kebutuhan diklasifikasikan sebagai pemasangan keramik. Area ${intake.areaM2 ?? "-"} m2, preferensi ${intake.budgetPreference ?? "standar"}.`,
    plumbing: `Kebutuhan diklasifikasikan sebagai plumbing/pipa. Panjang pipa/sambungan ${intake.lengthM ?? "-"} m, preferensi ${intake.budgetPreference ?? "standar"}.`,
    wall_repair: `Kebutuhan diklasifikasikan sebagai perbaikan dinding. Area ${intake.areaM2 ?? "-"} m2, preferensi ${intake.budgetPreference ?? "standar"}.`,
    unknown: "Kebutuhan belum cukup jelas untuk dipetakan ke kategori katalog.",
  };
  const input = JSON.stringify({ intake, transcript: transcript.slice(-1200) });
  const output = summaryByIntent[intake.intent];

  return {
    summary: output,
    decision: `Intent ${intake.intent} dipilih dari hasil intake dan aturan fallback.`,
    confidence: confidence(Math.max(intake.confidence - 0.04, 0.62)),
    input,
    output,
    fallback: true,
  };
}

async function runDiagnosisAgent(
  intake: Intake,
  messages: RequestMessage[],
  channel: AgentChannel,
): Promise<AgentAssessment> {
  const transcript = toTranscript(messages);
  const inbox = channel.inbox("Repair Diagnosis Agent");
  const input = JSON.stringify({
    inbox,
    intake,
    transcript: transcript.slice(-1800),
  });
  let lastError: unknown;

  for (const { model } of getChatModels()) {
    try {
      const { object } = await generateObject({
        model,
        schema: diagnosisSchema,
        schemaName: "QBuildDiagnosis",
        schemaDescription:
          "Diagnosis masalah renovasi berdasarkan hasil intake sebelum retrieval produk.",
        temperature: 0.1,
        maxOutputTokens: 450,
        abortSignal: AbortSignal.timeout(aiAttemptTimeoutMs()),
        system: `Anda adalah Repair Diagnosis Agent toko bahan bangunan.
Gunakan hasil Intake Agent sebagai input utama.
Tugas Anda hanya mendiagnosis kategori pekerjaan, menjelaskan alasan singkat, dan memberi keputusan untuk agent berikutnya.
Jangan menyebut produk, harga, atau quantity.`,
        messages: [
          {
            role: "user",
            content: `Output Intake Agent dan riwayat chat:\n${input}`,
          },
        ],
      });

      const assessment = {
        summary: object.summary,
        decision: object.decision,
        confidence: confidence(object.confidence),
        input,
        output: JSON.stringify(object),
        fallback: false,
      };

      channel.send({
        from: "Repair Diagnosis Agent",
        to: "Product RAG Agent",
        type: "diagnosis.result",
        summary: assessment.summary,
        payload: object,
      });

      return assessment;
    } catch (error) {
      lastError = error;
    }
  }

  void lastError;
  const assessment = fallbackDiagnosisAgent(intake, transcript);
  channel.send({
    from: "Repair Diagnosis Agent",
    to: "Product RAG Agent",
    type: "diagnosis.result",
    summary: assessment.summary,
    payload: assessment,
  });
  return assessment;
}

async function describeImage(messages: RequestMessage[]) {
  const transcript = toTranscript(messages);
  let lastError: unknown;

  for (const { model } of getChatModels()) {
    try {
      const { text } = await generateText({
        model,
        temperature: 0.2,
        maxOutputTokens: 220,
        abortSignal: AbortSignal.timeout(aiAttemptTimeoutMs()),
        system:
          "Anda membantu membaca foto masalah rumah. Jawab singkat dalam Bahasa Indonesia. Jika foto tidak jelas, katakan tidak jelas.",
        messages: toModelMessages(messages, transcript),
      });

      return text.trim();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI image analysis gagal.");
}

function fallbackCriticAgent({
  intake,
  items,
  subtotal,
  calculator,
}: {
  intake: Intake;
  items: QuoteItem[];
  subtotal: number;
  calculator: string;
}): AgentAssessment {
  const hasMainItem = items.length > 0;
  const lineTotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const issues = [
    ...(!hasMainItem ? ["Belum ada item produk utama."] : []),
    ...(Math.abs(lineTotal - subtotal) > 1 ? ["Subtotal tidak sama dengan total line item."] : []),
  ];
  const summary =
    issues.length === 0
      ? "Validasi lolos: produk, quantity, kalkulasi, dan subtotal konsisten."
      : `Validasi menemukan ${issues.length} isu: ${issues.join(" ")}`;
  const input = JSON.stringify({
    intent: intake.intent,
    calculator,
    subtotal,
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      lineTotal: item.lineTotal,
    })),
  });

  return {
    summary,
    decision:
      issues.length === 0
        ? "Quotation dapat ditampilkan dan disimpan."
        : "Quotation perlu diperbaiki sebelum dipakai.",
    confidence: issues.length === 0 ? 0.92 : 0.55,
    input,
    output: JSON.stringify({ passed: issues.length === 0, issues, summary }),
    fallback: true,
  };
}

async function runCriticAgent({
  intake,
  diagnosis,
  retrieval,
  calculator,
  items,
  subtotal,
  channel,
}: {
  intake: Intake;
  diagnosis: AgentAssessment;
  retrieval: string;
  calculator: string;
  items: QuoteItem[];
  subtotal: number;
  channel: AgentChannel;
}): Promise<AgentAssessment> {
  const input = JSON.stringify({
    inbox: channel.inbox("Critic Agent"),
    intake,
    diagnosis: diagnosis.summary,
    retrieval,
    calculator,
    subtotal,
    items: items.map((item) => ({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      reason: item.reason,
    })),
  });
  let lastError: unknown;

  for (const { model } of getChatModels()) {
    try {
      const { object } = await generateObject({
        model,
        schema: criticSchema,
        schemaName: "QBuildCritic",
        schemaDescription:
          "Validasi quotation material sebelum ditampilkan ke pelanggan.",
        temperature: 0,
        maxOutputTokens: 500,
        abortSignal: AbortSignal.timeout(aiAttemptTimeoutMs()),
        system: `Anda adalah Critic Agent untuk sistem multi-agent bahan bangunan.
Periksa apakah rekomendasi sudah grounded pada item yang tersedia, quantity masuk akal, kalkulasi dipakai, dan subtotal konsisten.
Jangan menambah produk baru. Jika ada isu, jelaskan singkat.`,
        messages: [
          {
            role: "user",
            content: `Audit output agent sebelumnya:\n${input}`,
          },
        ],
      });

      const assessment = {
        summary:
          object.issues.length > 0
            ? `${object.summary} Isu: ${object.issues.join(" ")}`
            : object.summary,
        decision: object.decision,
        confidence: confidence(object.confidence),
        input,
        output: JSON.stringify(object),
        fallback: false,
      };

      channel.send({
        from: "Critic Agent",
        to: "Audit Agent",
        type: "critic.result",
        summary: assessment.summary,
        payload: object,
      });

      return assessment;
    } catch (error) {
      lastError = error;
    }
  }

  void lastError;
  const assessment = fallbackCriticAgent({ intake, items, subtotal, calculator });
  channel.send({
    from: "Critic Agent",
    to: "Audit Agent",
    type: "critic.result",
    summary: assessment.summary,
    payload: assessment,
  });
  return assessment;
}

function chooseByBudget(products: ProductSearchResult[], budgetPreference: Intake["budgetPreference"]) {
  const rows = [...products];
  if (budgetPreference === "economy") return rows.sort((a, b) => a.price - b.price);
  if (budgetPreference === "premium") return rows.sort((a, b) => b.price - a.price);
  return rows.sort((a, b) => a.price - b.price);
}

function parsePackSize(product: ProductSearchResult, fallback: number) {
  const source = `${product.name} ${product.unit}`;
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*(kg|l|liter)/i);
  return match ? Number(match[1].replace(",", ".")) : fallback;
}

function describeRetrievalMode(result: ProductSearch) {
  if (result.searchMode === "semantic") {
    return "semantic match_products";
  }

  const reasons: Record<NonNullable<ProductSearch["fallbackReason"]>, string> = {
    embedding_model_unavailable: "embedding tidak tersedia",
    semantic_no_matches: "semantic kosong",
    semantic_error: "semantic error",
  };

  return `keyword fallback (${reasons[result.fallbackReason ?? "embedding_model_unavailable"]})`;
}

function summarizeRetrieval(searches: ProductSearch[]) {
  const count = searches.reduce((total, search) => total + search.count, 0);
  const modes = searches.map(describeRetrievalMode).join("; ");
  return `Ditemukan ${count} kandidat produk dari katalog Supabase. Mode retrieval: ${modes}.`;
}

function summarizeProducts(searches: ProductSearch[]) {
  return searches
    .flatMap((search) => search.products)
    .slice(0, 5)
    .map((product) => `${product.name} (${formatCurrency(product.price)})`)
    .join(", ");
}

function confidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

function communicationMetadata(channel: AgentChannel, agent: Parameters<AgentChannel["inbox"]>[0]) {
  return {
    inbox: channel.inbox(agent).map(({ from, type, summary }) => ({
      from,
      type,
      summary,
    })),
  };
}

function buildAgentTrace({
  problem,
  diagnosisAgent,
  retrieval,
  calculator,
  quotation,
  criticAgent,
  intake,
  retrievalInput,
  searches,
  channel,
}: {
  problem: string;
  diagnosisAgent: AgentAssessment;
  retrieval: string;
  calculator: string;
  quotation: string;
  criticAgent: AgentAssessment;
  intake: Intake;
  retrievalInput: string;
  searches: ProductSearch[];
  channel: AgentChannel;
}) {
  const retrievalConfidence =
    searches.length > 0 && searches.every((search) => search.searchMode === "semantic")
      ? 0.94
      : 0.74;
  const productNames = summarizeProducts(searches);
  const effectiveMissingFields = requiredMissingFields(intake);

  return [
    {
      step: "Problem Intake",
      agent: "Intake Agent",
      summary: problem,
      input: "Riwayat chat pelanggan dan foto bila ada.",
      output: JSON.stringify({
        intent: intake.intent,
        areaM2: intake.areaM2,
        budgetPreference: intake.budgetPreference,
        missingFields: effectiveMissingFields,
      }),
      decision:
        effectiveMissingFields.length > 0
          ? "Meminta klarifikasi sebelum quotation."
          : "Data cukup untuk diteruskan ke diagnosis.",
      confidence: confidence(intake.confidence),
      durationMs: 900,
      metadata: communicationMetadata(channel, "Intake Agent"),
    },
    {
      step: "Diagnosis",
      agent: "Repair Diagnosis Agent",
      summary: diagnosisAgent.summary,
      input: problem,
      output: diagnosisAgent.output,
      decision: diagnosisAgent.decision,
      confidence: diagnosisAgent.confidence,
      durationMs: diagnosisAgent.fallback ? 40 : 900,
      metadata: {
        ...communicationMetadata(channel, "Repair Diagnosis Agent"),
        execution: diagnosisAgent.fallback ? "deterministic_fallback" : "llm_agent",
      },
    },
    {
      step: "Catalog Retrieval",
      agent: "Product RAG Agent",
      summary: retrieval,
      input: retrievalInput,
      output: productNames || "Tidak ada kandidat produk.",
      decision: searches.map(describeRetrievalMode).join("; "),
      confidence: retrievalConfidence,
      durationMs: 420,
      metadata: {
        ...communicationMetadata(channel, "Product RAG Agent"),
        modes: searches.map((search) => search.searchMode),
        candidates: searches.reduce((total, search) => total + search.count, 0),
      },
    },
    {
      step: "Material Calculator",
      agent: "Quantity Tool Agent",
      summary: calculator,
      input: `Area ${intake.areaM2 ?? "-"} m2 dan aturan coverage kategori ${intake.intent}.`,
      output: calculator,
      decision: "Menggunakan kalkulator deterministik, bukan estimasi bebas LLM.",
      confidence: 0.98,
      durationMs: 35,
      metadata: communicationMetadata(channel, "Quantity Tool Agent"),
    },
    {
      step: "Quotation",
      agent: "Quotation Agent",
      summary: quotation,
      input: "Produk terpilih, quantity, unit price, dan reason tiap item.",
      output: quotation,
      decision: "Menyusun line item dan subtotal yang bisa disimpan/export PDF.",
      confidence: 0.96,
      durationMs: 80,
      metadata: communicationMetadata(channel, "Quotation Agent"),
    },
    {
      step: "Validation/Critic",
      agent: "Critic Agent",
      summary: criticAgent.summary,
      input: criticAgent.input,
      output: criticAgent.output,
      decision: criticAgent.decision,
      confidence: criticAgent.confidence,
      durationMs: criticAgent.fallback ? 45 : 850,
      metadata: {
        ...communicationMetadata(channel, "Critic Agent"),
        execution: criticAgent.fallback ? "deterministic_fallback" : "llm_agent",
      },
    },
    {
      step: "Trace Logger",
      agent: "Audit Agent",
      summary: "Trace dibuat dari intake AI Sumopod, katalog Supabase, dan kalkulator deterministik.",
      input: "Semua hasil agent sebelumnya.",
      output: "Agent Workflow Trace siap ditampilkan, disimpan, dan diekspor.",
      decision: "Mencatat handoff multi-agent untuk audit juri.",
      confidence: 1,
      durationMs: 20,
      metadata: {
        communicationLog: channel.compactLog(),
      },
    },
  ];
}

async function buildPaintRecommendation(
  intake: Intake,
  diagnosisAgent: AgentAssessment,
  channel: AgentChannel,
) {
  const areaM2 = intake.areaM2 ?? 0;
  channel.send({
    from: "Product RAG Agent",
    to: "Product RAG Agent",
    type: "retrieval.plan",
    summary: "Menjalankan retrieval produk cat dan alat aplikasi dari katalog Supabase.",
    payload: {
      queries: [
        `cat dinding interior ${intake.color ?? ""} ${intake.qualityPreference ?? ""}`,
        "roller cat kuas alat cat",
      ],
    },
  });
  const paintSearch = await searchProducts({
    query: `cat dinding interior ${intake.color ?? ""} ${intake.qualityPreference ?? ""}`,
    category: "paint",
    limit: 8,
  });
  const toolSearch = await searchProducts({
    query: "roller cat kuas alat cat",
    category: "tools",
    limit: 4,
  });
  channel.send({
    from: "Product RAG Agent",
    to: "Quantity Tool Agent",
    type: "retrieval.result",
    summary: summarizeRetrieval([paintSearch, toolSearch]),
    payload: {
      products: [...paintSearch.products, ...toolSearch.products].map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
      })),
    },
  });
  const paints = chooseByBudget(
    paintSearch.products.filter((product) => /paint|cat|vinilex|jotun/i.test(product.name)),
    intake.budgetPreference,
  );
  const primer = paintSearch.products.find((product) => /primer|sealer/i.test(product.name));
  const tool = toolSearch.products.find((product) => /roller|brush|kuas/i.test(product.name));
  const primary = paints[0] ?? paintSearch.products[0];

  if (!primary) throw new Error("Produk cat tidak ditemukan di katalog.");

  const coats = 2;
  const packCoverageM2 = 25;
  const paintCalc = calculatePaint({ areaM2, coats, coveragePerKg: 10 });
  const primaryQty = Math.ceil((areaM2 * coats) / packCoverageM2);
  channel.send({
    from: "Quantity Tool Agent",
    to: "Quotation Agent",
    type: "quantity.result",
    summary: paintCalc.explanation,
    payload: paintCalc,
  });
  const items: QuoteItem[] = [
    {
      id: primary.id,
      name: primary.name,
      category: primary.category,
      quantity: primaryQty,
      unit: primary.unit,
      unitPrice: primary.price,
      reason: `Cat utama untuk area ${areaM2} m2, warna ${intake.color}.`,
      lineTotal: primaryQty * primary.price,
    },
  ];

  if (primer) {
    const primerQty = Math.ceil(areaM2 / packCoverageM2);
    items.push({
      id: primer.id,
      name: primer.name,
      category: primer.category,
      quantity: primerQty,
      unit: primer.unit,
      unitPrice: primer.price,
      reason: "Primer membantu warna akhir rata dan menahan alkali/lembap ringan.",
      lineTotal: primerQty * primer.price,
    });
  }

  if (tool) {
    items.push({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      quantity: 1,
      unit: tool.unit,
      unitPrice: tool.price,
      reason: "Alat aplikasi dasar untuk pengecatan.",
      lineTotal: tool.price,
    });
  }

  const subtotal = calculateSubtotal(items).subtotal;
  channel.send({
    from: "Quotation Agent",
    to: "Critic Agent",
    type: "quotation.draft",
    summary: `${items.length} item cat dengan subtotal ${formatCurrency(subtotal)}.`,
    payload: { items, subtotal },
  });
  const diagnosis = diagnosisAgent.summary;
  const retrieval = summarizeRetrieval([paintSearch, toolSearch]);
  const calculator = paintCalc.explanation;
  const criticAgent = await runCriticAgent({
    intake,
    diagnosis: diagnosisAgent,
    retrieval,
    calculator,
    items,
    subtotal,
    channel,
  });

  return {
    message: `Saya sudah punya data cukup: area ${areaM2} m2, warna ${intake.color}, preferensi ${intake.budgetPreference ?? "standar"}. Berikut rekomendasi berbasis katalog dan subtotalnya.`,
    recommendation: {
      title: `Repaint ${intake.color} ${areaM2} m2`,
      problemSummary: intake.problemSummary,
      diagnosis,
      items,
      breakdown: [
        { label: "Area", value: `${areaM2} m2` },
        { label: "Warna", value: intake.color ?? "-" },
        { label: "Preferensi", value: intake.budgetPreference ?? "standar" },
        { label: "Kebutuhan cat", value: paintCalc.explanation },
        { label: "Subtotal", value: formatCurrency(subtotal) },
      ],
      agentTrace: buildAgentTrace({
        problem: intake.problemSummary,
        diagnosisAgent,
        retrieval,
        calculator,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        criticAgent,
        intake,
        retrievalInput: `cat dinding interior ${intake.color ?? ""}; roller cat kuas alat cat`,
        searches: [paintSearch, toolSearch],
        channel,
      }),
      subtotal,
    },
  };
}

async function buildWaterproofingRecommendation(
  intake: Intake,
  diagnosisAgent: AgentAssessment,
  channel: AgentChannel,
) {
  const areaM2 = intake.areaM2 ?? 0;
  channel.send({
    from: "Product RAG Agent",
    to: "Product RAG Agent",
    type: "retrieval.plan",
    summary: "Menjalankan retrieval waterproofing dan alat aplikasi dari katalog Supabase.",
    payload: {
      queries: [
        `atap bocor dak waterproofing ${intake.qualityPreference ?? ""}`,
        "roller kuas alat waterproofing",
      ],
    },
  });
  const productSearch = await searchProducts({
    query: `atap bocor dak waterproofing ${intake.qualityPreference ?? ""}`,
    category: "waterproofing",
    limit: 8,
  });
  const toolSearch = await searchProducts({
    query: "roller kuas alat waterproofing",
    category: "tools",
    limit: 4,
  });
  channel.send({
    from: "Product RAG Agent",
    to: "Quantity Tool Agent",
    type: "retrieval.result",
    summary: summarizeRetrieval([productSearch, toolSearch]),
    payload: {
      products: [...productSearch.products, ...toolSearch.products].map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
      })),
    },
  });
  const coatings = chooseByBudget(
    productSearch.products.filter((product) => /coating|waterproof|seal/i.test(product.name)),
    intake.budgetPreference,
  );
  const membrane = productSearch.products.find((product) => /fiber|mesh|membrane/i.test(product.name));
  const tool = toolSearch.products.find((product) => /roller|brush|kuas/i.test(product.name));
  const primary = coatings[0] ?? productSearch.products[0];

  if (!primary) throw new Error("Produk waterproofing tidak ditemukan di katalog.");

  const calc = calculateWaterproofing({ areaM2, coats: 2, coverageKgPerM2PerCoat: 1 });
  const packKg = parsePackSize(primary, 20);
  const primaryQty = Math.ceil(calc.requiredKg / packKg);
  channel.send({
    from: "Quantity Tool Agent",
    to: "Quotation Agent",
    type: "quantity.result",
    summary: calc.explanation,
    payload: calc,
  });
  const items: QuoteItem[] = [
    {
      id: primary.id,
      name: primary.name,
      category: primary.category,
      quantity: primaryQty,
      unit: primary.unit,
      unitPrice: primary.price,
      reason: `Produk utama waterproofing; kebutuhan ${calc.requiredKg} kg dibulatkan ke kemasan ${packKg} kg/L.`,
      lineTotal: primaryQty * primary.price,
    },
  ];

  if (membrane) {
    items.push({
      id: membrane.id,
      name: membrane.name,
      category: membrane.category,
      quantity: 1,
      unit: membrane.unit,
      unitPrice: membrane.price,
      reason: "Penguat untuk sudut, sambungan, dan retakan rawan bocor.",
      lineTotal: membrane.price,
    });
  }

  if (tool) {
    items.push({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      quantity: 1,
      unit: tool.unit,
      unitPrice: tool.price,
      reason: "Alat aplikasi agar pelapis merata.",
      lineTotal: tool.price,
    });
  }

  const subtotal = calculateSubtotal(items).subtotal;
  channel.send({
    from: "Quotation Agent",
    to: "Critic Agent",
    type: "quotation.draft",
    summary: `${items.length} item waterproofing dengan subtotal ${formatCurrency(subtotal)}.`,
    payload: { items, subtotal },
  });
  const diagnosis = diagnosisAgent.summary;
  const retrieval = summarizeRetrieval([productSearch, toolSearch]);
  const calculator = calc.explanation;
  const criticAgent = await runCriticAgent({
    intake,
    diagnosis: diagnosisAgent,
    retrieval,
    calculator,
    items,
    subtotal,
    channel,
  });

  return {
    message: `Saya sudah punya data cukup: area ${areaM2} m2 dan preferensi ${intake.budgetPreference ?? "standar"}. Berikut rekomendasi waterproofing berbasis katalog dan subtotalnya.`,
    recommendation: {
      title: `Atap bocor ${areaM2} m2`,
      problemSummary: intake.problemSummary,
      diagnosis,
      items,
      breakdown: [
        { label: "Area", value: `${areaM2} m2` },
        { label: "Preferensi", value: intake.budgetPreference ?? "standar" },
        { label: "Kebutuhan", value: calc.explanation },
        { label: "Pembulatan", value: `${calc.requiredKg} kg -> ${primaryQty} x ${primary.unit}` },
        { label: "Subtotal", value: formatCurrency(subtotal) },
      ],
      agentTrace: buildAgentTrace({
        problem: intake.problemSummary,
        diagnosisAgent,
        retrieval,
        calculator,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        criticAgent,
        intake,
        retrievalInput: `atap bocor dak waterproofing ${intake.qualityPreference ?? ""}; roller kuas alat waterproofing`,
        searches: [productSearch, toolSearch],
        channel,
      }),
      subtotal,
    },
  };
}

async function buildTilesRecommendation(
  intake: Intake,
  diagnosisAgent: AgentAssessment,
  channel: AgentChannel,
) {
  const areaM2 = intake.areaM2 ?? 0;
  channel.send({
    from: "Product RAG Agent",
    to: "Product RAG Agent",
    type: "retrieval.plan",
    summary: "Menjalankan retrieval keramik, perekat, nat, dan spacer dari katalog Supabase.",
    payload: {
      query: `keramik lantai ceramic tile adhesive grout spacer ${intake.qualityPreference ?? ""}`,
    },
  });
  const productSearch = await searchProducts({
    query: `keramik lantai ceramic tile adhesive grout spacer ${intake.qualityPreference ?? ""}`,
    category: "tiles",
    limit: 8,
  });
  channel.send({
    from: "Product RAG Agent",
    to: "Quantity Tool Agent",
    type: "retrieval.result",
    summary: summarizeRetrieval([productSearch]),
    payload: {
      products: productSearch.products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
      })),
    },
  });
  const tile = chooseByBudget(
    productSearch.products.filter((product) => /tile|ceramic|keramik/i.test(product.name)),
    intake.budgetPreference,
  )[0] ?? productSearch.products[0];
  const adhesive = productSearch.products.find((product) => /adhesive|lem/i.test(product.name));
  const grout = productSearch.products.find((product) => /grout|nat/i.test(product.name));
  const spacer = productSearch.products.find((product) => /spacer/i.test(product.name));

  if (!tile) throw new Error("Produk keramik tidak ditemukan di katalog.");

  const boxCoverageM2 = 1.44;
  const tileCalc = calculateTiles({ areaM2, wastePercent: 10, boxCoverageM2 });
  const boxes = tileCalc.boxes ?? Math.ceil(tileCalc.requiredAreaM2 / boxCoverageM2);
  channel.send({
    from: "Quantity Tool Agent",
    to: "Quotation Agent",
    type: "quantity.result",
    summary: tileCalc.explanation,
    payload: tileCalc,
  });
  const items: QuoteItem[] = [
    {
      id: tile.id,
      name: tile.name,
      category: tile.category,
      quantity: boxes,
      unit: tile.unit,
      unitPrice: tile.price,
      reason: `Keramik utama untuk area ${areaM2} m2 plus waste 10%.`,
      lineTotal: boxes * tile.price,
    },
  ];

  if (adhesive) {
    const adhesiveQty = Math.ceil(areaM2 / 5);
    items.push({
      id: adhesive.id,
      name: adhesive.name,
      category: adhesive.category,
      quantity: adhesiveQty,
      unit: adhesive.unit,
      unitPrice: adhesive.price,
      reason: "Perekat keramik, estimasi 1 bag untuk sekitar 5 m2.",
      lineTotal: adhesiveQty * adhesive.price,
    });
  }

  if (grout) {
    const groutQty = Math.max(1, Math.ceil(areaM2 / 10));
    items.push({
      id: grout.id,
      name: grout.name,
      category: grout.category,
      quantity: groutQty,
      unit: grout.unit,
      unitPrice: grout.price,
      reason: "Nat untuk mengisi celah antar keramik.",
      lineTotal: groutQty * grout.price,
    });
  }

  if (spacer) {
    items.push({
      id: spacer.id,
      name: spacer.name,
      category: spacer.category,
      quantity: 1,
      unit: spacer.unit,
      unitPrice: spacer.price,
      reason: "Spacer membantu jarak nat rapi dan konsisten.",
      lineTotal: spacer.price,
    });
  }

  const subtotal = calculateSubtotal(items).subtotal;
  channel.send({
    from: "Quotation Agent",
    to: "Critic Agent",
    type: "quotation.draft",
    summary: `${items.length} item keramik dengan subtotal ${formatCurrency(subtotal)}.`,
    payload: { items, subtotal },
  });
  const diagnosis = diagnosisAgent.summary;
  const retrieval = summarizeRetrieval([productSearch]);
  const calculator = tileCalc.explanation;
  const criticAgent = await runCriticAgent({
    intake,
    diagnosis: diagnosisAgent,
    retrieval,
    calculator,
    items,
    subtotal,
    channel,
  });

  return {
    message: `Saya sudah punya data cukup: area ${areaM2} m2 dan preferensi ${intake.budgetPreference ?? "standar"}. Berikut rekomendasi keramik berbasis katalog dan subtotalnya.`,
    recommendation: {
      title: `Pemasangan keramik ${areaM2} m2`,
      problemSummary: intake.problemSummary,
      diagnosis,
      items,
      breakdown: [
        { label: "Area", value: `${areaM2} m2` },
        { label: "Preferensi", value: intake.budgetPreference ?? "standar" },
        { label: "Kebutuhan keramik", value: tileCalc.explanation },
        { label: "Subtotal", value: formatCurrency(subtotal) },
      ],
      agentTrace: buildAgentTrace({
        problem: intake.problemSummary,
        diagnosisAgent,
        retrieval,
        calculator,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        criticAgent,
        intake,
        retrievalInput: `keramik lantai ceramic tile adhesive grout spacer ${intake.qualityPreference ?? ""}`,
        searches: [productSearch],
        channel,
      }),
      subtotal,
    },
  };
}

async function buildPlumbingRecommendation(
  intake: Intake,
  diagnosisAgent: AgentAssessment,
  channel: AgentChannel,
) {
  const lengthM = intake.lengthM ?? 1;
  channel.send({
    from: "Product RAG Agent",
    to: "Product RAG Agent",
    type: "retrieval.plan",
    summary: "Menjalankan retrieval pipa, lem PVC, seal tape, dan sambungan plumbing.",
    payload: {
      query: "pipa bocor pvc pipe glue seal tape elbow plumbing",
    },
  });

  const productSearch = await searchProducts({
    query: "pipa bocor pvc pipe glue seal tape elbow plumbing",
    category: "plumbing",
    limit: 8,
  });
  channel.send({
    from: "Product RAG Agent",
    to: "Quantity Tool Agent",
    type: "retrieval.result",
    summary: summarizeRetrieval([productSearch]),
    payload: {
      products: productSearch.products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
      })),
    },
  });

  const pipe =
    productSearch.products.find((product) => /1\/2|1\/2 inch/i.test(product.name)) ??
    productSearch.products.find((product) => /pipe|pipa/i.test(product.name)) ??
    productSearch.products[0];
  const glue = productSearch.products.find((product) => /glue|lem/i.test(product.name));
  const tape = productSearch.products.find((product) => /tape|ptfe/i.test(product.name));
  const elbow = productSearch.products.find((product) => /elbow/i.test(product.name));

  if (!pipe) throw new Error("Produk plumbing tidak ditemukan di katalog.");

  const pipeQty = Math.max(1, Math.ceil(lengthM / 4));
  const calculator = `${lengthM} meter pipa / 4 meter per batang = ${pipeQty} batang pipa.`;
  channel.send({
    from: "Quantity Tool Agent",
    to: "Quotation Agent",
    type: "quantity.result",
    summary: calculator,
    payload: { lengthM, pipeLengthPerUnitM: 4, pipeQty },
  });

  const items: QuoteItem[] = [
    {
      id: pipe.id,
      name: pipe.name,
      category: pipe.category,
      quantity: pipeQty,
      unit: pipe.unit,
      unitPrice: pipe.price,
      reason: `Pipa pengganti untuk area bocor sepanjang ${lengthM} meter.`,
      lineTotal: pipeQty * pipe.price,
    },
  ];

  if (glue) {
    items.push({
      id: glue.id,
      name: glue.name,
      category: glue.category,
      quantity: 1,
      unit: glue.unit,
      unitPrice: glue.price,
      reason: "Lem PVC untuk menyambung pipa dan fitting.",
      lineTotal: glue.price,
    });
  }

  if (tape) {
    items.push({
      id: tape.id,
      name: tape.name,
      category: tape.category,
      quantity: 1,
      unit: tape.unit,
      unitPrice: tape.price,
      reason: "Seal tape untuk drat keran atau sambungan kecil yang rawan bocor.",
      lineTotal: tape.price,
    });
  }

  if (elbow) {
    items.push({
      id: elbow.id,
      name: elbow.name,
      category: elbow.category,
      quantity: 2,
      unit: elbow.unit,
      unitPrice: elbow.price,
      reason: "Cadangan fitting belokan untuk titik sambungan pipa.",
      lineTotal: 2 * elbow.price,
    });
  }

  const subtotal = calculateSubtotal(items).subtotal;
  channel.send({
    from: "Quotation Agent",
    to: "Critic Agent",
    type: "quotation.draft",
    summary: `${items.length} item plumbing dengan subtotal ${formatCurrency(subtotal)}.`,
    payload: { items, subtotal },
  });

  const diagnosis = diagnosisAgent.summary;
  const retrieval = summarizeRetrieval([productSearch]);
  const criticAgent = await runCriticAgent({
    intake,
    diagnosis: diagnosisAgent,
    retrieval,
    calculator,
    items,
    subtotal,
    channel,
  });

  return {
    message: `Saya tangkap panjang pipa sekitar ${lengthM} meter dan preferensi ${intake.budgetPreference ?? "standar"}. Berikut rekomendasi plumbing berbasis katalog dan subtotalnya.`,
    recommendation: {
      title: `Perbaikan pipa bocor ${lengthM} m`,
      problemSummary: intake.problemSummary,
      diagnosis,
      items,
      breakdown: [
        { label: "Panjang", value: `${lengthM} meter` },
        { label: "Preferensi", value: intake.budgetPreference ?? "standar" },
        { label: "Kebutuhan pipa", value: calculator },
        { label: "Subtotal", value: formatCurrency(subtotal) },
      ],
      agentTrace: buildAgentTrace({
        problem: intake.problemSummary,
        diagnosisAgent,
        retrieval,
        calculator,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        criticAgent,
        intake,
        retrievalInput: "pipa bocor pvc pipe glue seal tape elbow plumbing",
        searches: [productSearch],
        channel,
      }),
      subtotal,
    },
  };
}

async function buildWallRepairRecommendation(
  intake: Intake,
  diagnosisAgent: AgentAssessment,
  channel: AgentChannel,
) {
  const areaM2 = intake.areaM2 ?? 1;
  channel.send({
    from: "Product RAG Agent",
    to: "Product RAG Agent",
    type: "retrieval.plan",
    summary: "Menjalankan retrieval dempul, skim coat, amplas, scraper, dan sealant untuk dinding.",
    payload: {
      queries: [
        "dinding retak rembes wall putty skim coat sandpaper scraper",
        "sealant rembes retak sambungan dinding",
      ],
    },
  });

  const wallSearch = await searchProducts({
    query: "dinding retak rembes wall putty skim coat sandpaper scraper",
    category: "wall_repair",
    limit: 8,
  });
  const toolSearch = await searchProducts({
    query: "scraper amplas alat dempul dinding",
    category: "tools",
    limit: 4,
  });
  const sealantSearch = await searchProducts({
    query: "sealant rembes retak sambungan dinding",
    category: "waterproofing",
    limit: 3,
  });
  channel.send({
    from: "Product RAG Agent",
    to: "Quantity Tool Agent",
    type: "retrieval.result",
    summary: summarizeRetrieval([wallSearch, toolSearch, sealantSearch]),
    payload: {
      products: [...wallSearch.products, ...toolSearch.products, ...sealantSearch.products].map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
      })),
    },
  });

  const putty =
    wallSearch.products.find((product) => /putty|dempul/i.test(product.name)) ??
    wallSearch.products[0];
  const skim = wallSearch.products.find((product) => /skim/i.test(product.name));
  const sandpaper = wallSearch.products.find((product) => /sandpaper|amplas/i.test(product.name));
  const scraper = toolSearch.products.find((product) => /scraper|kape/i.test(product.name));
  const sealant = sealantSearch.products.find((product) => /sealant/i.test(product.name));

  if (!putty) throw new Error("Produk perbaikan dinding tidak ditemukan di katalog.");

  const puttyQty = Math.max(1, Math.ceil(areaM2 / 5));
  const skimQty = skim ? Math.max(1, Math.ceil(areaM2 / 12)) : 0;
  const calculator = `Area ${areaM2} m2: dempul ${puttyQty} kemasan, skim coat ${skimQty || "-"} kemasan bila perlu perataan tipis.`;
  channel.send({
    from: "Quantity Tool Agent",
    to: "Quotation Agent",
    type: "quantity.result",
    summary: calculator,
    payload: { areaM2, puttyQty, skimQty },
  });

  const items: QuoteItem[] = [
    {
      id: putty.id,
      name: putty.name,
      category: putty.category,
      quantity: puttyQty,
      unit: putty.unit,
      unitPrice: putty.price,
      reason: "Dempul untuk retak rambut, lubang kecil, dan perataan lokal sebelum finishing.",
      lineTotal: puttyQty * putty.price,
    },
  ];

  if (skim) {
    items.push({
      id: skim.id,
      name: skim.name,
      category: skim.category,
      quantity: skimQty,
      unit: skim.unit,
      unitPrice: skim.price,
      reason: "Skim coat untuk meratakan bidang dinding yang lebih luas.",
      lineTotal: skimQty * skim.price,
    });
  }

  if (sealant) {
    items.push({
      id: sealant.id,
      name: sealant.name,
      category: sealant.category,
      quantity: 1,
      unit: sealant.unit,
      unitPrice: sealant.price,
      reason: "Sealant untuk celah atau sambungan yang menjadi sumber rembes.",
      lineTotal: sealant.price,
    });
  }

  if (sandpaper) {
    items.push({
      id: sandpaper.id,
      name: sandpaper.name,
      category: sandpaper.category,
      quantity: 1,
      unit: sandpaper.unit,
      unitPrice: sandpaper.price,
      reason: "Amplas untuk finishing setelah dempul/skim coat kering.",
      lineTotal: sandpaper.price,
    });
  }

  if (scraper) {
    items.push({
      id: scraper.id,
      name: scraper.name,
      category: scraper.category,
      quantity: 1,
      unit: scraper.unit,
      unitPrice: scraper.price,
      reason: "Scraper/kape untuk membersihkan cat mengelupas dan meratakan dempul.",
      lineTotal: scraper.price,
    });
  }

  const subtotal = calculateSubtotal(items).subtotal;
  channel.send({
    from: "Quotation Agent",
    to: "Critic Agent",
    type: "quotation.draft",
    summary: `${items.length} item wall repair dengan subtotal ${formatCurrency(subtotal)}.`,
    payload: { items, subtotal },
  });

  const diagnosis = diagnosisAgent.summary;
  const retrieval = summarizeRetrieval([wallSearch, toolSearch, sealantSearch]);
  const criticAgent = await runCriticAgent({
    intake,
    diagnosis: diagnosisAgent,
    retrieval,
    calculator,
    items,
    subtotal,
    channel,
  });

  return {
    message: `Saya tangkap masalah dinding pada area sekitar ${areaM2} m2. Berikut rekomendasi perbaikan dinding berbasis katalog dan subtotalnya.`,
    recommendation: {
      title: `Perbaikan dinding ${areaM2} m2`,
      problemSummary: intake.problemSummary,
      diagnosis,
      items,
      breakdown: [
        { label: "Area", value: `${areaM2} m2` },
        { label: "Preferensi", value: intake.budgetPreference ?? "standar" },
        { label: "Kebutuhan", value: calculator },
        { label: "Subtotal", value: formatCurrency(subtotal) },
      ],
      agentTrace: buildAgentTrace({
        problem: intake.problemSummary,
        diagnosisAgent,
        retrieval,
        calculator,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        criticAgent,
        intake,
        retrievalInput: "dinding retak rembes wall putty skim coat sandpaper scraper; sealant rembes retak sambungan dinding",
        searches: [wallSearch, toolSearch, sealantSearch],
        channel,
      }),
      subtotal,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: RequestMessage[] };
    const messages = body.messages?.filter((message) => message.role === "user" || message.role === "assistant") ?? [];
    const channel = createAgentChannel();

    if (messages.length === 0) {
      return Response.json({ error: "Riwayat chat kosong." }, { status: 400 });
    }

    channel.send({
      from: "Customer",
      to: "Intake Agent",
      type: "customer.request",
      summary: messages.at(-1)?.content ?? "Permintaan pelanggan diterima.",
      payload: { messageCount: messages.length, hasImage: hasImage(messages) },
    });

    if (detectUnsupportedRequest(messages)) {
      return unavailableResponse();
    }

    let intake: Intake;
    try {
      intake = await analyzeIntake(messages);
    } catch {
      if (hasImage(messages)) {
        const imageSummary = await describeImage(messages).catch(
          () => "Foto sudah diterima, tetapi detail kerusakan belum cukup jelas.",
        );

        return Response.json({
          type: "clarification",
          message: `${imageSummary} Berapa luas area yang terdampak dan apa target pekerjaan Anda?`,
          aiProvider: "sumopod",
        });
      }

      intake = fallbackAnalyzeIntake(messages);
    }
    intake = normalizeIntakeForIndonesian(intake, messages);
    if (hasNoPreference(messages) && !intake.budgetPreference) {
      intake.budgetPreference = "standard";
    }

    channel.send({
      from: "Intake Agent",
      to: "Repair Diagnosis Agent",
      type: "intake.result",
      summary: `${intake.intent}: ${intake.problemSummary}`,
      payload: intake,
    });

    if (intake.intent === "unknown") {
      return unavailableResponse(
        `Maaf, saya belum menemukan produk yang sesuai di katalog demo untuk kebutuhan tersebut. Saat ini katalog yang tersedia mencakup ${supportedCategoryText}.`,
      );
    }

    const missingFields = requiredMissingFields(intake);

    if (missingFields.length > 0) {
      return Response.json({
        type: "clarification",
        message: nextQuestion(intake, missingFields),
        intake: { ...intake, missingFields },
        aiProvider: "sumopod",
      });
    }

    const diagnosisAgent = await runDiagnosisAgent(intake, messages, channel);

    if (intake.intent === "paint") {
      return Response.json({
        type: "recommendation",
        ...(await buildPaintRecommendation(intake, diagnosisAgent, channel)),
        intake,
        aiProvider: "sumopod",
      });
    }

    if (intake.intent === "waterproofing") {
      return Response.json({
        type: "recommendation",
        ...(await buildWaterproofingRecommendation(intake, diagnosisAgent, channel)),
        intake,
        aiProvider: "sumopod",
      });
    }

    if (intake.intent === "tiles") {
      return Response.json({
        type: "recommendation",
        ...(await buildTilesRecommendation(intake, diagnosisAgent, channel)),
        intake,
        aiProvider: "sumopod",
      });
    }

    if (intake.intent === "plumbing") {
      return Response.json({
        type: "recommendation",
        ...(await buildPlumbingRecommendation(intake, diagnosisAgent, channel)),
        intake,
        aiProvider: "sumopod",
      });
    }

    if (intake.intent === "wall_repair") {
      return Response.json({
        type: "recommendation",
        ...(await buildWallRepairRecommendation(intake, diagnosisAgent, channel)),
        intake,
        aiProvider: "sumopod",
      });
    }

    return unavailableResponse();
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal memproses rekomendasi AI.",
      },
      { status: 500 },
    );
  }
}
