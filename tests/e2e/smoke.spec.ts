import { expect, test } from "@playwright/test";

test.describe("smoke pages", () => {
  test("home shows the Q-Build AI demo workspace", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Q-Build AI Demo" }),
    ).toBeVisible();
    await expect(page.getByLabel("Pesan renovasi")).toBeVisible();
    await expect(page.getByRole("link", { name: "Demo login" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim" })).toBeVisible();
    await expect(page.getByText("Atap bocor 15 m2")).toBeVisible();
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

  test("login shows demo auth form", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Masuk Q-Build AI" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("demo@qhomemart.local");
    await expect(page.getByLabel("Password")).toHaveValue("password-demo");
    await expect(page.getByRole("link", { name: "Lanjut mode demo" })).toBeVisible();
  });
});
