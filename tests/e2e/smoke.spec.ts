import { expect, test } from "@playwright/test";

test.describe("smoke pages", () => {
  test("home shows the Q-Build AI demo workspace", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Q-Build AI Demo" }),
    ).toBeVisible();
    await expect(page.getByLabel("Pesan renovasi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Session Baru" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard admin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Katalog produk" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim" })).toBeVisible();
    await expect(page.getByText("Belum ada hasil")).toBeVisible();
    await expect(page.getByLabel("Pesan renovasi")).toHaveValue(
      "Atap kamar saya bocor setelah hujan. Area sekitar 15 meter persegi.",
    );
  });

  test("home can start a new local chat session", async ({ page }) => {
    await page.route("**/api/recommendation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "recommendation",
          message: "Rekomendasi mock siap.",
          recommendation: {
            title: "Mock waterproofing 12 m2",
            problemSummary: "Atap bocor 12 m2.",
            diagnosis: "Mock diagnosis.",
            items: [],
            breakdown: [],
            subtotal: 100000,
          },
          aiProvider: "sumopod",
        }),
      });
    });

    await page.goto("/");

    await page.getByLabel("Pesan renovasi").fill("Atap bocor 12 m2, kualitas standar");
    await page.getByRole("button", { name: "Kirim" }).click();
    await expect(page.getByText("Mock waterproofing 12 m2")).toBeVisible();

    await page.getByRole("button", { name: "Session Baru" }).click();

    await expect(page.getByText("Belum ada hasil")).toBeVisible();
    await expect(page.getByText("Mock waterproofing 12 m2")).toHaveCount(0);
    await expect(page.getByLabel("Pesan renovasi")).toHaveValue(
      "Atap kamar saya bocor setelah hujan. Area sekitar 15 meter persegi.",
    );
  });

  test("home asks clarification before quotation when data is missing", async ({ page }) => {
    await page.route("**/api/recommendation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "clarification",
          message: "Berapa luas area atap yang bocor dalam m2?",
          aiProvider: "sumopod",
        }),
      });
    });

    await page.goto("/");
    await page.getByLabel("Pesan renovasi").fill("Atap saya bocor");
    await page.getByRole("button", { name: "Kirim" }).click();

    await expect(
      page.getByText("Berapa luas area atap yang bocor dalam m2?"),
    ).toBeVisible();
    await expect(page.getByText("Belum ada hasil")).toBeVisible();
  });

  test("home handles unavailable catalog requests politely", async ({ page }) => {
    await page.route("**/api/recommendation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "unavailable",
          message:
            "Maaf, produk itu belum tersedia di katalog demo kami. Saat ini saya bisa bantu untuk waterproofing, cat tembok, plumbing, keramik, perbaikan dinding, dan tools pendukung renovasi.",
          aiProvider: "sumopod",
        }),
      });
    });

    await page.goto("/");
    await page.getByLabel("Pesan renovasi").fill("kipas saya rusak, mau beli baru");
    await page.getByRole("button", { name: "Kirim" }).click();

    await expect(page.getByText(/Maaf, produk itu belum tersedia/)).toBeVisible();
    await expect(page.getByText("Belum ada hasil")).toBeVisible();
  });

  test("home sends uploaded image data to recommendation API", async ({ page }) => {
    await page.route("**/api/recommendation", async (route) => {
      const payload = route.request().postDataJSON() as {
        messages: Array<{ imageDataUrl?: string; imageMediaType?: string }>;
      };
      const lastMessage = payload.messages.at(-1);

      expect(lastMessage?.imageDataUrl).toContain("data:image/png;base64,");
      expect(lastMessage?.imageMediaType).toBe("image/png");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "clarification",
          message: "Saya melihat foto. Berapa luas area yang terdampak?",
          aiProvider: "sumopod",
        }),
      });
    });

    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "retak.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.getByLabel("Pesan renovasi").fill("tolong cek foto ini");
    await page.getByRole("button", { name: "Kirim" }).click();

    await expect(
      page.getByText("Saya melihat foto. Berapa luas area yang terdampak?"),
    ).toBeVisible();
  });

  test("catalog shows searchable product data", async ({ page }) => {
    await page.goto("/catalog");

    await expect(
      page.getByRole("heading", { name: "Katalog produk" }),
    ).toBeVisible();
    await expect(page.getByLabel("Cari katalog")).toBeVisible();
    await expect(page.getByLabel("Filter kategori")).toBeVisible();
    await expect(page.getByText("QHM RoofSeal Waterproof Coating 20kg")).toBeVisible();

    await page.getByLabel("Cari katalog").fill("primer");
    await expect(page.getByText("QHM Alkali Sealer Primer 2.5L")).toBeVisible();
  });

  test("quotes shows saved quotations", async ({ page }) => {
    await page.route("**/api/quotes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          quotes: [
            {
              id: "smoke-quote",
              title: "Smoke quotation",
              problemSummary: "Quotation untuk smoke test halaman quotes.",
              diagnosis: "Data stub Playwright.",
              items: [],
              breakdown: [],
              subtotal: 125000,
              createdAt: "2026-05-10T00:00:00.000Z",
              source: "api",
            },
          ],
        }),
      });
    });

    await page.goto("/quotes");

    await expect(
      page.getByRole("heading", { name: "Saved quotations" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Smoke quotation/ })).toBeVisible();
    await expect(page.getByText(/Rp\s*125\.000/)).toBeVisible();
  });

  test("admin shows Supabase auth form", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "Masuk sebagai admin" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("admin@gmail.com");
    const passwordInput = page.locator("#admin-password");
    await expect(passwordInput).toBeVisible();
    await expect(page.getByLabel("Tampilkan password")).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await page.getByLabel("Tampilkan password").click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();

    await page.evaluate(() => {
      window.localStorage.setItem(
        "sb-ksemrhvevevyjxgdsznw-auth-token",
        JSON.stringify({
          access_token: "mock-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "mock-refresh",
          user: {
            id: "mock-admin",
            aud: "authenticated",
            role: "authenticated",
            email: "admin@gmail.com",
            app_metadata: {},
            user_metadata: {},
          },
        }),
      );
    });
    let bulkDeleteCalled = false;
    await page.route("**/api/admin/catalog", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postData() ?? "";
        bulkDeleteCalled = body.includes("deleteProducts");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          products: [
            {
              id: "prod-1",
              name: "Nippon Vinilex Interior Paint 2.5L",
              category: "paint",
              brand: "Nippon",
              description: "Cat tembok interior.",
              use_cases: ["cat interior"],
              unit: "pail",
              price: 185000,
              stock_status: "in_stock",
              coverage_note: null,
              image_path: null,
              image_alt: null,
              image_url: null,
              label_ids: ["label-premium"],
            },
            {
              id: "prod-2",
              name: "QHM Paint Roller Set 9 inch",
              category: "paint",
              brand: "QHM",
              description: "Set roller cat.",
              use_cases: ["alat cat"],
              unit: "set",
              price: 69000,
              stock_status: "in_stock",
              coverage_note: null,
              image_path: null,
              image_alt: null,
              image_url: null,
              label_ids: [],
            },
          ],
          categories: [
            {
              id: "cat-paint",
              slug: "paint",
              name: "Paint",
              description: null,
              sort_order: 10,
              is_active: true,
            },
          ],
          labels: [
            {
              id: "label-premium",
              slug: "premium",
              name: "Premium",
              color: "#b45309",
              is_active: true,
            },
          ],
        }),
      });
    });
    await page.reload();
    await page.getByRole("button", { name: /^Produk \d+/ }).click();
    const priceInput = page.locator('input[placeholder="250.000"]:visible');
    await expect(priceInput).toBeVisible();
    await priceInput.fill("2500000");
    await expect(priceInput).toHaveValue("2.500.000");
    await page.getByLabel("Pilih semua produk yang tampil").check();
    await expect(page.getByText("2 dipilih")).toBeVisible();
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("2 produk");
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Hapus item terpilih" }).click();
    expect(bulkDeleteCalled).toBe(true);

    await page.getByRole("button", { name: /^Kategori \d+/ }).click();
    await expect(page.getByRole("heading", { name: "Kelola kategori produk" })).toBeVisible();
    await expect(page.locator("p", { hasText: /^Paint$/ })).toBeVisible();
    await expect(page.locator('input[placeholder="250.000"]:visible')).toHaveCount(0);

    await page.getByRole("button", { name: /^Label \d+/ }).click();
    await expect(page.getByRole("heading", { name: "Kelola label produk" })).toBeVisible();
    await expect(page.locator("p", { hasText: /^Premium$/ })).toBeVisible();
  });

  test("quote detail can export a professional PDF layout", async ({ page }) => {
    await page.route("**/api/quotes/demo-roof-leak", async (route) => {
      await route.abort();
    });

    await page.goto("/quotes/demo-roof-leak");

    await expect(
      page.getByRole("heading", { name: "Q-Build AI Quotation" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
    await expect(page.getByText("Estimasi subtotal")).toBeVisible();
    await expect(page.getByText("Produk dan quantity")).toBeVisible();
    await expect(page.getByText("Agent Workflow Trace")).toBeVisible();
  });
});
