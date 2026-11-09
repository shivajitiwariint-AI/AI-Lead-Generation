import { test, expect } from "@playwright/test";

test("dashboard loads and shows title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /ai lead gen/i })).toBeVisible();
});

test("navigation links work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /get started/i }).click();
  await expect(page).toHaveURL(/\/auth\/signup/);
});
