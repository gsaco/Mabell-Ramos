import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { validateOfferTransition } from "../../tools/import-offer.mjs";

const reference = JSON.parse(
  await readFile("site-src/content/catalog-public.json", "utf8"),
);
const product = {
  id: "test-product",
  name: "Preparación de prueba",
  family: "Prueba",
  description: "Descripción para comprobar el importador.",
  culturalDescription: "Texto de prueba, sin publicación comercial.",
  attributes: { filling: "Relleno de prueba" },
  validVariants: [],
  image: null,
};
const option = {
  id: "test-option",
  revision: 3,
  name: "Caja de prueba · 6 piezas",
  occasion: "regalar",
  items: [{ productId: product.id, quantity: 6 }],
  saleUnit: "caja",
  presentation: "Caja de prueba",
  priceCents: 3000,
  currency: "PEN",
  includes: ["Seis piezas"],
  deliveryConditions: "Entrega por coordinar.",
  allowedChanges: "Consultar relleno.",
  availability: "on_request",
  image: null,
};
const approved = () => ({
  ...structuredClone(reference),
  version: "test-public-v1",
  products: [structuredClone(product)],
  options: [structuredClone(option)],
});

test("importing the same version with reordered fields is idempotent", () => {
  const original = approved();
  const reordered = { options: original.options, ...original };
  assert.deepEqual(validateOfferTransition(original, reordered), original);
});
test("a changed price needs both a new public version and option revision", () => {
  const old = approved(),
    next = structuredClone(old);
  next.options[0].priceCents = 3200;
  assert.throws(
    () => validateOfferTransition(old, next),
    /versión pública nueva/,
  );
  next.version = "test-public-v2";
  assert.throws(
    () => validateOfferTransition(old, next),
    /Incrementa la revisión/,
  );
  next.options[0].revision++;
  assert.deepEqual(validateOfferTransition(old, next), next);
});
test("an option revision cannot move backwards even if content is unchanged", () => {
  const old = approved(),
    next = structuredClone(old);
  next.version = "test-public-v2";
  next.options[0].revision = 2;
  assert.throws(
    () => validateOfferTransition(old, next),
    /no puede retroceder/,
  );
});
test("withdrawal and condition changes require review and preserve the PDF edition", () => {
  const old = approved(),
    next = structuredClone(old);
  next.version = "test-public-v2";
  next.options[0].availability = "temporarily_unavailable";
  assert.throws(
    () => validateOfferTransition(old, next),
    /Incrementa la revisión/,
  );
  next.options[0].revision++;
  assert.equal(
    validateOfferTransition(old, next).catalog.version,
    old.catalog.version,
  );
});
test("private state cannot become a public offer through the importer", () => {
  assert.throws(
    () =>
      validateOfferTransition(reference, {
        ...reference,
        clients: [{ name: "Prueba" }],
      }),
    /no público/,
  );
});
test("changed product attributes cannot silently reuse a published option revision", () => {
  const old = approved(),
    next = structuredClone(old);
  next.version = "test-public-v2";
  next.products[0].attributes.filling = "Otro relleno revisado";
  assert.throws(
    () => validateOfferTransition(old, next),
    /cambió uno de los productos/,
  );
  next.options[0].revision++;
  assert.deepEqual(validateOfferTransition(old, next), next);
});
test("CLI without an export fails without changing the current public data", async () => {
  const before = await readFile("site-src/content/catalog-public.json", "utf8");
  assert.throws(
    () =>
      execFileSync(process.execPath, ["tools/import-offer.mjs"], {
        stdio: "pipe",
      }),
    (error) => {
      assert.match(error.stderr.toString(), /Indica el archivo/);
      return true;
    },
  );
  assert.equal(
    await readFile("site-src/content/catalog-public.json", "utf8"),
    before,
  );
});
