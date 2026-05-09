import { NextResponse } from "next/server";
import { createUserContextSupabaseClient } from "@/lib/supabase/server";

type DbQuotation = {
  id: string;
  title: string;
  summary: string;
  subtotal: number | string;
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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(toSavedQuote(data as DbQuotation));
}
