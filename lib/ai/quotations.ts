import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateSubtotal } from "@/lib/calculators";
import type { SaveQuotationInput } from "@/types/domain";

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

  return {
    ok: true as const,
    quotationId: quotation.id,
    quotation,
    items,
  };
}
