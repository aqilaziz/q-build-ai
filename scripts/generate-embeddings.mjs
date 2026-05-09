import { productEmbeddingText } from "./product-data.mjs";
import { createServiceSupabaseClient, resolveSupabaseUrl } from "./supabase-env.mjs";

const BATCH_SIZE = 16;
const force = process.argv.includes("--force");

const embeddingApiKey =
  process.env.AI_EMBEDDING_API_KEY ??
  process.env.AI_API_KEY ??
  process.env.OPENAI_API_KEY;
const embeddingBaseUrl =
  process.env.AI_EMBEDDING_BASE_URL ??
  process.env.AI_BASE_URL ??
  process.env.OPENAI_BASE_URL ??
  "https://api.openai.com/v1";
const hasCustomAIConfig = Boolean(
  process.env.AI_BASE_URL || process.env.AI_API_KEY || process.env.AI_MODEL
);
const embeddingModel =
  process.env.AI_EMBEDDING_MODEL ??
  process.env.OPENAI_EMBEDDING_MODEL ??
  (hasCustomAIConfig ? undefined : "text-embedding-3-small");

if (!embeddingApiKey || !embeddingModel) {
  console.log(
    "Embedding env belum dikonfigurasi. Lewati generate embeddings; runtime akan memakai fallback keyword search.",
  );
  process.exit(0);
}

let supabase;
try {
  supabase = createServiceSupabaseClient();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Supabase target: ${resolveSupabaseUrl()}`);

let query = supabase
  .from("products")
  .select("id,name,category,brand,description,use_cases,coverage_note,metadata")
  .eq("stock_status", "in_stock")
  .order("category", { ascending: true })
  .order("name", { ascending: true });

if (!force) {
  query = query.is("embedding", null);
}

const { data: products, error: selectError } = await query;

if (selectError) {
  console.error("Failed to load products:", selectError.message);
  process.exit(1);
}

if (!products?.length) {
  console.log(force ? "No in-stock products found." : "All in-stock products already have embeddings.");
  process.exit(0);
}

for (let start = 0; start < products.length; start += BATCH_SIZE) {
  const batch = products.slice(start, start + BATCH_SIZE);
  const inputs = batch.map(productEmbeddingText);
  const embeddings = await createEmbeddings(inputs);

  for (const item of embeddings) {
    const product = batch[item.index];
    const vectorLiteral = `[${item.embedding.join(",")}]`;
    const { error: updateError } = await supabase
      .from("products")
      .update({ embedding: vectorLiteral })
      .eq("id", product.id);

    if (updateError) {
      console.error(`Failed to update embedding for ${product.name}:`, updateError.message);
      process.exit(1);
    }
  }

  console.log(`Embedded ${Math.min(start + BATCH_SIZE, products.length)} / ${products.length} products.`);
}

async function createEmbeddings(input) {
  const response = await fetch(`${withoutTrailingSlash(embeddingBaseUrl)}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${embeddingApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: embeddingModel,
      input
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.data.sort((a, b) => a.index - b.index);
}

function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
