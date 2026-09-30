import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const local = "http://127.0.0.1:4194/Mabell-Ramos/";
const fixture = "http://127.0.0.1:4195/Mabell-Ramos/";
async function fill(form) {
  if (await form.locator("[name=requestText]").count())
    await form.locator("[name=requestText]").fill("Chocotejas para consultar");
  await form.locator("[name=name]").fill("Prueba de interfaz");
  await form.locator("[name=email]").fill("prueba@example.invalid");
}
async function mockReceive(page, handler) {
  await page.route("http://127.0.0.1:8794/v1/consultas", handler);
}
function receipt(input) {
  return {
    status: "received",
    receiptId: `MR-${input.requestId.toUpperCase()}`,
    receivedAt: new Date().toISOString(),
  };
}
test("all pages render with no errors, overflow, missing assets or accessibility violations", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "",
    "productos/",
    "catering/",
    "catalogo/#pagina-3",
    "privacidad/",
  ]) {
    const broken = [];
    const listener = (r) => {
      if (r.status() >= 400) broken.push(r.url());
    };
    page.on("response", listener);
    await page.goto(local + route);
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".site-header nav")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      report.violations,
      JSON.stringify(
        report.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    ).toEqual([]);
    expect(broken).toEqual([]);
    page.off("response", listener);
  }
  expect(errors).toEqual([]);
});
test("320px and tablet layout keep controls reachable", async ({ page }) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(local + "catering/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole("button", { name: "Enviar consulta" }),
    ).toBeVisible();
  }
});
test("legacy link keeps direct catalogue page and keyboard does not hijack forms", async ({
  page,
}) => {
  const originals = [];
  page.on("request", (r) => {
    if (/assets\/pagina-\d+\.webp/.test(r.url())) originals.push(r.url());
  });
  await page.goto(local + "#pagina-3");
  await expect(page).toHaveURL(/catalogo\/#pagina-3$/);
  await expect(page.locator("#page-select")).toHaveValue("2");
  await expect(page.locator("#page")).toBeVisible();
  await page.locator("#catalog-transcription summary").click();
  await expect(page.locator("#transcription-content")).toContainText("Cañihua");
  await page.locator("#catalog-consultation > summary").click();
  await page.locator("[name=name]").fill("Prueba");
  await page.locator("[name=name]").press("ArrowRight");
  await expect(page.locator("#page-select")).toHaveValue("2");
  await page.locator("#next").click();
  await expect(page.locator("[data-catalog-context]")).toContainText(
    "Bombones",
  );
  expect(originals).toEqual([]);
});
test("real local submit persists then returns receipt after double click", async ({
  page,
}) => {
  await page.goto(local + "productos/");
  const form = page.locator(".inquiry-form");
  await fill(form);
  await form.locator(".submit-inquiry").dblclick();
  await expect(form.locator(".form-status")).toContainText(
    "Consulta guardada en este equipo",
  );
  await expect(form.locator(".receipt-code")).toContainText("MR-");
  await expect(form.locator("[name=name]")).toBeDisabled();
});
test("lost reply retry keeps immutable request and prevents duplicate/change", async ({
  page,
}) => {
  let count = 0;
  const bodies = [];
  await mockReceive(page, async (route) => {
    const input = route.request().postDataJSON();
    bodies.push(input);
    if (count++ === 0) await route.abort("failed");
    else await route.fulfill({ status: 200, json: receipt(input) });
  });
  await page.goto(local + "productos/");
  const form = page.locator(".inquiry-form");
  await fill(form);
  await form.locator(".submit-inquiry").click();
  await expect(form.locator(".form-status")).toContainText(
    "No pudimos confirmar",
  );
  await expect(form.locator("[name=email]")).toBeDisabled();
  await expect(form.locator(".edit-inquiry")).toBeHidden();
  await form.locator(".submit-inquiry").click();
  await expect(form.locator(".receipt-code")).toBeVisible();
  expect(bodies[0].requestId).toBe(bodies[1].requestId);
  expect(bodies[0].message).toBe(bodies[1].message);
});
test("lost reply then rate limit still prevents discarding pending ID", async ({
  page,
}) => {
  let n = 0;
  await mockReceive(page, async (r) => {
    if (n++ === 0) await r.abort("failed");
    else
      await r.fulfill({
        status: 429,
        headers: { "Retry-After": "60" },
        json: { error: "rate_limited" },
      });
  });
  await page.goto(local + "productos/");
  const f = page.locator(".inquiry-form");
  await fill(f);
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".form-status")).toContainText("No pudimos confirmar");
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".form-status")).toContainText("Espera");
  await expect(f.locator(".edit-inquiry")).toBeHidden();
  await expect(f.locator("[name=name]")).toBeDisabled();
});
test("event food-only submits correct distinct scope and unknown values", async ({
  page,
}) => {
  let body;
  await mockReceive(page, async (r) => {
    body = r.request().postDataJSON();
    await r.fulfill({ status: 201, json: receipt(body) });
  });
  await page.goto(local + "catering/");
  const f = page.locator(".inquiry-form");
  await fill(f);
  await f.locator("[name=scope]").selectOption("food_only");
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".receipt-code")).toBeVisible();
  expect(body.kind).toBe("event");
  expect(body.occasion).toBe("evento");
  expect(body.event.scope).toBe("food_only");
  expect(body.event.attendees).toBeNull();
  expect(body.requestedDate).toBeNull();
  expect(body.contact.method).toBe("email");
});
test("catalogue-event comment retains context/version without truncation", async ({
  page,
}) => {
  let body;
  await mockReceive(page, async (r) => {
    body = r.request().postDataJSON();
    await r.fulfill({ status: 201, json: receipt(body) });
  });
  await page.goto(local + "catalogo/#pagina-9");
  await page.locator("#catalog-consultation > summary").click();
  const f = page.locator(".inquiry-form");
  await fill(f);
  await f.locator("[name=scope]").selectOption("food_only");
  await f.locator(".additional summary").click();
  await f
    .locator("[name=message]")
    .fill("Quiero consultar bocaditos salados. FIN");
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".receipt-code")).toBeVisible();
  expect(body.kind).toBe("event");
  expect(body.message).toContain("catálogo".replace("catálogo", "Catálogo"));
  expect(body.message).toContain("catalogo-referencia-2026-09-29");
  expect(body.message).toContain("FIN");
});
test("production unavailable never produces a success receipt", async ({
  page,
}) => {
  await page.route("**/site/runtime.json", async (r) => {
    const response = await r.fetch();
    const c = await response.json();
    await r.fulfill({
      json: {
        ...c,
        receiverEndpoint: null,
        privacyApproved: false,
        localPreview: false,
      },
    });
  });
  await page.goto(local + "productos/");
  const f = page.locator(".inquiry-form");
  await fill(f);
  await expect(f.locator(".submit-inquiry")).toBeDisabled();
  await expect(f.locator(".form-status")).toContainText(
    "todavía no está activada",
  );
  await expect(f.locator(".receipt-code")).toHaveCount(0);
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
});
test("six approved fixture options render, deep link opens and retired cannot submit", async ({
  page,
}) => {
  await page.goto(fixture + "productos/#opcion-test-option-2");
  await expect(page.locator(".option-card")).toHaveCount(6);
  await expect(page.locator("#opcion-test-option-2 > details")).toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator(".product-ficha")).toHaveCount(6);
  await expect(page.locator(".anchor-nav a")).toHaveCount(3);
  await expect(page.locator("#opcion-test-option-6")).toContainText(
    "no está disponible",
  );
  await expect(page.locator("#opcion-test-option-6 .inquiry-form")).toHaveCount(
    0,
  );
  await expect(page.locator("#opcion-test-option-2 .price")).toContainText(
    "31",
  );
});
test("approved option snapshot sends ID revision quantity and no inferred occasion", async ({
  page,
}) => {
  let body;
  await mockReceive(page, async (r) => {
    body = r.request().postDataJSON();
    await r.fulfill({ status: 201, json: receipt(body) });
  });
  await page.goto(fixture + "productos/#opcion-test-option-1");
  const f = page.locator("#opcion-test-option-1 .inquiry-form");
  await page
    .locator("#opcion-test-option-1 .option-consultation > summary")
    .click();
  await fill(f);
  await f.locator("[name=quantity]").fill("2");
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".receipt-code")).toBeVisible();
  expect(body.option).toEqual({
    id: "test-option-1",
    revision: 1,
    quantity: 2,
  });
  expect(body.occasion).toBeUndefined();
  expect(body.kind).toBe("product_option");
});
test("reduced motion suppresses scrolling and visuals remain readable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(local);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
test("correcting a server-invalid field submits visible values under a new ID", async ({
  page,
}) => {
  const bodies = [];
  await mockReceive(page, async (r) => {
    const b = r.request().postDataJSON();
    bodies.push(b);
    await r.fulfill(
      bodies.length === 1
        ? {
            status: 400,
            json: { error: "invalid_input", field: "contact.name" },
          }
        : { status: 201, json: receipt(b) },
    );
  });
  await page.goto(local + "productos/");
  const f = page.locator(".inquiry-form");
  await fill(f);
  await f.locator(".submit-inquiry").click();
  await expect(f.locator("[name=name]")).toBeEnabled();
  await f.locator("[name=name]").fill("Nombre corregido");
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".receipt-code")).toBeVisible();
  expect(bodies[1].contact.name).toBe("Nombre corregido");
  expect(bodies[1].requestId).not.toBe(bodies[0].requestId);
});
test("changed price requires explicit review and preserves typed contact data", async ({
  page,
}) => {
  const bodies = [];
  await page.route("**/site/catalog-public.json", async (r) => {
    const response = await r.fetch();
    const cat = await response.json();
    cat.options[0].revision = 2;
    cat.options[0].priceCents = 4500;
    cat.options[0].saleUnit = "lote";
    cat.options[0].items[0].quantity = 8;
    await r.fulfill({ json: cat });
  });
  await mockReceive(page, async (r) => {
    const b = r.request().postDataJSON();
    bodies.push(b);
    await r.fulfill(
      bodies.length === 1
        ? { status: 409, json: { error: "offer_updated", field: "option" } }
        : { status: 201, json: receipt(b) },
    );
  });
  await page.goto(fixture + "productos/#opcion-test-option-1");
  const f = page.locator("#opcion-test-option-1 .inquiry-form");
  await page
    .locator("#opcion-test-option-1 .option-consultation > summary")
    .click();
  await fill(f);
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".offer-review")).toContainText("45");
  await expect(f.locator(".submit-inquiry")).toBeHidden();
  await f
    .getByRole("button", { name: "Usar condiciones actualizadas" })
    .click();
  await expect(f.locator("[name=name]")).toHaveValue("Prueba de interfaz");
  await expect(f.locator("[name=email]")).toHaveValue("prueba@example.invalid");
  await expect(f.getByLabel("Cantidad (lote)")).toHaveValue("1");
  await expect(page.locator("#opcion-test-option-1 h3 + p")).toContainText(
    "8 Preparación de prueba 1",
  );
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".receipt-code")).toBeVisible();
  expect(bodies[0].option.revision).toBe(1);
  expect(bodies[1].option.revision).toBe(2);
  expect(bodies[1].requestId).not.toBe(bodies[0].requestId);
});
test("catering choice sets scope and food-only unchecks service requests", async ({
  page,
}) => {
  await page.goto(local + "catering/");
  await page.locator("[data-scope-choice=food_and_service]").click();
  const f = page.locator(".inquiry-form");
  await expect(f.locator("[name=scope]")).toHaveValue("food_and_service");
  await f.locator(".additional > summary").click();
  await f.locator("[value=setup]").check();
  await f.locator("[name=scope]").selectOption("food_only");
  await expect(f.locator("[value=setup]")).not.toBeChecked();
  await expect(f.locator("[value=setup]")).toBeDisabled();
  await expect(f.locator("[value=sweet]")).toBeEnabled();
});
test("correcting a field keeps food-only service interests disabled", async ({
  page,
}) => {
  const bodies = [];
  await mockReceive(page, async (r) => {
    const b = r.request().postDataJSON();
    bodies.push(b);
    await r.fulfill(
      bodies.length === 1
        ? {
            status: 400,
            json: { error: "invalid_input", field: "contact.name" },
          }
        : { status: 201, json: receipt(b) },
    );
  });
  await page.goto(local + "catering/");
  const f = page.locator(".inquiry-form");
  await fill(f);
  await f.locator("[name=scope]").selectOption("food_only");
  await f.locator(".additional > summary").click();
  await f.locator("[value=savory]").check();
  await f.locator(".submit-inquiry").click();
  await expect(f.locator("[name=name]")).toBeEnabled();
  for (const value of ["setup", "staff", "tableware"]) {
    await expect(f.locator(`[value=${value}]`)).toBeDisabled();
    await expect(f.locator(`[value=${value}]`)).not.toBeChecked();
  }
  await f.locator("[name=name]").fill("Nombre corregido");
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".receipt-code")).toBeVisible();
  expect(bodies[1].event.interests).toEqual(["savory"]);
  expect(bodies[1].occasion).toBe("evento");
});
test("all fourteen old catalogue fragments retain the corresponding page", async ({
  page,
}) => {
  for (let number = 1; number <= 14; number++) {
    await page.goto(local + `#pagina-${number}`);
    await expect(page).toHaveURL(new RegExp(`/catalogo/#pagina-${number}$`));
    await expect(page.locator("#page-select")).toHaveValue(String(number - 1));
    await expect(page.locator("#page")).toHaveAttribute(
      "src",
      new RegExp(`/pagina-${String(number).padStart(2, "0")}-`),
    );
  }
});
test("approved fixture remains accessible with open option form", async ({
  page,
}) => {
  await page.goto(fixture + "productos/#opcion-test-option-1");
  await page.waitForLoadState("networkidle");
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    report.violations,
    JSON.stringify(
      report.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  ).toEqual([]);
});
test("receipt includes time summary and reference copy without exposing contact", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(local + "productos/");
  const f = page.locator(".inquiry-form");
  await fill(f);
  await f.locator(".submit-inquiry").click();
  await expect(f.locator(".receipt-time")).toContainText("Recibida el");
  await expect(f.locator(".receipt-summary")).toContainText("Chocotejas");
  await f.locator(".copy-receipt").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^MR-/,
  );
});
test("no JavaScript keeps content and alternative contact and cannot leak form in URL", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const p = await context.newPage();
  await p.goto(local + "productos/");
  await expect(p.locator("h1")).toContainText("Productos");
  await expect(p.locator(".submit-inquiry")).toBeDisabled();
  await expect(p.locator(".inquiry-form .external")).toBeVisible();
  await context.close();
});
test("old withdrawn option link explains its state", async ({ page }) => {
  await page.goto(local + "productos/#opcion-retirada");
  await expect(page.locator(".retired-option")).toContainText(
    "ya no está publicada",
  );
});
