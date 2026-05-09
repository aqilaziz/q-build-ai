import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateSubtotal } from "@/lib/calculators";
import type { AgentTraceInput, SaveQuotationInput } from "@/types/domain";

async function saveAgentTrace(
  supabase: SupabaseClient,
  params: {
    userId: string;
    quotationId: string;
    quotationSummary: string;
    trace: AgentTraceInput;
  },
) {
  const { userId, quotationId, quotationSummary, trace } = params;
  const traceSteps = Array.isArray(trace.steps) ? trace.steps : [];
  const status =
    trace.status === "started" || trace.status === "failed"
      ? trace.status
      : "completed";
  const { data: agentRun, error: agentRunError } = await supabase
    .from("agent_runs")
    .insert({
      user_id: userId,
      quotation_id: quotationId,
      input_summary: trace.inputSummary ?? quotationSummary,
      final_summary: trace.finalSummary ?? quotationSummary,
      status,
      metadata: trace.metadata ?? {},
    })
    .select("id")
    .single();

  if (agentRunError || !agentRun) {
    return {
      ok: false as const,
      error: agentRunError?.message ?? "Gagal menyimpan agent trace.",
    };
  }

  if (traceSteps.length === 0) {
    return { ok: true as const, runId: agentRun.id as string };
  }

  const steps = traceSteps.map((step, index) => ({
    run_id: agentRun.id,
    step_order: index + 1,
    agent_name: step.agentName,
    role: step.role,
    input: step.input ?? null,
    output:
      step.output ??
      step.decision ??
      step.input ??
      `${step.agentName} menyelesaikan langkah ${index + 1}.`,
    decision: step.decision ?? null,
    confidence: step.confidence ?? null,
    metadata: step.metadata ?? {},
  }));

  const { error: agentStepsError } = await supabase
    .from("agent_steps")
    .insert(steps);

  if (agentStepsError) {
    return {
      ok: false as const,
      error: agentStepsError.message,
      runId: agentRun.id as string,
    };
  }

  return { ok: true as const, runId: agentRun.id as string };
}

export async function saveQuotationWithClient(
  supabase: SupabaseClient,
  input: SaveQuotationInput,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      error: "Login diperlukan untuk menyimpan quotation.",
    };
  }

  const subtotalResult = calculateSubtotal(
    input.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
  );

  const subtotal = input.subtotal || subtotalResult.subtotal;

  const { data: quotation, error: quotationError } = await supabase
    .from("quotations")
    .insert({
      user_id: user.id,
      project_id: input.projectId ?? null,
      title: input.title,
      summary: input.summary,
      subtotal,
      installment_months: input.installmentMonths ?? null,
      installment_amount: input.installmentAmount ?? null,
    })
    .select("id,title,summary,subtotal,installment_months,installment_amount,created_at")
    .single();

  if (quotationError || !quotation) {
    return {
      ok: false as const,
      error: quotationError?.message ?? "Gagal menyimpan quotation.",
    };
  }

  const items = input.items.map((item) => ({
    quotation_id: quotation.id,
    product_id: item.productId ?? null,
    name: item.name,
    unit: item.unit,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    line_total: Math.round(item.unitPrice * item.quantity),
    reason: item.reason ?? null,
  }));

  const { error: itemsError } = await supabase
    .from("quotation_items")
    .insert(items);

  if (itemsError) {
    return {
      ok: false as const,
      error: itemsError.message,
      quotationId: quotation.id,
    };
  }

  if (input.agentTrace) {
    const traceResult = await saveAgentTrace(supabase, {
      userId: user.id,
      quotationId: quotation.id,
      quotationSummary: input.summary,
      trace: input.agentTrace,
    });

    if (!traceResult.ok) {
      return {
        ok: false as const,
        error: traceResult.error,
        quotationId: quotation.id,
      };
    }
  }

  return {
    ok: true as const,
    quotationId: quotation.id,
    quotation,
    items,
  };
}
