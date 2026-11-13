import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("seven flavors have one WhatsApp action and no expandable details", async ({
  page,
}) => {
  await page.goto("productos/");
  await expect(page.locator(".flavor-card")).toHaveCount(7);
  await expect(
    page.locator(".flavor-detail, .flavor-dialog, [data-flavor-open]"),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Ver detalles");
  for (const card of await page.locator(".flavor-card").all()) {
    await expect(card.locator("a, button, summary")).toHaveCount(1);
    const link = new URL(await card.locator("a").getAttribute("href"));
    expect(link.origin + link.pathname).toBe("https://wa.me/51932666526");
    expect(link.searchParams.get("text")).toBe(
      await card.getAttribute("data-inquiry"),
    );
  }
  await page.getByRole("link", { name: "Alfajores", exact: true }).click();
  await expect(
    page.locator('.product-nav-links a[href="#alfajores"]'),
  ).toHaveAttribute("aria-current", "location");
  await expect(page.locator('a[href*="catalogo/"]')).toHaveCount(0);
  await expect(
    page.locator(".presentation-card, .product-presentations, .footer-phone"),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /ilustrativ|referencial/i,
  );
});

test("simplified cards keep balanced spacing and reachable contact on every screen", async ({
  page,
}, testInfo) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("productos/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    for (const card of await page.locator(".flavor-card").all()) {
      const spacing = await card.evaluate((node) => {
        const c = node.getBoundingClientRect();
        const button = node
          .querySelector(".flavor-consult")
          .getBoundingClientRect();
        const description = node
          .querySelector(".flavor-description")
          .getBoundingClientRect();
        return {
          bottom: c.bottom - button.bottom,
          gap: button.top - description.bottom,
        };
      });
      expect(spacing.bottom).toBeGreaterThanOrEqual(16);
      expect(spacing.gap).toBeGreaterThanOrEqual(16);
    }
    await page.locator("#chocotejas").scrollIntoViewIfNeeded();
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: testInfo.outputPath(`tarjetas-${width}.png`),
      });
    if (width === 390) {
      await page.locator(".site-footer").scrollIntoViewIfNeeded();
      await expect(page.locator(".product-mobile-contact")).toBeInViewport();
      await expect(page.locator(".product-instagram")).toBeVisible();
    }
  }
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
});

test("flavor descriptions and WhatsApp remain usable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4194/Mabell-Ramos/productos/");
  await expect(page.locator(".flavor-description")).toHaveCount(7);
  await expect(page.locator(".flavor-consult")).toHaveCount(7);
  await expect(page.locator("#sabor-frejol-colado")).toContainText("mousse");
  await expect(page.locator(".flavor-card details, dialog")).toHaveCount(0);
  await context.close();
});

test("reviews cycle with arrows, Instagram remains visible and contact stays visible", async ({
  page,
}, testInfo) => {
  await page.goto("productos/");
  const visible = page.locator(".review-slide:not([hidden])");
  await expect(visible).toHaveCount(1);
  await expect(visible).toContainText("@luzramirezojeda");
  const next = page.getByRole("button", { name: "Comentario siguiente" });
  await next.click();
  await expect(visible).toContainText("@lasrosasart");
  await next.press("Enter");
  await expect(visible).toContainText("@delatierraalaluna_c");
  await next.click();
  await expect(visible).toContainText("@rebecamontalvo_");
  await expect(visible.locator("blockquote")).toHaveText(
    "“Me encantan son riquísimos 😍”",
  );
  await expect(visible.locator("a")).toHaveAttribute(
    "href",
    "https://www.instagram.com/p/DckZgIzkeiN/c/18131218771653820/",
  );
  await next.click();
  await expect(visible).toContainText("@dianag.cordova");
  await expect(visible.locator("a")).toHaveText("Ver historia en destacados ↗");
  await expect(visible.locator("a")).toHaveAttribute(
    "href",
    "https://www.instagram.com/stories/highlights/18079143227047771/",
  );
  await expect(page.locator(".review-count")).toHaveText("5 / 5");
  await page
    .locator(".product-review")
    .screenshot({ path: testInfo.outputPath("resenas.png") });
  await next.click();
  await expect(visible).toContainText("@luzramirezojeda");
  await page.getByRole("button", { name: "Comentario anterior" }).click();
  await expect(visible).toContainText("@dianag.cordova");
  await expect(page.locator(".product-instagram")).toHaveAttribute(
    "href",
    "https://www.instagram.com/mabellramos.dulces/",
  );
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
});
