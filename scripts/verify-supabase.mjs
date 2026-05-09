import { createServiceSupabaseClient, resolveSupabaseUrl } from "./supabase-env.mjs";

const ZERO_EMBEDDING_1536 = `[${Array.from({ length: 1536 }, () => "0").join(",")}]`;
const allowMissingEmbeddings = process.argv.includes("--allow-missing-embeddings");

await main();

async function main() {
  const supabaseUrl = resolveSupabaseUrl();
  let supabase;
  try {
    supabase = createServiceSupabaseClient();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Supabase target: ${supabaseUrl}`);

  const { count: productCount, error: productsError } = await supabase
    .from("products")
    .select("id", { count: "exact" })
    .limit(1);

  if (productsError) {
    console.error("Products table check failed:", formatSupabaseError(productsError));
    console.error(
      "Schema belum tersedia atau key/URL salah. Apply migration dulu sebelum seed/verifikasi data."
    );
    process.exitCode = 2;
    return;
  }

  console.log(`Products table reachable. Current rows: ${productCount ?? 0}.`);

  const productStats = await loadProductEmbeddingStats(supabase);
  if (productStats.error) {
    console.error("Product embedding check failed:", formatSupabaseError(productStats.error));
    process.exitCode = 2;
    return;
  }

  const { inStockCount, embeddedInStockCount, missingInStockCount } = productStats;
  console.log(`In-stock products: ${inStockCount}.`);
  console.log(`In-stock products with embeddings: ${embeddedInStockCount}.`);
  console.log(`In-stock products missing embeddings: ${missingInStockCount}.`);

  const { error: rpcError } = await supabase.rpc("match_products", {
    query_embedding: ZERO_EMBEDDING_1536,
    match_threshold: -1,
    match_count: 1,
    category_filter: null
  });

  if (rpcError) {
    console.error("match_products RPC check failed:", formatSupabaseError(rpcError));
    process.exitCode = 2;
    return;
  }

  console.log("match_products RPC reachable.");

  if (inStockCount === 0) {
    const message = "No in-stock products found; semantic RAG is not ready.";
    if (!allowMissingEmbeddings) {
      console.error(message);
      console.error("Run npm run seed:products, then npm run embeddings:products.");
      process.exitCode = 3;
      return;
    }
    console.warn(`${message} Continuing because --allow-missing-embeddings is set.`);
  } else if (missingInStockCount > 0) {
    const message = "Product embeddings are incomplete; semantic RAG is not ready.";
    if (!allowMissingEmbeddings) {
      console.error(message);
      console.error("Run npm run embeddings:products, then rerun npm run supabase:verify.");
      process.exitCode = 3;
      return;
    }
    console.warn(`${message} Continuing because --allow-missing-embeddings is set.`);
  }

  if (embeddedInStockCount > 0) {
    const semanticCheck = await verifySemanticMatch(supabase);
    if (semanticCheck.error) {
      console.error("Semantic match_products check failed:", formatSupabaseError(semanticCheck.error));
      process.exitCode = 2;
      return;
    }

    if (semanticCheck.count === 0) {
      console.error("Semantic match_products returned no rows for an embedded product sample.");
      process.exitCode = 3;
      return;
    }

    console.log(
      `Semantic match_products returned ${semanticCheck.count} rows for sample "${semanticCheck.sampleName}".`
    );
  }

  console.log("Service role connection verified.");
}

async function loadProductEmbeddingStats(supabase) {
  const [inStockResult, embeddedResult] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("stock_status", "in_stock"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("stock_status", "in_stock")
      .not("embedding", "is", null)
  ]);

  if (inStockResult.error) {
    return { error: inStockResult.error };
  }

  if (embeddedResult.error) {
    return { error: embeddedResult.error };
  }

  const inStockCount = inStockResult.count ?? 0;
  const embeddedInStockCount = embeddedResult.count ?? 0;

  return {
    inStockCount,
    embeddedInStockCount,
    missingInStockCount: Math.max(inStockCount - embeddedInStockCount, 0)
  };
}

async function verifySemanticMatch(supabase) {
  const { data: sample, error: sampleError } = await supabase
    .from("products")
    .select("name, embedding")
    .eq("stock_status", "in_stock")
    .not("embedding", "is", null)
    .limit(1)
    .single();

  if (sampleError) {
    return { error: sampleError };
  }

  const { data, error } = await supabase.rpc("match_products", {
    query_embedding: sample.embedding,
    match_threshold: 0.7,
    match_count: 3,
    category_filter: null
  });

  if (error) {
    return { error };
  }

  return {
    count: Array.isArray(data) ? data.length : 0,
    sampleName: sample.name
  };
}

function formatSupabaseError(error) {
  return [error.code, error.message, error.details].filter(Boolean).join(" | ");
}
