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
