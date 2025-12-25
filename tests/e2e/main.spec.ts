import { test, expect } from "@playwright/test";

test("experience loads and starts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Preparing Matter.01")).toBeVisible();
  const beginButton = page.locator("button:has-text('Begin')");
  await beginButton.waitFor({ state: "visible" });
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("button");
    button?.click();
  });
  await expect(page.locator("canvas")).toBeVisible();
});
