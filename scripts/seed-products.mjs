import { products } from "./product-data.mjs";
import { createServiceSupabaseClient, resolveSupabaseUrl } from "./supabase-env.mjs";

let supabase;
try {
  supabase = createServiceSupabaseClient();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Supabase target: ${resolveSupabaseUrl()}`);

const { error } = await supabase
  .from("products")
  .upsert(products, { onConflict: "id" });

if (error) {
  console.error("Failed to seed products:", error.message);
  process.exit(1);
}

console.log(`Seeded ${products.length} products.`);
