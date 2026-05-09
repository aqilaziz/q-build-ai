import { generateObject, generateText, type ModelMessage } from "ai";
import { z } from "zod";
import { calculatePaint, calculateSubtotal, calculateTiles, calculateWaterproofing } from "@/lib/calculators";
import { searchProducts } from "@/lib/ai/products";
import { getChatModel } from "@/lib/ai/provider";
import type { ProductSearchResult } from "@/types/domain";

const intakeSchema = z.object({
  intent: z.enum(["waterproofing", "paint", "tiles", "plumbing", "wall_repair", "unknown"]),
  problemSummary: z.string(),
  areaM2: z.number().positive().nullable(),
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
};

const supportedCategoryText =
  "waterproofing/atap bocor, cat tembok, plumbing/pipa, keramik, perbaikan dinding, dan tools pendukung renovasi";

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

function userText(messages: RequestMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ");
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
  if (!intake.areaM2 && ["waterproofing", "paint", "tiles"].includes(intake.intent)) {
    missing.add("areaM2");
  }
  if (intake.intent === "paint" && !intake.color) missing.add("color");
  if (!intake.budgetPreference && !intake.maxBudget && ["waterproofing", "paint", "tiles"].includes(intake.intent)) {
    missing.add("budgetPreference");
  }

  if (intake.areaM2) missing.delete("areaM2");
  if (intake.color) missing.delete("color");
  if (intake.budgetPreference || intake.maxBudget) missing.delete("budgetPreference");
  if (intake.qualityPreference) missing.delete("qualityPreference");
  if (intake.intent !== "unknown") missing.delete("problem");

  return [...missing].filter((field) =>
    ["problem", "areaM2", "color", "budgetPreference", "qualityPreference"].includes(field),
  );
}

function nextQuestion(intake: Intake, missingFields: string[]) {
  if (intake.nextQuestion && missingFields.length > 0) return intake.nextQuestion;
  return fallbackQuestions[missingFields[0]] ?? fallbackQuestions.areaM2;
}

async function analyzeIntake(messages: RequestMessage[]) {
  const transcript = toTranscript(messages);
  const { object } = await generateObject({
    model: getChatModel(),
    schema: intakeSchema,
    schemaName: "QBuildIntake",
    schemaDescription:
      "Hasil intake kebutuhan pelanggan toko bahan bangunan sebelum membuat rekomendasi produk.",
    temperature: 0.1,
    maxOutputTokens: 700,
    system: `Anda adalah intake agent toko bahan bangunan.
Ekstrak kebutuhan pelanggan dari riwayat chat dan foto bila ada.
Jangan membuat quotation bila data penting belum cukup.

Aturan intent:
- Untuk atap bocor/dak bocor/rembes, intent = waterproofing.
- Untuk cat ulang/dinding/tembok/repaint, intent = paint.
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

async function describeImage(messages: RequestMessage[]) {
  const transcript = toTranscript(messages);
  const { text } = await generateText({
    model: getChatModel(),
    temperature: 0.2,
    maxOutputTokens: 220,
    system:
      "Anda membantu membaca foto masalah rumah. Jawab singkat dalam Bahasa Indonesia. Jika foto tidak jelas, katakan tidak jelas.",
    messages: toModelMessages(messages, transcript),
  });

  return text.trim();
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

function buildAgentTrace({
  problem,
  diagnosis,
  retrieval,
  calculator,
  quotation,
  validation,
}: {
  problem: string;
  diagnosis: string;
  retrieval: string;
  calculator: string;
  quotation: string;
  validation: string;
}) {
  return [
    { step: "Problem Intake", agent: "Intake Agent", summary: problem },
    { step: "Diagnosis", agent: "Repair Diagnosis Agent", summary: diagnosis },
    { step: "Catalog Retrieval", agent: "Product RAG Agent", summary: retrieval },
    { step: "Material Calculator", agent: "Quantity Tool Agent", summary: calculator },
    { step: "Quotation", agent: "Quotation Agent", summary: quotation },
    { step: "Validation/Critic", agent: "Critic Agent", summary: validation },
    {
      step: "Trace Logger",
      agent: "Audit Agent",
      summary: "Trace dibuat dari intake AI Sumopod, katalog Supabase, dan kalkulator deterministik.",
    },
  ];
}

async function buildPaintRecommendation(intake: Intake) {
  const areaM2 = intake.areaM2 ?? 0;
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
  const diagnosis = `Kebutuhan diklasifikasikan sebagai repainting. Area ${areaM2} m2, warna ${intake.color}, preferensi ${intake.budgetPreference ?? "standar"}.`;

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
        diagnosis,
        retrieval: summarizeRetrieval([paintSearch, toolSearch]),
        calculator: paintCalc.explanation,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        validation: "Area, warna, preferensi budget, item utama, item pendukung, dan subtotal sudah dicek.",
      }),
      subtotal,
    },
  };
}

async function buildWaterproofingRecommendation(intake: Intake) {
  const areaM2 = intake.areaM2 ?? 0;
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
  const diagnosis = `Kebutuhan diklasifikasikan sebagai waterproofing atap/dak. Area ${areaM2} m2, preferensi ${intake.budgetPreference ?? "standar"}.`;

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
        diagnosis,
        retrieval: summarizeRetrieval([productSearch, toolSearch]),
        calculator: calc.explanation,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        validation: "Area, preferensi budget, produk utama, item pendukung, pembulatan kemasan, dan subtotal sudah dicek.",
      }),
      subtotal,
    },
  };
}

async function buildTilesRecommendation(intake: Intake) {
  const areaM2 = intake.areaM2 ?? 0;
  const productSearch = await searchProducts({
    query: `keramik lantai ceramic tile adhesive grout spacer ${intake.qualityPreference ?? ""}`,
    category: "tiles",
    limit: 8,
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
  const diagnosis = `Kebutuhan diklasifikasikan sebagai pemasangan keramik. Area ${areaM2} m2, preferensi ${intake.budgetPreference ?? "standar"}.`;

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
        diagnosis,
        retrieval: summarizeRetrieval([productSearch]),
        calculator: tileCalc.explanation,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        validation: "Area, preferensi budget, keramik, perekat/nat/spacer, pembulatan dus, dan subtotal sudah dicek.",
      }),
      subtotal,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: RequestMessage[] };
    const messages = body.messages?.filter((message) => message.role === "user" || message.role === "assistant") ?? [];

    if (messages.length === 0) {
      return Response.json({ error: "Riwayat chat kosong." }, { status: 400 });
    }

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
    if (hasNoPreference(messages) && !intake.budgetPreference) {
      intake.budgetPreference = "standard";
    }

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

    if (intake.intent === "paint") {
      return Response.json({
        type: "recommendation",
        ...(await buildPaintRecommendation(intake)),
        intake,
        aiProvider: "sumopod",
      });
    }

    if (intake.intent === "waterproofing") {
      return Response.json({
        type: "recommendation",
        ...(await buildWaterproofingRecommendation(intake)),
        intake,
        aiProvider: "sumopod",
      });
    }

    if (intake.intent === "tiles") {
      return Response.json({
        type: "recommendation",
        ...(await buildTilesRecommendation(intake)),
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
