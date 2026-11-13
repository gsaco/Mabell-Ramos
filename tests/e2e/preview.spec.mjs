import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
const directory = path.resolve(".local-data/connected-preview");
const preview = (name) =>
  pathToFileURL(path.join(directory, `${name}-vista-previa.html`)).href;
test.beforeAll(() =>
  execFileSync(process.execPath, [
    "tools/export-products-preview.mjs",
    directory,
    "catering",
  ]),
);
test("portable navigation stays on the latest local snapshot through every page and history", async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("request", (req) => {
    if (req.url().startsWith("http")) requests.push(req.url());
  });
  await page.route("https://**/*", (route) => route.abort());
  await page.goto(preview("catering"));
  await page
    .locator(".site-header nav")
    .getByRole("link", { name: "Productos", exact: true })
    .click();
  await expect(page).toHaveURL(preview("productos"));
  await expect(page.locator(".flavor-card")).toHaveCount(7);
  await page
    .locator(".site-header nav")
    .getByRole("link", { name: "Catering", exact: true })
    .click();
  await expect(page).toHaveURL(preview("catering"));
  await expect(page.locator("#catering-phone")).toBeVisible();
  await page.locator(".site-brand").click();
  await expect(page).toHaveURL(preview("productos"));
  await expect(page.locator(".flavor-card")).toHaveCount(7);
  await page
    .locator(".site-header nav")
    .getByRole("link", { name: "Catering", exact: true })
    .click();
  await page.locator(".catering-privacy a").click();
  await expect(page).toHaveURL(preview("privacidad") + "#catering");
  await expect(page.locator("#catering")).toHaveText("Solicitudes de catering");
  await page.goBack();
  await expect(page).toHaveURL(preview("catering"));
  await page.goForward();
  await expect(page).toHaveURL(preview("privacidad") + "#catering");
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
test("all internal anchor targets exist locally and external contacts remain unchanged", async ({
  page,
}) => {
  for (const name of ["inicio", "productos", "catering", "privacidad"]) {
    await page.goto(preview(name));
    const links = await page
      .locator("a[href]")
      .evaluateAll((nodes) => nodes.map((a) => a.href));
    for (const href of links) {
      expect(href).not.toMatch(/^https:\/\/gsaco\.github\.io\/Mabell-Ramos/);
      if (href.startsWith("file:"))
        expect(new URL(href).pathname).toMatch(
          /\/(inicio|productos|catering|privacidad)-vista-previa\.html$/,
        );
    }
    await expect(
      page.locator(
        '.site-footer a[href="https://www.instagram.com/mabellramos.dulces/"]',
      ),
    ).toBeVisible();
  }
});
test("portable catering keeps scope choice, validation and WhatsApp summaries working", async ({
  page,
}) => {
  await page.goto(preview("catering"));
  await page
    .getByLabel("¿Qué necesitas?", { exact: true })
    .selectOption("food_and_service");
  await expect(page.locator("#catering-scope")).toHaveValue("food_and_service");
  await page.locator(".catering-submit").click();
  await expect(page.locator("#catering-name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.locator("#catering-name").fill("Prueba local");
  await page.locator("#catering-phone").fill("912345678");
  const href = await page.locator(".catering-whatsapp").getAttribute("href");
  expect(new URL(href).searchParams.get("text")).toContain(
    "Nombre: Prueba local",
  );
});
