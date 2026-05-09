import { NextResponse } from "next/server";
import { saveQuotationWithClient } from "@/lib/ai/quotations";
import { createUserContextSupabaseClient } from "@/lib/supabase/server";
import type { SaveQuotationInput } from "@/types/domain";

type UiQuoteItemInput = {
  productId?: string | null;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  reason?: string | null;
};

type UiQuoteInput = {
  title?: string;
  summary?: string;
  problemSummary?: string;
  diagnosis?: string;
  category?: string | null;
  areaM2?: number | null;
  projectId?: string | null;
  subtotal?: number;
  installmentMonths?: number | null;
  installmentAmount?: number | null;
  items?: UiQuoteItemInput[];
};

type DbQuotation = {
  id: string;
  title: string;
  summary: string;
  subtotal: number | string;
  installment_months: number | null;
  installment_amount: number | string | null;
  created_at: string;
  quotation_items?: Array<{
    id: string;
    product_id: string | null;
    name: string;
    unit: string;
    unit_price: number | string;
    quantity: number | string;
    line_total: number | string;
    reason: string | null;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function toSavedQuote(quotation: DbQuotation) {
  const items = quotation.quotation_items ?? [];
  const subtotal = Number(quotation.subtotal);

  return {
    id: quotation.id,
    title: quotation.title,
    problemSummary: quotation.summary,
    diagnosis: quotation.summary,
    items: items.map((item) => ({
      id: item.product_id ?? item.id,
      name: item.name,
      category: "Rekomendasi",
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.unit_price),
      reason: item.reason ?? "Direkomendasikan dari hasil agen.",
      lineTotal: Number(item.line_total),
    })),
    breakdown: [{ label: "Subtotal", value: formatCurrency(subtotal) }],
    subtotal,
    createdAt: quotation.created_at,
    source: "api" as const,
  };
}

function normalizeSaveInput(body: UiQuoteInput): SaveQuotationInput {
  const items = body.items ?? [];

  return {
    title: body.title ?? "Quotation Q-Build AI",
    summary:
      body.summary ??
      body.problemSummary ??
      body.diagnosis ??
      "Rekomendasi material dari Q-Build AI.",
    category: body.category,
    areaM2: body.areaM2,
    projectId: body.projectId,
    subtotal:
      body.subtotal ??
      items.reduce(
        (total, item) => total + Number(item.unitPrice) * Number(item.quantity),
        0,
      ),
    installmentMonths: body.installmentMonths,
    installmentAmount: body.installmentAmount,
    items: items.map((item) => ({
      productId: item.productId ?? null,
      name: item.name,
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      reason: item.reason ?? null,
    })),
  };
}

export async function GET(request: Request) {
  const supabase = await createUserContextSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Login diperlukan untuk melihat quotation." },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id,title,summary,subtotal,installment_months,installment_amount,created_at,quotation_items(id,product_id,name,unit,unit_price,quantity,line_total,reason)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    quotes: ((data ?? []) as DbQuotation[]).map(toSavedQuote),
  });
}

export async function POST(request: Request) {
  const supabase = await createUserContextSupabaseClient(request);
  const body = (await request.json()) as UiQuoteInput;
  const result = await saveQuotationWithClient(supabase, normalizeSaveInput(body));

  if (!result.ok) {
    const status = result.error.includes("Login") ? 401 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(
    toSavedQuote({
      ...(result.quotation as DbQuotation),
      quotation_items: result.items.map((item, index) => ({
        id: `${result.quotationId}-item-${index}`,
        product_id: item.product_id,
        name: item.name,
        unit: item.unit,
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_total: item.line_total,
        reason: item.reason,
      })),
    }),
    { status: 201 },
  );
}
