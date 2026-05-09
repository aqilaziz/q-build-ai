import { createServiceSupabaseClient, resolveSupabaseUrl } from "./supabase-env.mjs";

const ZERO_EMBEDDING_1536 = `[${Array.from({ length: 1536 }, () => "0").join(",")}]`;

const supabaseUrl = resolveSupabaseUrl();
let supabase;
try {
  supabase = createServiceSupabaseClient();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Supabase target: ${supabaseUrl}`);

const { count, error: productsError } = await supabase
  .from("products")
  .select("id", { count: "exact" })
  .limit(1);

if (productsError) {
  console.error("Products table check failed:", formatSupabaseError(productsError));
  console.error(
    "Schema belum tersedia atau key/URL salah. Apply migration dulu sebelum seed/verifikasi data."
  );
  process.exit(2);
}

console.log(`Products table reachable. Current rows: ${count ?? 0}.`);

const { error: rpcError } = await supabase.rpc("match_products", {
  query_embedding: ZERO_EMBEDDING_1536,
  match_threshold: -1,
  match_count: 1,
  category_filter: null
});

if (rpcError) {
  console.error("match_products RPC check failed:", formatSupabaseError(rpcError));
  process.exit(2);
}

console.log("match_products RPC reachable.");
console.log("Service role connection verified.");

function formatSupabaseError(error) {
  return [error.code, error.message, error.details].filter(Boolean).join(" | ");
}
