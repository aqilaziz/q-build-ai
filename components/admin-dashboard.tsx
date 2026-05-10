"use client";

import Link from "next/link";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Layers3,
  Loader2,
  LogIn,
  LogOut,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/components/quote-data";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

type Label = {
  id: string;
  slug: string;
  name: string;
  color: string;
  is_active: boolean;
};

type Product = {
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
  image_path: string | null;
  image_alt: string | null;
  image_url: string | null;
  label_ids: string[];
};

type CatalogData = {
  products: Product[];
  categories: Category[];
  labels: Label[];
};

type ProductForm = {
  id: string;
  name: string;
  category: string;
  brand: string;
  description: string;
  use_cases: string;
  unit: string;
  price: string;
  stock_status: string;
  coverage_note: string;
  image_path: string;
  image_alt: string;
  label_ids: string[];
};

const emptyProductForm: ProductForm = {
  id: "",
  name: "",
  category: "",
  brand: "",
  description: "",
  use_cases: "",
  unit: "",
  price: "",
  stock_status: "in_stock",
  coverage_note: "",
  image_path: "",
  image_alt: "",
  label_ids: [],
};

function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Konfigurasi Supabase publik belum lengkap.");
  }
  return createClient(url, key);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function productToForm(product: Product): ProductForm {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    brand: product.brand ?? "",
    description: product.description,
    use_cases: product.use_cases?.join(", ") ?? "",
    unit: product.unit,
    price: String(product.price),
    stock_status: product.stock_status,
    coverage_note: product.coverage_note ?? "",
    image_path: product.image_path ?? "",
    image_alt: product.image_alt ?? "",
    label_ids: product.label_ids ?? [],
  };
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatNumberInput(value: string) {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

function appendProductForm(formData: FormData, form: ProductForm, imageFile: File | null) {
  formData.set("action", "upsertProduct");
  for (const [key, value] of Object.entries(form)) {
    if (key === "label_ids") {
      formData.set(key, form.label_ids.join(","));
    } else if (key === "price") {
      formData.set(key, digitsOnly(String(value)));
    } else {
      formData.set(key, String(value));
    }
  }
  if (imageFile) formData.set("image", imageFile);
}

export function AdminDashboard() {
  const [supabase] = useState(() => getSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("admin@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [data, setData] = useState<CatalogData | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    slug: "",
    description: "",
    sort_order: "100",
    is_active: true,
  });
  const [labelForm, setLabelForm] = useState({
    id: "",
    name: "",
    slug: "",
    color: "#174832",
    is_active: true,
  });

  const token = session?.access_token;

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: result }) => {
      if (!mounted) return;
      setSession(result.session);
      setLoading(false);
      if (result.session) void loadCatalog(result.session.access_token);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void loadCatalog(nextSession.access_token);
      else setData(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const filteredProducts = useMemo(() => {
    const clean = query.toLowerCase().trim();
    if (!data) return [];
    return data.products.filter((product) =>
      [
        product.name,
        product.category,
        product.brand ?? "",
        product.description,
        product.stock_status,
        ...(product.use_cases ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(clean),
    );
  }, [data, query]);

  async function loadCatalog(accessToken = token) {
    if (!accessToken) return;
    setError("");
    const response = await fetch("/api/admin/catalog", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Gagal memuat admin catalog.");
      setLoading(false);
      return;
    }
    setData(payload);
    setLoading(false);
    if (!productForm.category && payload.categories?.[0]) {
      setProductForm((current) => ({
        ...current,
        category: payload.categories[0].slug,
      }));
    }
  }

  async function submitForm(formData: FormData, successMessage: string) {
    if (!token) return;
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(payload.error ?? "Operasi admin gagal.");
      return;
    }
    setMessage(successMessage);
    await loadCatalog();
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setSaving(false);
    if (loginError) setError(loginError.message);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setData(null);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    appendProductForm(formData, productForm, imageFile);
    await submitForm(formData, productForm.id ? "Produk diperbarui." : "Produk dibuat.");
    setImageFile(null);
    setProductForm({
      ...emptyProductForm,
      category: data?.categories[0]?.slug ?? "",
    });
  }

  async function deleteProduct(product: Product) {
    if (!confirm(`Hapus produk "${product.name}"?`)) return;
    const formData = new FormData();
    formData.set("action", "deleteProduct");
    formData.set("id", product.id);
    await submitForm(formData, "Produk dihapus.");
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("action", "upsertCategory");
    formData.set("id", categoryForm.id);
    formData.set("name", categoryForm.name);
    formData.set("slug", categoryForm.slug || slugify(categoryForm.name));
    formData.set("description", categoryForm.description);
    formData.set("sort_order", categoryForm.sort_order);
    formData.set("is_active", String(categoryForm.is_active));
    await submitForm(formData, categoryForm.id ? "Kategori diperbarui." : "Kategori dibuat.");
    setCategoryForm({ id: "", name: "", slug: "", description: "", sort_order: "100", is_active: true });
  }

  async function deleteCategory(category: Category) {
    if (!confirm(`Hapus kategori "${category.name}"?`)) return;
    const formData = new FormData();
    formData.set("action", "deleteCategory");
    formData.set("id", category.id);
    await submitForm(formData, "Kategori dihapus.");
  }

  async function saveLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("action", "upsertLabel");
    formData.set("id", labelForm.id);
    formData.set("name", labelForm.name);
    formData.set("slug", labelForm.slug || slugify(labelForm.name));
    formData.set("color", labelForm.color);
    formData.set("is_active", String(labelForm.is_active));
    await submitForm(formData, labelForm.id ? "Label diperbarui." : "Label dibuat.");
    setLabelForm({ id: "", name: "", slug: "", color: "#174832", is_active: true });
  }

  async function deleteLabel(label: Label) {
    if (!confirm(`Hapus label "${label.name}"?`)) return;
    const formData = new FormData();
    formData.set("action", "deleteLabel");
    formData.set("id", label.id);
    await submitForm(formData, "Label dihapus.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f1] text-[#171b17]">
        <Loader2 className="animate-spin text-[#174832]" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f5f6f1] px-4 py-5 text-[#171b17]">
        <div className="mx-auto max-w-md">
          <Link
            href="/"
            className="inline-flex size-10 items-center justify-center rounded-md border border-[#cbd3c4] bg-white"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>
          <section className="mt-6 rounded-lg border border-[#d9ded2] bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-md bg-[#174832] text-white">
                <LogIn size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#52645c]">
                  Admin dashboard
                </p>
                <h1 className="text-xl font-bold">Masuk sebagai admin</h1>
              </div>
            </div>
            <form className="mt-5 space-y-3" onSubmit={handleLogin}>
              <label className="block text-sm font-semibold">
                Email
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  className="mt-1 w-full rounded-md border border-[#cbd3c4] px-3 py-3 text-sm outline-none focus:border-[#174832]"
                />
              </label>
              <label className="block text-sm font-semibold">
                Password
                <span className="mt-1 flex rounded-md border border-[#cbd3c4] bg-white focus-within:border-[#174832]">
                  <input
                    id="admin-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    className="min-w-0 flex-1 rounded-l-md px-3 py-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="inline-flex w-11 items-center justify-center rounded-r-md text-[#52645c]"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {error ? (
                <p className="rounded-md border border-[#efb8a8] bg-[#fff4ef] px-3 py-2 text-sm text-[#8a321d]">
                  {error}
                </p>
              ) : null}
              <button
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#174832] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={17} /> : <LogIn size={17} />}
                Masuk
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6f1] text-[#171b17]">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9ded2] pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex size-10 items-center justify-center rounded-md border border-[#cbd3c4] bg-white"
              aria-label="Kembali"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase text-[#52645c]">
                QHomemart AI Agent
              </p>
              <h1 className="text-xl font-bold">Admin katalog</h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-md border border-[#cbd3c4] bg-white px-3 py-2 text-sm font-bold"
          >
            <LogOut size={16} />
            Keluar
          </button>
        </header>

        {error || message ? (
          <section
            className={`mt-4 rounded-lg border p-3 text-sm ${
              error
                ? "border-[#efb8a8] bg-[#fff4ef] text-[#8a321d]"
                : "border-[#bed7c4] bg-[#edf5ee] text-[#174832]"
            }`}
          >
            {error || message}
          </section>
        ) : null}

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
            <p className="text-xs font-semibold uppercase text-[#52645c]">Produk</p>
            <p className="mt-2 text-2xl font-bold">{data?.products.length ?? 0}</p>
          </div>
          <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
            <p className="text-xs font-semibold uppercase text-[#52645c]">Kategori</p>
            <p className="mt-2 text-2xl font-bold">{data?.categories.length ?? 0}</p>
          </div>
          <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
            <p className="text-xs font-semibold uppercase text-[#52645c]">Label</p>
            <p className="mt-2 text-2xl font-bold">{data?.labels.length ?? 0}</p>
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-[#cbd3c4] bg-white px-3">
                <Search size={17} className="text-[#52645c]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder="Cari produk, brand, kategori..."
                />
              </label>
              <button
                onClick={() =>
                  setProductForm({
                    ...emptyProductForm,
                    category: data?.categories[0]?.slug ?? "",
                  })
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#174832] px-3 text-sm font-bold text-white"
              >
                <Plus size={16} />
                Produk baru
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-[#d9ded2] bg-white">
              <div className="grid grid-cols-[86px_1fr_120px_110px] gap-3 border-b border-[#d9ded2] bg-[#edf5ee] px-3 py-2 text-xs font-bold uppercase text-[#52645c] max-md:hidden">
                <span>Gambar</span>
                <span>Produk</span>
                <span>Harga</span>
                <span>Aksi</span>
              </div>
              <div className="divide-y divide-[#e5e9df]">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id}
                    className="grid gap-3 px-3 py-3 md:grid-cols-[86px_1fr_120px_110px]"
                  >
                    <div className="flex aspect-square w-20 items-center justify-center overflow-hidden rounded-md bg-[#edf5ee]">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_url}
                          alt={product.image_alt ?? product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package size={22} className="text-[#52645c]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold">{product.name}</h2>
                        <span className="rounded-md bg-[#edf5ee] px-2 py-1 text-xs font-bold text-[#174832]">
                          {product.category}
                        </span>
                        <span className="rounded-md border border-[#d9ded2] px-2 py-1 text-xs font-semibold text-[#52645c]">
                          {product.stock_status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#52645c]">
                        {product.description}
                      </p>
                    </div>
                    <p className="font-bold">{formatCurrency(product.price)}</p>
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => setProductForm(productToForm(product))}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-[#cbd3c4] bg-white"
                        aria-label="Edit produk"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => void deleteProduct(product)}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-[#efb8a8] bg-[#fff4ef] text-[#8a321d]"
                        aria-label="Hapus produk"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-[#174832]" />
                <h2 className="font-bold">
                  {productForm.id ? "Edit produk" : "Produk baru"}
                </h2>
              </div>
              <form className="mt-4 space-y-3" onSubmit={saveProduct}>
                <input type="hidden" value={productForm.id} />
                <Field label="Nama produk">
                  <input
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm({ ...productForm, name: event.target.value })
                    }
                    required
                    className="admin-input"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Kategori">
                    <select
                      value={productForm.category}
                      onChange={(event) =>
                        setProductForm({ ...productForm, category: event.target.value })
                      }
                      required
                      className="admin-input"
                    >
                      <option value="">Pilih</option>
                      {data?.categories.map((category) => (
                        <option key={category.id} value={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      value={productForm.stock_status}
                      onChange={(event) =>
                        setProductForm({ ...productForm, stock_status: event.target.value })
                      }
                      className="admin-input"
                    >
                      <option value="in_stock">In stock</option>
                      <option value="out_of_stock">Out of stock</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Brand">
                    <input
                      value={productForm.brand}
                      onChange={(event) =>
                        setProductForm({ ...productForm, brand: event.target.value })
                      }
                      className="admin-input"
                    />
                  </Field>
                  <Field label="Unit">
                    <input
                      value={productForm.unit}
                      onChange={(event) =>
                        setProductForm({ ...productForm, unit: event.target.value })
                      }
                      required
                      className="admin-input"
                    />
                  </Field>
                  <Field label="Harga">
                    <input
                      value={formatNumberInput(productForm.price)}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          price: digitsOnly(event.target.value),
                        })
                      }
                      inputMode="numeric"
                      placeholder="250.000"
                      required
                      className="admin-input"
                    />
                  </Field>
                </div>
                <Field label="Deskripsi">
                  <textarea
                    value={productForm.description}
                    onChange={(event) =>
                      setProductForm({ ...productForm, description: event.target.value })
                    }
                    rows={3}
                    className="admin-input"
                  />
                </Field>
                <Field label="Use cases">
                  <textarea
                    value={productForm.use_cases}
                    onChange={(event) =>
                      setProductForm({ ...productForm, use_cases: event.target.value })
                    }
                    rows={2}
                    placeholder="atap bocor, dak, waterproofing"
                    className="admin-input"
                  />
                </Field>
                <Field label="Coverage note">
                  <input
                    value={productForm.coverage_note}
                    onChange={(event) =>
                      setProductForm({ ...productForm, coverage_note: event.target.value })
                    }
                    className="admin-input"
                  />
                </Field>
                <Field label="Gambar produk">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#cbd3c4] bg-[#fafbf8] px-3 py-3 text-sm font-bold text-[#174832]">
                    <ImagePlus size={17} />
                    {imageFile ? imageFile.name : "Pilih gambar"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </Field>
                <Field label="Alt gambar">
                  <input
                    value={productForm.image_alt}
                    onChange={(event) =>
                      setProductForm({ ...productForm, image_alt: event.target.value })
                    }
                    className="admin-input"
                  />
                </Field>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#52645c]">Label</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data?.labels.map((label) => {
                      const active = productForm.label_ids.includes(label.id);
                      return (
                        <button
                          key={label.id}
                          type="button"
                          onClick={() =>
                            setProductForm((current) => ({
                              ...current,
                              label_ids: active
                                ? current.label_ids.filter((id) => id !== label.id)
                                : [...current.label_ids, label.id],
                            }))
                          }
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${
                            active
                              ? "border-[#174832] bg-[#edf5ee] text-[#174832]"
                              : "border-[#d9ded2] text-[#52645c]"
                          }`}
                        >
                          {active ? <Check size={12} /> : null}
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#174832] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                  Simpan produk
                </button>
              </form>
            </section>

            <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
              <div className="flex items-center gap-2">
                <Layers3 size={18} className="text-[#174832]" />
                <h2 className="font-bold">Kategori</h2>
              </div>
              <form className="mt-3 grid gap-2" onSubmit={saveCategory}>
                <input
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      name: event.target.value,
                      slug: categoryForm.slug || slugify(event.target.value),
                    })
                  }
                  placeholder="Nama kategori"
                  className="admin-input"
                />
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <input
                    value={categoryForm.slug}
                    onChange={(event) =>
                      setCategoryForm({ ...categoryForm, slug: slugify(event.target.value) })
                    }
                    placeholder="slug"
                    className="admin-input"
                  />
                  <input
                    value={categoryForm.sort_order}
                    onChange={(event) =>
                      setCategoryForm({ ...categoryForm, sort_order: event.target.value })
                    }
                    type="number"
                    className="admin-input"
                  />
                </div>
                <button className="inline-flex items-center justify-center gap-2 rounded-md bg-[#174832] px-3 py-2 text-sm font-bold text-white">
                  <Save size={15} />
                  Simpan kategori
                </button>
              </form>
              <ListRows>
                {data?.categories.map((category) => (
                  <Row key={category.id}>
                    <span>{category.name}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setCategoryForm({
                            id: category.id,
                            name: category.name,
                            slug: category.slug,
                            description: category.description ?? "",
                            sort_order: String(category.sort_order),
                            is_active: category.is_active,
                          })
                        }
                        className="row-action"
                      >
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => void deleteCategory(category)} className="row-action-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Row>
                ))}
              </ListRows>
            </section>

            <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-[#174832]" />
                <h2 className="font-bold">Label</h2>
              </div>
              <form className="mt-3 grid gap-2" onSubmit={saveLabel}>
                <input
                  value={labelForm.name}
                  onChange={(event) =>
                    setLabelForm({
                      ...labelForm,
                      name: event.target.value,
                      slug: labelForm.slug || slugify(event.target.value),
                    })
                  }
                  placeholder="Nama label"
                  className="admin-input"
                />
                <div className="grid grid-cols-[1fr_70px] gap-2">
                  <input
                    value={labelForm.slug}
                    onChange={(event) =>
                      setLabelForm({ ...labelForm, slug: slugify(event.target.value) })
                    }
                    placeholder="slug"
                    className="admin-input"
                  />
                  <input
                    value={labelForm.color}
                    onChange={(event) =>
                      setLabelForm({ ...labelForm, color: event.target.value })
                    }
                    type="color"
                    className="h-10 rounded-md border border-[#cbd3c4] bg-white p-1"
                  />
                </div>
                <button className="inline-flex items-center justify-center gap-2 rounded-md bg-[#174832] px-3 py-2 text-sm font-bold text-white">
                  <Save size={15} />
                  Simpan label
                </button>
              </form>
              <ListRows>
                {data?.labels.map((label) => (
                  <Row key={label.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-3 rounded-sm"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setLabelForm({
                            id: label.id,
                            name: label.name,
                            slug: label.slug,
                            color: label.color,
                            is_active: label.is_active,
                          })
                        }
                        className="row-action"
                      >
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => void deleteLabel(label)} className="row-action-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Row>
                ))}
              </ListRows>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ListRows({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 divide-y divide-[#e5e9df]">{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 text-sm">
      {children}
    </div>
  );
}
