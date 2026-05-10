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
  agent_runs?: DbAgentRun[];
};

type DbAgentRun = {
  id: string;
  input_summary: string | null;
  final_summary: string | null;
  status: string | null;
  created_at?: string | null;
  agent_steps?: DbAgentStep[];
};

type DbAgentStep = {
  id: string;
  step_order?: number | string | null;
  agent_name: string | null;
  role: string | null;
  input: string | null;
  output: string | null;
  decision: string | null;
  confidence: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function toAgentTrace(quotation: DbQuotation) {
  const run = [...(quotation.agent_runs ?? [])].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  )[0];

  if (!run) {
    return null;
  }

  const steps = [...(run.agent_steps ?? [])].sort((a, b) => {
    const orderA = Number(a.step_order ?? 0);
    const orderB = Number(b.step_order ?? 0);

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });

  return steps.map((step) => ({
    step: step.role ?? step.decision ?? "Agent Step",
    agent: step.agent_name ?? "Agent",
    summary: step.output ?? step.decision ?? "Langkah agent selesai.",
    input: step.input,
    output: step.output,
    decision: step.decision,
    confidence: step.confidence === null ? null : Number(step.confidence),
    durationMs:
      typeof step.metadata?.durationMs === "number"
        ? step.metadata.durationMs
        : null,
    metadata: step.metadata,
  }));
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
    agentTrace: toAgentTrace(quotation),
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
      "id,title,summary,subtotal,installment_months,installment_amount,created_at,quotation_items(id,product_id,name,unit,unit_price,quantity,line_total,reason),agent_runs(id,input_summary,final_summary,status,created_at,agent_steps(id,step_order,agent_name,role,input,output,decision,confidence,metadata,created_at))",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(toSavedQuote(data as DbQuotation));
}
