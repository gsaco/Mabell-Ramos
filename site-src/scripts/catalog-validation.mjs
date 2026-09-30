const allowed = (o, keys, name) => {
  if (!o || typeof o !== "object" || Array.isArray(o))
    throw Error(`${name}: objeto inválido`);
  for (const k of Object.keys(o))
    if (!keys.includes(k)) throw Error(`${name}: campo no público ${k}`);
};
const str = (s, name, max = 2000) => {
  if (typeof s !== "string" || !s.trim() || s.length > max)
    throw Error(`${name}: texto inválido`);
};
const id = (s, name) => {
  str(s, name, 96);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(s))
    throw Error(`${name}: identificador inválido`);
};
const list = (v, name) => {
  if (!Array.isArray(v)) throw Error(`${name}: lista inválida`);
};
const ints = (v, name, min = 1) => {
  if (!Number.isSafeInteger(v) || v < min || v > 1e9)
    throw Error(`${name}: número inválido`);
};
function image(v) {
  if (v === null) return;
  allowed(v, ["src", "alt", "kind"], "image");
  str(v.alt, "image.alt", 300);
  str(v.src, "image.src", 1000);
  if (!["real", "illustration"].includes(v.kind))
    throw Error("image.kind inválido");
  if (!/^https:\/\//.test(v.src) && !/^assets\/[a-zA-Z0-9/._-]+$/.test(v.src))
    throw Error("image.src requiere HTTPS o assets públicos");
  const u = new URL(v.src, "https://example.invalid/");
  if (u.username || u.password || u.protocol !== "https:")
    throw Error("image.src inválida");
}
export function validateCatalog(value) {
  allowed(
    value,
    [
      "schemaVersion",
      "version",
      "publishedAt",
      "products",
      "options",
      "contact",
      "catalog",
    ],
    "catalog",
  );
  if (value.schemaVersion !== 1) throw Error("Versión de catálogo inválida");
  id(value.version, "version");
  str(value.publishedAt, "publishedAt", 50);
  if (Number.isNaN(Date.parse(value.publishedAt)))
    throw Error("publishedAt inválido");
  list(value.products, "products");
  list(value.options, "options");
  const ids = new Set();
  for (const p of value.products) {
    allowed(
      p,
      [
        "id",
        "name",
        "family",
        "description",
        "culturalDescription",
        "attributes",
        "ingredients",
        "allergens",
        "validVariants",
        "image",
      ],
      "product",
    );
    id(p.id, "product.id");
    if (ids.has(p.id)) throw Error("Producto duplicado");
    ids.add(p.id);
    for (const k of ["name", "family", "description", "culturalDescription"])
      str(p[k], `product.${k}`);
    allowed(
      p.attributes,
      ["filling", "cacao", "size", "shape", "coverage", "decoration"],
      "attributes",
    );
    for (const v of Object.values(p.attributes)) str(v, "attribute", 300);
    for (const k of ["ingredients", "allergens"]) if (k in p) str(p[k], k);
    list(p.validVariants, "validVariants");
    p.validVariants.forEach((x) => str(x, "variant", 300));
    if (new Set(p.validVariants).size !== p.validVariants.length)
      throw Error("Variante duplicada");
    image(p.image);
  }
  const optids = new Set();
  for (const o of value.options) {
    allowed(
      o,
      [
        "id",
        "revision",
        "name",
        "occasion",
        "items",
        "saleUnit",
        "presentation",
        "priceCents",
        "currency",
        "includes",
        "deliveryConditions",
        "allowedChanges",
        "availability",
        "image",
      ],
      "option",
    );
    id(o.id, "option.id");
    if (optids.has(o.id)) throw Error("Opción duplicada");
    optids.add(o.id);
    ints(o.revision, "revision");
    for (const k of [
      "name",
      "saleUnit",
      "presentation",
      "deliveryConditions",
      "allowedChanges",
    ])
      str(
        o[k],
        k,
        {
          name: 160,
          saleUnit: 80,
          presentation: 1000,
          deliveryConditions: 1000,
          allowedChanges: 1000,
        }[k],
      );
    ints(o.priceCents, "priceCents", 1);
    if (
      o.currency !== "PEN" ||
      !["disfrutar", "regalar", "descubrir"].includes(o.occasion) ||
      !["on_request", "temporarily_unavailable"].includes(o.availability)
    )
      throw Error("Condiciones de opción inválidas");
    list(o.items, "items");
    if (!o.items.length || o.items.length > 100)
      throw Error("Opción sin contenido");
    for (const item of o.items) {
      allowed(item, ["productId", "variantId", "quantity"], "item");
      const p = value.products.find((p) => p.id === item.productId);
      if (!p) throw Error("Producto no publicado");
      ints(item.quantity, "quantity");
      if (item.variantId) id(item.variantId, "variantId");
      if (item.quantity > 10000) throw Error("Cantidad demasiado alta");
      if (item.variantId && !p.validVariants.includes(item.variantId))
        throw Error("Variante no admitida");
    }
    list(o.includes, "includes");
    o.includes.forEach((s) => str(s, "includes"));
    image(o.image);
  }
  allowed(value.contact, ["instagram", "whatsapp"], "contact");
  if (value.contact.whatsapp !== null)
    throw Error(
      "La publicación de teléfonos está desactivada por el propietario",
    );
  if (
    !/^https:\/\/www\.instagram\.com\/[a-zA-Z0-9._]+\/$/.test(
      value.contact.instagram,
    )
  )
    throw Error("Instagram inválido");
  allowed(value.catalog, ["version", "originalPdfUrl", "pages"], "catalog");
  id(value.catalog.version, "catalog.version");
  ints(value.catalog.pages, "pages");
  if (!/^https:\/\/github\.com\//.test(value.catalog.originalPdfUrl))
    throw Error("PDF debe ser un enlace público de GitHub");
  return structuredClone(value);
}
