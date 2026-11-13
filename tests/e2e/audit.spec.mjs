import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = ["", "productos/", "catering/", "privacidad/"];

test("public journey has valid links, images and working home contact", async ({
  page,
}) => {
  await page.route("**/site/runtime.json", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: {
        ...(await response.json()),
        receiverEndpoint: null,
        privacyApproved: false,
        localPreview: false,
      },
    });
  });
  const documents = new Map();
  const links = [];
  for (const path of pages) {
    const response = await page.goto(path || "./");
    expect(response.status()).toBe(200);
    documents.set(
      new URL(page.url()).pathname,
      await page
        .locator("[id]")
        .evaluateAll((nodes) => nodes.map((node) => node.id)),
    );
    links.push(
      ...(await page
        .locator("a[href]")
        .evaluateAll((nodes) => nodes.map((node) => node.href))),
    );
    for (const img of await page.locator("img:visible").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate((node) => node.complete && node.naturalWidth > 0),
        )
        .toBe(true);
    }
  }
  for (const href of links) {
    const target = new URL(href);
    if (target.origin !== new URL(page.url()).origin) continue;
    expect(documents.has(target.pathname), href).toBe(true);
    if (target.hash)
      expect(documents.get(target.pathname), href).toContain(
        decodeURIComponent(target.hash.slice(1)),
      );
  }
  for (const path of pages) {
    await page.goto(path || "./");
    for (const selector of [".site-brand", ".footer-brand"]) {
      await page.locator(selector).click();
      await expect(page).toHaveURL(/\/Mabell-Ramos\/productos\/$/);
      await expect(page.locator(".flavor-card")).toHaveCount(7);
      await expect(page.locator("body")).not.toContainText(
        /Ver detalles|Ilustración editorial|Una ocasión\./,
      );
      await page.goBack();
    }
  }
  await page.goto("./");
  await expect(page.locator(".flavor-card")).toHaveCount(7);
  await expect(page.locator(".site-header .button")).toHaveAttribute(
    "href",
    /^https:\/\/wa.me\/51932666526/,
  );
});

test("primary light buttons preserve accessible contrast on hover", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Hover only applies to pointer devices");
  for (const [path, selector] of [
    ["productos/", ".product-hero .product-button-light"],
    ["catering/", ".catering-primary"],
  ]) {
    await page.goto(path);
    await page.locator(selector).hover();
    const results = await new AxeBuilder({ page })
      .include(selector)
      .withRules(["color-contrast"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

test("missing pages return 404 and provide a working recovery link", async ({
  page,
}) => {
  const response = await page.goto("ruta-que-no-existe/");
  expect(response.status()).toBe(404);
  await expect(page.locator("h1")).toBeVisible();
  await page.locator(".site-brand").click();
  await expect(page).toHaveURL(/\/Mabell-Ramos\/productos\/$/);
  await expect(page.locator(".flavor-card")).toHaveCount(7);
});
