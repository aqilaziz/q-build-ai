import { AdminAuthError, requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_IMAGES_BUCKET = "product-images";

type ProductRow = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  description: string;
  use_cases: string[] | null;
  unit: string;
  price: number | string;
  stock_status: string;
  coverage_note: string | null;
  image_path: string | null;
  image_alt: string | null;
  created_at: string;
  updated_at: string | null;
};

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(form: FormData, name: string) {
  const value = text(form, name);
  return value ? value : null;
}

function bool(form: FormData, name: string, fallback = true) {
  const value = text(form, name);
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "on";
}

function numberValue(form: FormData, name: string, fallback = 0) {
  const value = Number(text(form, name));
  return Number.isFinite(value) ? value : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function listValue(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function publicImageUrl(path: string | null) {
  if (!path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return baseUrl
    ? `${baseUrl}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encodeURI(path)}`
    : null;
}

function fileExtension(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return byType[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "jpg";
}

function detectImageExtension(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.subarray(0, 3).toString("ascii") === "GIF") {
    return "gif";
  }
  return null;
}

function contentTypeForExtension(extension: string) {
  const byExtension: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return byExtension[extension] ?? "application/octet-stream";
}

async function uploadImage(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedExtension = detectImageExtension(buffer);
  const extension = detectedExtension ?? fileExtension(file);
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const unknownMime = !file.type || file.type === "application/octet-stream";
  if (file.type && !file.type.startsWith("image/") && !unknownMime) {
    throw new Error("File gambar harus bertipe image.");
  }
  if (!allowedExtensions.has(extension)) {
    throw new Error("File gambar harus bertipe image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran gambar maksimal 5 MB.");
  }

  const supabase = createServiceSupabaseClient();
  const path = `products/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, buffer, {
      contentType:
        file.type && !unknownMime ? file.type : contentTypeForExtension(extension),
      upsert: false,
    });

  if (error) throw new Error(error.message);
  return path;
}

async function loadCatalog() {
  const supabase = createServiceSupabaseClient();
  const [productsResult, categoriesResult, labelsResult, linksResult] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id,name,category,brand,description,use_cases,unit,price,stock_status,coverage_note,image_path,image_alt,created_at,updated_at",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("product_categories")
        .select("id,slug,name,description,sort_order,is_active,created_at,updated_at")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("product_labels")
        .select("id,slug,name,color,is_active,created_at,updated_at")
        .order("name", { ascending: true }),
      supabase
        .from("product_label_links")
        .select("product_id,label_id"),
    ]);

  const error =
    productsResult.error ??
    categoriesResult.error ??
    labelsResult.error ??
    linksResult.error;
  if (error) throw new Error(error.message);

  const labelIdsByProduct = new Map<string, string[]>();
  for (const link of linksResult.data ?? []) {
    const current = labelIdsByProduct.get(link.product_id) ?? [];
    current.push(link.label_id);
    labelIdsByProduct.set(link.product_id, current);
  }

  return {
    products: ((productsResult.data ?? []) as ProductRow[]).map((product) => ({
      ...product,
      price: Number(product.price),
      image_url: publicImageUrl(product.image_path),
      label_ids: labelIdsByProduct.get(product.id) ?? [],
    })),
    categories: categoriesResult.data ?? [],
    labels: labelsResult.data ?? [],
  };
}

async function upsertCategory(form: FormData) {
  const supabase = createServiceSupabaseClient();
  const id = text(form, "id");
  const name = text(form, "name");
  const slug = slugify(text(form, "slug") || name);
  if (!name || !slug) throw new Error("Nama dan slug kategori wajib diisi.");

  const payload = {
    slug,
    name,
    description: nullableText(form, "description"),
    sort_order: numberValue(form, "sort_order", 100),
    is_active: bool(form, "is_active", true),
  };

  const result = id
    ? await supabase.from("product_categories").update(payload).eq("id", id)
    : await supabase.from("product_categories").insert(payload);
  if (result.error) throw new Error(result.error.message);
}

async function deleteCategory(form: FormData) {
  const supabase = createServiceSupabaseClient();
  const id = text(form, "id");
  if (!id) throw new Error("ID kategori wajib diisi.");
  const { error } = await supabase.from("product_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function upsertLabel(form: FormData) {
  const supabase = createServiceSupabaseClient();
  const id = text(form, "id");
  const name = text(form, "name");
  const slug = slugify(text(form, "slug") || name);
  if (!name || !slug) throw new Error("Nama dan slug label wajib diisi.");

  const payload = {
    slug,
    name,
    color: text(form, "color") || "#174832",
    is_active: bool(form, "is_active", true),
  };

  const result = id
    ? await supabase.from("product_labels").update(payload).eq("id", id)
    : await supabase.from("product_labels").insert(payload);
  if (result.error) throw new Error(result.error.message);
}

async function deleteLabel(form: FormData) {
  const supabase = createServiceSupabaseClient();
  const id = text(form, "id");
  if (!id) throw new Error("ID label wajib diisi.");
  const { error } = await supabase.from("product_labels").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function upsertProduct(form: FormData) {
  const supabase = createServiceSupabaseClient();
  const id = text(form, "id");
  const name = text(form, "name");
  const category = text(form, "category");
  const unit = text(form, "unit");
  const price = numberValue(form, "price");
  const image = form.get("image");

  if (!name || !category || !unit) {
    throw new Error("Nama, kategori, dan unit produk wajib diisi.");
  }

  let existingImagePath = nullableText(form, "image_path");
  if (image instanceof File && image.size > 0) {
    const nextImagePath = await uploadImage(image);
    if (existingImagePath) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([existingImagePath]);
    }
    existingImagePath = nextImagePath;
  }

  const payload = {
    name,
    category,
    brand: nullableText(form, "brand"),
    description: text(form, "description"),
    use_cases: listValue(text(form, "use_cases")),
    unit,
    price,
    stock_status: text(form, "stock_status") || "in_stock",
    coverage_note: nullableText(form, "coverage_note"),
    image_path: existingImagePath,
    image_alt: nullableText(form, "image_alt"),
    embedding: null,
  };

  const result = id
    ? await supabase.from("products").update(payload).eq("id", id).select("id").single()
    : await supabase.from("products").insert(payload).select("id").single();
  if (result.error) throw new Error(result.error.message);

  const productId = result.data.id;
  const labelIds = listValue(text(form, "label_ids"));
  const deleteResult = await supabase
    .from("product_label_links")
    .delete()
    .eq("product_id", productId);
  if (deleteResult.error) throw new Error(deleteResult.error.message);

  if (labelIds.length > 0) {
    const insertResult = await supabase.from("product_label_links").insert(
      labelIds.map((labelId) => ({
        product_id: productId,
        label_id: labelId,
      })),
    );
    if (insertResult.error) throw new Error(insertResult.error.message);
  }
}

async function deleteProduct(form: FormData) {
  const supabase = createServiceSupabaseClient();
  const id = text(form, "id");
  if (!id) throw new Error("ID produk wajib diisi.");

  const { data } = await supabase
    .from("products")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (data?.image_path) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([data.image_path]);
  }
}

async function deleteProducts(form: FormData) {
  const supabase = createServiceSupabaseClient();
  const ids = [...new Set(listValue(text(form, "ids")))];
  if (ids.length === 0) throw new Error("Pilih minimal satu produk.");

  const { data, error: selectError } = await supabase
    .from("products")
    .select("image_path")
    .in("id", ids);
  if (selectError) throw new Error(selectError.message);

  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) throw new Error(error.message);

  const imagePaths = (data ?? [])
    .map((product) => product.image_path)
    .filter((path): path is string => Boolean(path));
  if (imagePaths.length > 0) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(imagePaths);
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return Response.json(await loadCatalog());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const form = await request.formData();
    const action = text(form, "action");

    if (action === "upsertCategory") await upsertCategory(form);
    else if (action === "deleteCategory") await deleteCategory(form);
    else if (action === "upsertLabel") await upsertLabel(form);
    else if (action === "deleteLabel") await deleteLabel(form);
    else if (action === "upsertProduct") await upsertProduct(form);
    else if (action === "deleteProduct") await deleteProduct(form);
    else if (action === "deleteProducts") await deleteProducts(form);
    else throw new Error("Action admin tidak dikenal.");

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Request admin gagal diproses.",
    },
    { status: 400 },
  );
}
