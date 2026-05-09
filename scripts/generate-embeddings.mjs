import { productEmbeddingText } from "./product-data.mjs";
import { createServiceSupabaseClient, resolveSupabaseUrl } from "./supabase-env.mjs";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 16;
const force = process.argv.includes("--force");

const openAiKey = process.env.OPENAI_API_KEY;

if (!openAiKey) {
  console.error("Missing OPENAI_API_KEY.");
  process.exit(1);
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
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
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
