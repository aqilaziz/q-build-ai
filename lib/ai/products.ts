import { embed } from "ai";
import { getEmbeddingModel } from "@/lib/ai/provider";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import type { ProductSearchResult } from "@/types/domain";

const FALLBACK_SEARCH_ROW_LIMIT = 100;

type MatchProductRow = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  description: string;
  unit: string;
  price: number | string;
  stock_status: string;
  coverage_note: string | null;
  similarity: number | string | null;
};

type ProductRow = Omit<MatchProductRow, "similarity"> & {
  use_cases: string[] | null;
};

export async function searchProducts({
  query,
  category,
  limit = 5,
}: {
  query: string;
  category?: string | null;
  limit?: number;
}): Promise<{ products: ProductSearchResult[]; count: number }> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { products: [], count: 0 };
  }

  const semanticResult = await searchProductsByEmbedding({
    query: cleanQuery,
    category,
    limit,
  }).catch(() => null);

  if (semanticResult?.products.length) {
    return semanticResult;
  }

  return searchProductsByKeyword({
    query: cleanQuery,
    category,
    limit,
  });
}

async function searchProductsByEmbedding({
  query,
  category,
  limit,
}: {
  query: string;
  category?: string | null;
  limit: number;
}) {
  const model = getEmbeddingModel();
  if (!model) {
    return null;
  }

  const { embedding } = await embed({
    model,
    value: query,
  });

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("match_products", {
    query_embedding: embedding,
    match_threshold: 0.25,
    match_count: Math.min(Math.max(limit, 1), 10),
    category_filter: category || null,
  });

  if (error) {
    throw new Error(`Gagal mencari produk: ${error.message}`);
  }

  const rows = (data ?? []) as MatchProductRow[];
  const products = rows.map((row) => mapProductRow(row, {
    reason: `Cocok dengan pencarian "${query}"${category ? ` pada kategori ${category}` : ""}.`,
    similarity: row.similarity === null ? null : Number(row.similarity),
  }));

  return {
    products,
    count: products.length,
  };
}

async function searchProductsByKeyword({
  query,
  category,
  limit,
}: {
  query: string;
  category?: string | null;
  limit: number;
}) {
  const supabase = createPublicSupabaseClient();
  let request = supabase
    .from("products")
    .select(
      "id,name,category,brand,description,use_cases,unit,price,stock_status,coverage_note",
    )
    .eq("stock_status", "in_stock")
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .limit(FALLBACK_SEARCH_ROW_LIMIT);

  if (category) {
    request = request.eq("category", category);
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(`Gagal mencari produk: ${error.message}`);
  }

  const tokens = expandTokens(tokenize(query));
  const rows = ((data ?? []) as ProductRow[])
    .map((row) => ({ row, score: scoreProduct(row, query, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
    .slice(0, Math.min(Math.max(limit, 1), 10));

  const products = rows.map(({ row }) =>
    mapProductRow(row, {
      reason: `Cocok dengan kata kunci "${query}"${category ? ` pada kategori ${category}` : ""}.`,
      similarity: null,
    }),
  );

  return {
    products,
    count: products.length,
  };
}

function mapProductRow(
  row: MatchProductRow | ProductRow,
  {
    reason,
    similarity,
  }: {
    reason: string;
    similarity: number | null;
  },
): ProductSearchResult {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    description: row.description,
    unit: row.unit,
    price: Number(row.price),
    stock_status: row.stock_status,
    coverage_note: row.coverage_note,
    similarity,
    reason,
  };
}

function scoreProduct(row: ProductRow, query: string, tokens: string[]) {
  const normalizedQuery = normalize(query);
  const name = normalize(row.name);
  const category = normalize(row.category);
  const brand = normalize(row.brand ?? "");
  const description = normalize(row.description);
  const useCases = normalize((row.use_cases ?? []).join(" "));
  const coverage = normalize(row.coverage_note ?? "");
  const allText = [name, category, brand, description, useCases, coverage].join(
    " ",
  );

  let score = allText.includes(normalizedQuery) ? 10 : 0;

  for (const token of tokens) {
    if (name.includes(token)) score += 5;
    if (category.includes(token)) score += 4;
    if (useCases.includes(token)) score += 4;
    if (description.includes(token)) score += 2;
    if (coverage.includes(token)) score += 1;
    if (brand.includes(token)) score += 1;
  }

  return score;
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function expandTokens(tokens: string[]) {
  const synonyms: Record<string, string[]> = {
    atap: ["roof", "dak", "waterproofing"],
    bocor: ["rembes", "waterproofing", "sealant", "talang"],
    cat: ["paint", "primer", "roller", "kuas"],
    dinding: ["wall", "putty", "skim", "cement", "cat"],
    keramik: ["tile", "tiles", "ubin", "grout", "adhesive"],
    pipa: ["plumbing", "pvc", "elbow", "glue"],
    rembes: ["bocor", "waterproofing", "sealant"],
    ubin: ["tile", "tiles", "keramik", "grout"],
  };

  return [...new Set(tokens.flatMap((token) => [token, ...(synonyms[token] ?? [])]))];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}
