import { writeFile, mkdir, symlink, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
const dir = ".local-data/fixture-site";
await mkdir(dir, { recursive: true });
const products = Array.from({ length: 6 }, (_, i) => ({
  id: `test-product-${i + 1}`,
  name: `Preparación de prueba ${i + 1}`,
  family: "Prueba",
  description: "Descripción verificada para probar la interfaz.",
  culturalDescription:
    "Texto cultural de prueba. No corresponde a una oferta comercial publicada.",
  attributes: { filling: "Relleno de prueba" },
  validVariants: ["base"],
  image: null,
}));
const options = products.map((p, i) => ({
  id: `test-option-${i + 1}`,
  revision: 1,
  name: `Caja de prueba ${i + 1} · 6 unidades`,
  occasion: ["disfrutar", "regalar", "descubrir"][Math.floor(i / 2)],
  items: [{ productId: p.id, variantId: "base", quantity: 6 }],
  saleUnit: "caja",
  presentation: "Caja de prueba",
  priceCents: 3000 + i * 100,
  currency: "PEN",
  includes: ["Una caja con seis piezas"],
  deliveryConditions: "Entrega de prueba; traslado se cotiza aparte.",
  allowedChanges: "Consultar cambio de relleno.",
  availability: i === 5 ? "temporarily_unavailable" : "on_request",
  image: null,
}));
const data = {
  schemaVersion: 1,
  version: "test-catalog-v1",
  publishedAt: "2026-09-29T17:00:00.000Z",
  products,
  options,
  contact: {
    whatsapp: null,
    instagram: "https://www.instagram.com/mabellramos.dulces/",
  },
  catalog: {
    version: "catalogo-referencia-2026-09-29",
    pages: 14,
    originalPdfUrl:
      "https://github.com/gsaco/Mabell-Ramos/raw/refs/heads/main/Entregables/catalogo.pdf",
  },
};
await writeFile(".local-data/catalog-fixture.json", JSON.stringify(data));
execFileSync(process.execPath, ["tools/build-site.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PUBLIC_CATALOG_PATH: path.resolve(".local-data/catalog-fixture.json"),
    SITE_OUTPUT_DIR: path.resolve(dir),
  },
});
await rm(path.join(dir, "assets"), { recursive: true, force: true });
await symlink(path.resolve("docs/assets"), path.join(dir, "assets"), "dir");
