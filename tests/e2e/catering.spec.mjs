import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const endpoint = "https://formsubmit.co/ajax/mabellramospe@gmail.com";
async function fill(page) {
  await page
    .getByLabel("Tu nombre", { exact: false })
    .fill("Prueba de interfaz");
  await page.getByLabel("Tu WhatsApp", { exact: false }).fill("912 345 678");
}
test.beforeEach(async ({ page }) => {
  await page.route(endpoint, (route) =>
    route.fulfill({
      json: { success: true, message: "Form successfully submitted" },
    }),
  );
});
test("catering has six main fields, consistent funnel and accessible mobile layout", async ({
  page,
}, testInfo) => {
  await page.goto("catering/");
  await expect(page.locator(".site-header .button")).toHaveAttribute(
    "href",
    "#consulta-evento",
  );
  await expect(page.locator(".site-header .button")).toHaveText(
    "Solicitar cotización",
  );
  await expect(
    page.locator(
      "#catering-form > .catering-field input:visible,#catering-form > .catering-field select:visible",
    ),
  ).toHaveCount(6);
  await expect(page.locator("#catering-form [required]")).toHaveCount(2);
  await expect(
    page.locator(".catering-options, [data-catering-scope]"),
  ).toHaveCount(0);
  await expect(page.locator("#catering-scope-hint")).toHaveText(
    "Coordinaremos contigo las cantidades, la entrega y los servicios necesarios.",
  );
  await expect(page.locator('a[href*="catalogo/"]')).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: testInfo.outputPath(`catering-${width}.png`),
        fullPage: true,
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
});
test("scope selection is carried into the form and WhatsApp summary", async ({
  page,
}) => {
  await page.goto("catering/");
  await page
    .getByLabel("¿Qué necesitas?", { exact: true })
    .selectOption("food_and_service");
  await expect(page.locator("#catering-scope")).toHaveValue("food_and_service");
  await fill(page);
  await page.locator("#catering-guests").fill("30");
  await page.locator("#catering-district").fill("Miraflores");
  const href = new URL(
    await page.locator(".catering-whatsapp").getAttribute("href"),
  );
  expect(href.pathname).toBe("/51932666526");
  expect(href.searchParams.get("text")).toContain("Personas: 30");
  expect(href.searchParams.get("text")).toContain("Alimentos + servicio");
});
test("email accepts unknown dates and counts without customer email, prevents duplicate submits", async ({
  page,
}) => {
  let requests = [];
  await page.route(endpoint, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: { success: "true", message: "Form successfully submitted" },
    });
  });
  await page.goto("catering/");
  await fill(page);
  await page.locator(".catering-submit").click();
  await expect(page.locator(".catering-status")).toContainText(
    "Recibimos tu solicitud.",
  );
  await expect(page.locator(".catering-submit")).toBeHidden();
  expect(requests).toHaveLength(1);
  expect(requests[0].Fecha).toBe("Por definir");
  expect(requests[0].Personas).toBe("Por definir");
  expect(requests[0].WhatsApp).toBe("+51912345678");
  expect(requests[0].email).toBeUndefined();
  expect(requests[0].Referencia).toMatch(/^MR-CAT-/);
});
test("invalid contact and optional email errors are inline, accessible and retain input", async ({
  page,
}) => {
  await page.goto("catering/");
  await page.locator(".catering-submit").click();
  await expect(page.locator("#catering-name")).toBeFocused();
  await expect(page.locator("#catering-phone-error")).not.toBeEmpty();
  await fill(page);
  await page.locator(".catering-additional summary").click();
  await page.locator("#catering-email").fill("incorrecto");
  await page.locator(".catering-submit").click();
  await expect(page.locator("#catering-email")).toBeFocused();
  await expect(page.locator("#catering-email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#catering-name")).toHaveValue(
    "Prueba de interfaz",
  );
});
test("network failure retains values, provides WhatsApp and reuses reference on retry", async ({
  page,
}) => {
  let requests = [];
  await page.route(endpoint, async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) await route.abort();
    else await route.fulfill({ json: { success: true } });
  });
  await page.goto("catering/");
  await fill(page);
  await page.locator(".catering-submit").click();
  await expect(page.locator(".catering-status")).toContainText(
    "No pudimos confirmar",
  );
  await expect(page.locator("#catering-name")).toBeEnabled();
  await expect(page.locator("#catering-name")).toHaveValue(
    "Prueba de interfaz",
  );
  await expect(page.locator(".catering-whatsapp")).toHaveAttribute(
    "href",
    /Prueba%20de%20interfaz/,
  );
  await page.locator(".catering-submit").click();
  await expect(page.locator(".catering-status")).toContainText(
    "Recibimos tu solicitud",
  );
  expect(requests[0].Referencia).toBe(requests[1].Referencia);
});
test("activation and rejected submissions never show success", async ({
  page,
}) => {
  for (const result of [
    { success: true, message: "This form needs activation" },
    { success: false, message: "Unable to submit" },
  ]) {
    await page.route(endpoint, (route) => route.fulfill({ json: result }));
    await page.goto("catering/");
    await fill(page);
    await page.locator(".catering-submit").click();
    await expect(page.locator(".catering-status")).toHaveAttribute(
      "data-state",
      "error",
    );
    await expect(page.locator(".catering-status")).not.toContainText(
      "Recibimos",
    );
    await expect(page.locator("#catering-phone")).toHaveValue("912 345 678");
  }
});
test("optional email is supplied as reply-to and subject contains useful event details", async ({
  page,
}) => {
  let sent;
  await page.route(endpoint, (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { success: true } });
  });
  await page.goto("catering/");
  await fill(page);
  await page.locator("#catering-guests").fill("30");
  await page.locator("#catering-district").fill("Miraflores");
  await page.locator(".catering-additional summary").click();
  await page.locator("#catering-email").fill("prueba@example.invalid");
  await page.locator(".catering-submit").click();
  await expect(page.locator(".catering-status")).toContainText("Recibimos");
  expect(sent._replyto).toBe("prueba@example.invalid");
  expect(sent._subject).toContain("30 personas · Miraflores");
});
test("catering provides a native form and WhatsApp without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4194/Mabell-Ramos/catering/");
  await expect(page.locator("#catering-form")).toHaveAttribute(
    "action",
    "https://formsubmit.co/mabellramospe@gmail.com",
  );
  await expect(page.locator(".catering-whatsapp")).toBeVisible();
  await context.close();
});

test("past dates, impossible guest counts and invalid phones cannot be submitted", async ({
  page,
}) => {
  let sent = 0;
  await page.route(endpoint, (route) => {
    sent++;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto("catering/");
  await fill(page);
  await page.locator("#catering-date").fill("2000-01-01");
  await page.locator(".catering-submit").click();
  await expect(page.locator("#catering-date")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.locator("#catering-date").fill("");
  for (const guests of ["0", "2.5", "10001"]) {
    await page.locator("#catering-guests").fill(guests);
    await page.locator(".catering-submit").click();
    await expect(page.locator("#catering-guests")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  }
  await page.locator("#catering-guests").fill("");
  await page.locator("#catering-phone").fill("123");
  await page.locator(".catering-submit").click();
  await expect(page.locator("#catering-phone")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(sent).toBe(0);
});

test("a slow response locks the form and sends only one email request", async ({
  page,
}) => {
  let sent = 0;
  let release;
  const response = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    sent++;
    await response;
    await route.fulfill({ json: { success: true } });
  });
  await page.goto("catering/");
  await fill(page);
  await page.locator(".catering-submit").click();
  await expect(page.locator(".catering-submit")).toBeDisabled();
  await expect(page.locator("#catering-phone")).toBeDisabled();
  await page.keyboard.press("Enter");
  release();
  await expect(page.locator(".catering-status")).toContainText(
    "Recibimos tu solicitud",
  );
  expect(sent).toBe(1);
});
