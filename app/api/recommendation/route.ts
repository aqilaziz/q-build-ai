import { generateText } from "ai";
import { z } from "zod";
import { calculatePaint, calculateSubtotal, calculateWaterproofing } from "@/lib/calculators";
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

const fallbackQuestions: Record<string, string> = {
  problem: "Boleh jelaskan masalahnya dulu? Contohnya atap bocor, cat ulang dinding, pipa bocor, atau pasang keramik.",
  areaM2: "Berapa luas area yang dikerjakan dalam m2? Kalau belum pasti, boleh estimasi panjang x lebar.",
  color: "Untuk cat, warna apa yang diinginkan?",
  budgetPreference: "Prefer produk ekonomis, standar, atau premium? Kalau ada batas budget, sebutkan juga.",
  qualityPreference: "Prioritasnya harga hemat, kualitas standar, atau kualitas premium/tahan lama?",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("AI tidak mengembalikan JSON intake.");
  }

  return JSON.parse(source.slice(start, end + 1));
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

function requiredMissingFields(intake: Intake) {
  const missing = new Set(intake.missingFields);

  if (intake.intent === "unknown") missing.add("problem");
  if (!intake.areaM2 && ["waterproofing", "paint", "tiles"].includes(intake.intent)) {
    missing.add("areaM2");
  }
  if (intake.intent === "paint" && !intake.color) missing.add("color");
  if (!intake.budgetPreference && !intake.maxBudget && ["waterproofing", "paint"].includes(intake.intent)) {
    missing.add("budgetPreference");
  }

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
  const { text } = await generateText({
    model: getChatModel(),
    temperature: 0.1,
    maxOutputTokens: 700,
    system:
      "Anda adalah intake agent toko bahan bangunan. Ekstrak kebutuhan pelanggan dari riwayat chat. Balas hanya JSON valid, tanpa markdown.",
    prompt: `Ekstrak data berikut dari riwayat chat. Gunakan null jika belum disebut.

Schema JSON:
{
  "intent": "waterproofing|paint|tiles|plumbing|wall_repair|unknown",
  "problemSummary": "ringkasan masalah pelanggan",
  "areaM2": number|null,
  "color": string|null,
  "budgetPreference": "economy|standard|premium"|null,
  "maxBudget": number|null,
  "qualityPreference": string|null,
  "location": string|null,
  "missingFields": string[],
  "nextQuestion": string|null,
  "confidence": number
}

Aturan:
- Untuk atap bocor/dak bocor/rembes, intent = waterproofing.
- Untuk cat ulang/dinding/tembok/repaint, intent = paint.
- Jangan membuat quotation jika luas area belum ada.
- Untuk cat, warna wajib ditanya.
- Untuk waterproofing dan cat, tanya preferensi ekonomis/standar/premium atau batas budget sebelum rekomendasi produk.
- nextQuestion harus satu pertanyaan pendek dan natural dalam Bahasa Indonesia bila ada data penting yang kurang.

Riwayat chat:
${transcript}`,
  });

  return intakeSchema.parse(extractJson(text));
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
        retrieval: `Ditemukan ${paintSearch.count + toolSearch.count} kandidat produk dari katalog Supabase.`,
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
        retrieval: `Ditemukan ${productSearch.count + toolSearch.count} kandidat produk dari katalog Supabase.`,
        calculator: calc.explanation,
        quotation: `${items.length} item dengan subtotal ${formatCurrency(subtotal)}.`,
        validation: "Area, preferensi budget, produk utama, item pendukung, pembulatan kemasan, dan subtotal sudah dicek.",
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

    const intake = await analyzeIntake(messages);
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

    return Response.json({
      type: "clarification",
      message:
        "Untuk demo saat ini saya paling siap membantu atap/dak bocor dan cat ulang. Masalahnya termasuk yang mana?",
      intake,
      aiProvider: "sumopod",
    });
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
