import {
  CatalogBrowser,
  type CatalogProduct,
} from "@/components/catalog-browser";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductRow = Omit<CatalogProduct, "price"> & {
  price: number | string;
};

export default async function CatalogPage() {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,category,brand,description,use_cases,unit,price,stock_status,coverage_note,image_path,image_alt",
    )
    .eq("stock_status", "in_stock")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const products = ((data ?? []) as ProductRow[]).map((product) => ({
    ...product,
    price: Number(product.price),
  }));

  return (
    <CatalogBrowser
      products={products}
      error={error ? `Gagal memuat katalog: ${error.message}` : undefined}
    />
  );
}
