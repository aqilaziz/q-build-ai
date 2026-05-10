import { AdminAuthError, requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

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

type CatalogPayload = Awaited<ReturnType<typeof loadCatalog>>;

type ImportProductRow = {
  id?: string;
  name: string;
  category: string;
  brand?: string | null;
  description?: string;
  use_cases?: string[] | null;
  unit: string;
  price: number;
  stock_status?: string;
  coverage_note?: string | null;
  image_path?: string | null;
  image_alt?: string | null;
  labels?: string[];
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

function firstValue(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value) return value.trim();
  }
  return "";
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parsePrice(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const price = Number(normalized);
  return Number.isFinite(price) ? price : 0;
}

function csvRows(textValue: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < textValue.length; index += 1) {
    const char = textValue[index];
    const next = textValue[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function importRowsFromMatrix(matrix: unknown[][]) {
  const [headerRow, ...bodyRows] = matrix;
  const headers = (headerRow ?? []).map(normalizeHeader);
  return bodyRows
    .map((cells) =>
      headers.reduce<Record<string, string>>((row, header, index) => {
        if (header) row[header] = String(cells[index] ?? "").trim();
        return row;
      }, {}),
    )
    .filter((row) => Object.values(row).some(Boolean));
}

function mapImportRows(rows: Record<string, string>[]) {
  return rows.map<ImportProductRow>((row, index) => {
    const name = firstValue(row, ["name", "nama", "nama_produk", "produk", "product"]);
    const categoryValue = firstValue(row, ["category", "kategori", "category_slug", "kategori_slug"]);
    const unit = firstValue(row, ["unit", "satuan"]);
    const price = parsePrice(firstValue(row, ["price", "harga", "harga_jual"]));
    if (!name || !categoryValue || !unit || price <= 0) {
      throw new Error(
        `Baris ${index + 2} tidak valid. Kolom wajib: name/nama, category/kategori, unit, price/harga.`,
      );
    }

    return {
      id: firstValue(row, ["id"]) || undefined,
      name,
      category: categoryValue,
      brand: firstValue(row, ["brand", "merek"]) || null,
      description: firstValue(row, ["description", "deskripsi"]),
      use_cases: listValue(firstValue(row, ["use_cases", "kegunaan", "aplikasi"])),
      unit,
      price,
      stock_status: firstValue(row, ["stock_status", "status"]) || "in_stock",
      coverage_note: firstValue(row, ["coverage_note", "catatan_coverage", "coverage"]) || null,
      image_path: firstValue(row, ["image_path", "path_gambar"]) || null,
      image_alt: firstValue(row, ["image_alt", "alt_gambar"]) || null,
      labels: listValue(firstValue(row, ["labels", "label"])),
    };
  });
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

async function parseImportFile(file: File) {
  const filename = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (filename.endsWith(".csv") || file.type.includes("csv")) {
    const textContent = buffer.toString("utf8").replace(/^\uFEFF/, "");
    return mapImportRows(importRowsFromMatrix(csvRows(textContent)));
  }

  if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("Sheet Excel tidak ditemukan.");
    const matrix: unknown[][] = [];
    worksheet.eachRow((row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      matrix.push(values);
    });
    return mapImportRows(importRowsFromMatrix(matrix));
  }

  throw new Error("Format file harus CSV, XLS, atau XLSX.");
}

async function ensureCategory(slugOrName: string) {
  const supabase = createServiceSupabaseClient();
  const slug = slugify(slugOrName);
  if (!slug) throw new Error("Kategori import tidak valid.");

  const { data, error } = await supabase
    .from("product_categories")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.slug) return data.slug;

  const name = slugOrName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const insertResult = await supabase.from("product_categories").insert({
    slug,
    name,
    description: null,
    sort_order: 100,
    is_active: true,
  });
  if (insertResult.error) throw new Error(insertResult.error.message);
  return slug;
}

async function ensureLabels(labels: string[]) {
  const supabase = createServiceSupabaseClient();
  const uniqueLabels = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  const labelIds: string[] = [];

  for (const label of uniqueLabels) {
    const slug = slugify(label);
    if (!slug) continue;
    const { data, error } = await supabase
      .from("product_labels")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) {
      labelIds.push(data.id);
      continue;
    }

    const insertResult = await supabase
      .from("product_labels")
      .insert({
        slug,
        name: label,
        color: "#174832",
        is_active: true,
      })
      .select("id")
      .single();
    if (insertResult.error) throw new Error(insertResult.error.message);
    labelIds.push(insertResult.data.id);
  }

  return labelIds;
}

async function importProducts(form: FormData) {
  const supabase = createServiceSupabaseClient();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("File import wajib dipilih.");
  }

  const rows = await parseImportFile(file);
  if (rows.length === 0) throw new Error("File import tidak memiliki data produk.");
  if (rows.length > 500) throw new Error("Maksimal import 500 produk per file.");

  let imported = 0;
  for (const row of rows) {
    const category = await ensureCategory(row.category);
    const payload = {
      name: row.name,
      category,
      brand: row.brand ?? null,
      description: row.description ?? "",
      use_cases: row.use_cases ?? [],
      unit: row.unit,
      price: row.price,
      stock_status: row.stock_status || "in_stock",
      coverage_note: row.coverage_note ?? null,
      image_path: row.image_path ?? null,
      image_alt: row.image_alt ?? null,
      embedding: null,
    };

    let productId = row.id;
    if (!productId) {
      const existing = await supabase.from("products").select("id").eq("name", row.name).limit(1);
      if (existing.error) throw new Error(existing.error.message);
      productId = existing.data?.[0]?.id;
    }

    const result = productId
      ? await supabase.from("products").update(payload).eq("id", productId).select("id").single()
      : await supabase.from("products").insert(payload).select("id").single();
    if (result.error) throw new Error(result.error.message);

    const labelIds = await ensureLabels(row.labels ?? []);
    if (labelIds.length > 0) {
      const deleteResult = await supabase
        .from("product_label_links")
        .delete()
        .eq("product_id", result.data.id);
      if (deleteResult.error) throw new Error(deleteResult.error.message);
      const insertResult = await supabase.from("product_label_links").insert(
        labelIds.map((labelId) => ({
          product_id: result.data.id,
          label_id: labelId,
        })),
      );
      if (insertResult.error) throw new Error(insertResult.error.message);
    }

    imported += 1;
  }

  return imported;
}

async function catalogExcel(catalog: CatalogPayload) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Q-Build AI";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Produk");
  worksheet.columns = [
    { header: "id", key: "id", width: 38 },
    { header: "name", key: "name", width: 34 },
    { header: "category", key: "category", width: 18 },
    { header: "brand", key: "brand", width: 18 },
    { header: "description", key: "description", width: 46 },
    { header: "use_cases", key: "use_cases", width: 34 },
    { header: "unit", key: "unit", width: 14 },
    { header: "price", key: "price", width: 14 },
    { header: "stock_status", key: "stock_status", width: 16 },
    { header: "coverage_note", key: "coverage_note", width: 30 },
    { header: "image_path", key: "image_path", width: 30 },
    { header: "image_alt", key: "image_alt", width: 24 },
    { header: "labels", key: "labels", width: 24 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const labelsById = new Map(catalog.labels.map((label) => [label.id, label.name]));
  for (const product of catalog.products) {
    worksheet.addRow({
      ...product,
      brand: product.brand ?? "",
      use_cases: product.use_cases?.join(", ") ?? "",
      coverage_note: product.coverage_note ?? "",
      image_path: product.image_path ?? "",
      image_alt: product.image_alt ?? "",
      labels: product.label_ids.map((id) => labelsById.get(id)).filter(Boolean).join(", "),
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function catalogPdf(catalog: CatalogPayload) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(10).fillColor("#52645c").text("QHOMEMART AI AGENT");
    doc.moveDown(0.2);
    doc.fontSize(20).fillColor("#111827").text("Katalog Produk");
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor("#52645c").text(`Export: ${new Date().toLocaleString("id-ID")}`);
    doc.moveDown();

    for (const product of catalog.products) {
      if (doc.y > 730) doc.addPage();
      doc
        .roundedRect(42, doc.y, 511, 72, 6)
        .strokeColor("#d9ded2")
        .lineWidth(0.8)
        .stroke();
      const startY = doc.y + 10;
      doc.fontSize(11).fillColor("#111827").text(product.name, 54, startY, { width: 300 });
      doc.fontSize(8).fillColor("#52645c").text(`${product.category} | ${product.stock_status}`, 54, startY + 16);
      doc.fontSize(8).fillColor("#52645c").text(product.description || "-", 54, startY + 30, {
        width: 330,
        height: 28,
      });
      doc.fontSize(11).fillColor("#174832").text(`Rp ${Number(product.price).toLocaleString("id-ID")}`, 430, startY, {
        width: 110,
        align: "right",
      });
      doc.y = startY + 68;
    }

    doc.end();
  });
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
    const catalog = await loadCatalog();
    const exportType = new URL(request.url).searchParams.get("export");
    if (exportType === "excel") {
      const buffer = await catalogExcel(catalog);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="q-build-products.xlsx"',
        },
      });
    }
    if (exportType === "pdf") {
      const buffer = await catalogPdf(catalog);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="q-build-products.pdf"',
        },
      });
    }

    return Response.json(catalog);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const form = await request.formData();
    const action = text(form, "action");

    let importCount: number | null = null;
    if (action === "upsertCategory") await upsertCategory(form);
    else if (action === "deleteCategory") await deleteCategory(form);
    else if (action === "upsertLabel") await upsertLabel(form);
    else if (action === "deleteLabel") await deleteLabel(form);
    else if (action === "upsertProduct") await upsertProduct(form);
    else if (action === "deleteProduct") await deleteProduct(form);
    else if (action === "deleteProducts") await deleteProducts(form);
    else if (action === "importProducts") importCount = await importProducts(form);
    else throw new Error("Action admin tidak dikenal.");

    return Response.json({ ok: true, importCount });
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
