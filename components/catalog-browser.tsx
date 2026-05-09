"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  PackageSearch,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/components/quote-data";

export type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  description: string;
  use_cases: string[] | null;
  unit: string;
  price: number;
  stock_status: string;
  coverage_note: string | null;
  image_path?: string | null;
  image_alt?: string | null;
};

type CatalogBrowserProps = {
  products: CatalogProduct[];
  error?: string;
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function categoryLabel(category: string) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function productImageUrl(path?: string | null) {
  if (!path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return baseUrl
    ? `${baseUrl}/storage/v1/object/public/product-images/${encodeURI(path)}`
    : null;
}

export function CatalogBrowser({ products, error }: CatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const cleanQuery = normalize(query);

    return products.filter((product) => {
      const matchesCategory =
        category === "all" || product.category === category;
      const haystack = normalize(
        [
          product.name,
          product.category,
          product.brand ?? "",
          product.description,
          product.coverage_note ?? "",
          ...(product.use_cases ?? []),
        ].join(" "),
      );

      return matchesCategory && (!cleanQuery || haystack.includes(cleanQuery));
    });
  }, [category, products, query]);

  return (
    <main className="min-h-screen bg-[#f5f6f1] text-[#171b17]">
      <div className="mx-auto w-full max-w-6xl px-4 py-4">
        <header className="flex items-center justify-between gap-3 border-b border-[#d9ded2] pb-4">
          <Link
            href="/"
            className="inline-flex size-10 items-center justify-center rounded-md border border-[#cbd3c4] bg-white"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-[#52645c]">
              Q-Build AI
            </p>
            <h1 className="truncate text-xl font-bold">Katalog produk</h1>
          </div>
          <PackageSearch className="text-[#174832]" size={23} />
        </header>

        <section className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_150px]">
          <label className="flex min-h-12 items-center gap-2 rounded-lg border border-[#cbd3c4] bg-white px-3">
            <Search className="shrink-0 text-[#52645c]" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Cari produk, kegunaan, brand..."
              aria-label="Cari katalog"
            />
          </label>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-h-12 rounded-lg border border-[#cbd3c4] bg-white px-3 text-sm font-semibold text-[#26342b] outline-none"
            aria-label="Filter kategori"
          >
            <option value="all">Semua kategori</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {categoryLabel(item)}
              </option>
            ))}
          </select>

          <div className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#d9ded2] bg-[#edf5ee] px-3 text-sm font-bold text-[#174832]">
            <Boxes size={18} />
            {filteredProducts.length} produk
          </div>
        </section>

        {error ? (
          <section className="mt-4 rounded-lg border border-[#efb8a8] bg-[#fff4ef] p-4 text-sm text-[#8a321d]">
            {error}
          </section>
        ) : null}

        <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <article
              key={product.id}
              className="rounded-lg border border-[#d9ded2] bg-white p-4"
            >
              {product.image_path ? (
                <div className="mb-3 aspect-[4/3] overflow-hidden rounded-md bg-[#edf5ee]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImageUrl(product.image_path) ?? ""}
                    alt={product.image_alt ?? product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-[#52645c]">
                    {categoryLabel(product.category)}
                  </p>
                  <h2 className="mt-1 line-clamp-2 font-bold">{product.name}</h2>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#edf5ee] px-2 py-1 text-xs font-bold text-[#174832]">
                  <CheckCircle2 size={13} />
                  Stok
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-[#52645c]">
                {product.description}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-[#fafbf8] p-3">
                  <p className="text-xs font-semibold uppercase text-[#52645c]">
                    Harga
                  </p>
                  <p className="mt-1 font-bold">
                    {formatCurrency(product.price)}
                  </p>
                </div>
                <div className="rounded-md bg-[#fafbf8] p-3">
                  <p className="text-xs font-semibold uppercase text-[#52645c]">
                    Unit
                  </p>
                  <p className="mt-1 font-bold">{product.unit}</p>
                </div>
              </div>

              {product.coverage_note ? (
                <p className="mt-3 text-sm leading-5 text-[#52645c]">
                  {product.coverage_note}
                </p>
              ) : null}

              {product.use_cases?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.use_cases.slice(0, 4).map((useCase) => (
                    <span
                      key={useCase}
                      className="rounded-md border border-[#d9ded2] px-2 py-1 text-xs font-medium text-[#52645c]"
                    >
                      {useCase}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>

        {filteredProducts.length === 0 ? (
          <section className="mt-4 rounded-lg border border-[#d9ded2] bg-white p-6 text-center">
            <p className="font-bold">Produk tidak ditemukan</p>
            <p className="mt-2 text-sm text-[#52645c]">
              Coba kata kunci lain atau pilih semua kategori.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
