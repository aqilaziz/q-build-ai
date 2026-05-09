import { tool } from "ai";
import { z } from "zod";
import {
  calculateInstallment,
  calculatePaint,
  calculateSubtotal,
  calculateTiles,
  calculateWaterproofing,
} from "@/lib/calculators";
import { searchProducts } from "@/lib/ai/products";
import { saveQuotationWithClient } from "@/lib/ai/quotations";
import { createUserContextSupabaseClient } from "@/lib/supabase/server";

const subtotalItemSchema = z.object({
  productId: z.string().nullable().optional(),
  name: z.string(),
  unit: z.string().optional(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().positive(),
  reason: z.string().nullable().optional(),
});

export function createQBuildTools(request: Request) {
  return {
    searchProducts: tool({
      description:
        "Cari produk QHomemart dari katalog Supabase. Pakai tool ini sebelum memberi rekomendasi produk.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Masalah atau material yang dicari."),
        category: z.string().nullable().optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async ({ query, category, limit }) => {
        try {
          return await searchProducts({ query, category, limit });
        } catch (error) {
          return {
            products: [],
            count: 0,
            error:
              error instanceof Error
                ? error.message
                : "Gagal mencari produk.",
          };
        }
      },
    }),
    calculateWaterproofing: tool({
      description:
        "Hitung kebutuhan waterproofing secara deterministik dalam kg.",
      inputSchema: z.object({
        areaM2: z.number().positive(),
        coats: z.number().positive().optional(),
        coverageKgPerM2PerCoat: z.number().positive().optional(),
      }),
      execute: calculateWaterproofing,
    }),
    calculatePaint: tool({
      description: "Hitung kebutuhan cat secara deterministik dalam kg.",
      inputSchema: z.object({
        areaM2: z.number().positive(),
        coats: z.number().positive().optional(),
        coveragePerKg: z
          .number()
          .positive()
          .optional()
          .describe("Daya sebar cat dalam m2 per kg per lapis."),
      }),
      execute: calculatePaint,
    }),
    calculateTiles: tool({
      description:
        "Hitung kebutuhan keramik dengan tambahan waste dan opsional jumlah dus.",
      inputSchema: z.object({
        areaM2: z.number().positive(),
        wastePercent: z.number().nonnegative().optional(),
        boxCoverageM2: z.number().positive().optional(),
      }),
      execute: calculateTiles,
    }),
    calculateSubtotal: tool({
      description:
        "Hitung subtotal dari item produk yang sudah dipilih dari hasil searchProducts.",
      inputSchema: z.object({
        items: z.array(subtotalItemSchema).min(1),
      }),
      execute: ({ items }) =>
        calculateSubtotal(
          items.map((item) => ({
            productId: item.productId,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
        ),
    }),
    calculateInstallment: tool({
      description:
        "Hitung estimasi cicilan dari subtotal. interestRate boleh decimal (0.03) atau persen (3).",
      inputSchema: z.object({
        total: z.number().positive(),
        months: z.number().int().positive(),
        interestRate: z.number().nonnegative().optional(),
      }),
      execute: calculateInstallment,
    }),
    saveQuotation: tool({
      description:
        "Simpan quotation/shopping list untuk user yang sedang login.",
      inputSchema: z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        category: z.string().nullable().optional(),
        areaM2: z.number().positive().nullable().optional(),
        projectId: z.string().nullable().optional(),
        subtotal: z.number().nonnegative(),
        installmentMonths: z.number().int().positive().nullable().optional(),
        installmentAmount: z.number().nonnegative().nullable().optional(),
        items: z
          .array(
            subtotalItemSchema.extend({
              unit: z.string(),
            }),
          )
          .min(1),
      }),
      execute: async (input) => {
        const supabase = await createUserContextSupabaseClient(request);
        return saveQuotationWithClient(supabase, input);
      },
    }),
  };
}
