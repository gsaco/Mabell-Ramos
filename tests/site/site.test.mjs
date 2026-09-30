import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { validateCatalog } from "../../site-src/scripts/catalog-validation.mjs";
const read = (p) => readFile(p, "utf8");
const data = JSON.parse(await read("site-src/content/catalog-public.json"));
test("public offer validates and contains no test records or business telephone", () => {
  assert.deepEqual(validateCatalog(data), data);
  for (const record of [...data.options, ...data.products])
    assert.doesNotMatch(record.id, /^test-/);
  if (data.version === "catalogo-referencia-2026-09-29") {
    assert.equal(data.options.length, 0);
    assert.equal(data.products.length, 0);
  }
  assert.equal(data.contact.whatsapp, null);
});
test("private fields are rejected before rendering", () => {
  for (const field of ["clients", "costs", "notes", "token", "orders"])
    assert.throws(() => validateCatalog({ ...data, [field]: [] }));
});
test("a corrupt public catalog does not become an offer", () => {
  assert.throws(() => validateCatalog({ ...data, schemaVersion: 2 }));
  assert.throws(() =>
    validateCatalog({
      ...data,
      contact: { ...data.contact, whatsapp: "+51123456789" },
    }),
  );
});
test("all routes are real documents with navigation, semantic form and no WhatsApp numbers", async () => {
  for (const p of [
    "index.html",
    "productos/index.html",
    "catering/index.html",
    "catalogo/index.html",
    "privacidad/index.html",
    "404.html",
  ]) {
    const s = await read(`docs/${p}`);
    assert.match(s, /<html lang="es">/);
    assert.match(s, /Ir al contenido/);
    assert.match(s, /site\/site.js/);
    assert.doesNotMatch(s, /wa\.me|api\.whatsapp/);
    assert.match(s, /Privacidad/);
  }
});
test("legacy catalogue fragment redirects before storefront resources", async () => {
  const s = await read("docs/index.html");
  assert.ok(s.indexOf("location.replace") < s.indexOf("hero-editorial"));
  assert.match(s, /n>=1&&n<=14\?n:1/);
});
test("catalogue requests derivatives until original zoom, one neighbor, no PDF preload", async () => {
  const s = await read("docs/catalogo/viewer.js");
  assert.match(s, /\.\.\/assets\/previews/);
  assert.match(s, /saveData/);
  assert.match(s, /const neighbor = current \+ lastDirection/);
  assert.match(s, /viewport.contains\(event.target\)/);
  const h = await read("docs/catalogo/index.html");
  assert.doesNotMatch(h, /<iframe|<embed|<object/);
  assert.match(h, /340 MB/);
});
test("14 reviewed text pages and prices retain explicit units", async () => {
  const ps = JSON.parse(await read("docs/site/catalog-pages.json"));
  assert.equal(ps.length, 14);
  assert.deepEqual(
    ps.map((p) => p.page),
    Array.from({ length: 14 }, (_, i) => i + 1),
  );
  assert.ok(ps.every((p) => p.sections.length));
  assert.match(JSON.stringify(ps[1]), /18% cacao/);
  assert.match(JSON.stringify(ps[10]), /100/);
});
test("production does not leak local preview endpoint or enabled receipt", async () => {
  const c = JSON.parse(await read("docs/site/runtime.json"));
  assert.equal(c.receiverEndpoint, null);
  assert.equal(c.privacyApproved, false);
  assert.equal(c.localPreview, false);
  assert.equal(c.contact.whatsapp, null);
});
test("motion and fonts use deliberate local assets", async () => {
  const s = await read("docs/site/site.css");
  assert.match(s, /prefers-reduced-motion:\s*reduce/);
  assert.match(s, /font-display:\s*swap/);
  assert.doesNotMatch(s, /fonts.googleapis/);
  for (const f of [
    "inter-400.woff2",
    "inter-600.woff2",
    "bodoni-moda-600.woff2",
    "logo-128.webp",
    "feria-mesa-640.webp",
  ])
    assert.ok((await stat(`docs/assets/web/${f}`)).size > 100);
});
test("original PDF retained in full locally, or by exact LFS identity in CI", async () => {
  const size = (await stat("Entregables/catalogo.pdf")).size;
  if (size === 339628407) return;
  assert.ok(size < 1024, "Unexpected replacement of the original PDF");
  const pointer = await read("Entregables/catalogo.pdf");
  assert.match(pointer, /^version https:\/\/git-lfs.github.com\/spec\/v1\n/);
  assert.match(
    pointer,
    /\noid sha256:e732ab433808cf0baaccd79c6deda0513269b657288b73f91f4a43e889d94b51\n/,
  );
  assert.match(pointer, /\nsize 339628407\n?$/);
});
test("public web contains no operational AppState", async () => {
  const s = await read("docs/site/catalog-public.json");
  assert.doesNotMatch(
    s,
    /clientId|contactName|accessToken|costCents|margin|paidAt|orders/,
  );
});
