import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "../site-src/scripts/catalog-validation.mjs";
import { isDeepStrictEqual } from "node:util";
export function validateOfferTransition(previous, incoming) {
  const prev = validateCatalog(previous);
  const next = validateCatalog(incoming);
  if (next.version === prev.version && !isDeepStrictEqual(next, prev))
    throw Error(
      "Asigna una versión pública nueva para publicar cambios de contenido o precio.",
    );
  for (const o of next.options) {
    const old = prev.options.find((p) => p.id === o.id);
    if (old && o.revision < old.revision)
      throw Error(`La revisión de ${o.name} no puede retroceder.`);
    if (
      old &&
      !isDeepStrictEqual(
        { ...o, revision: null },
        { ...old, revision: null },
      ) &&
      o.revision <= old.revision
    )
      throw Error(
        `Incrementa la revisión de ${o.name} antes de cambiar sus condiciones.`,
      );
    if (
      old &&
      o.revision <= old.revision &&
      o.items.some(
        (item) =>
          !isDeepStrictEqual(
            prev.products.find((product) => product.id === item.productId),
            next.products.find((product) => product.id === item.productId),
          ),
      )
    )
      throw Error(
        `Revisa ${o.name} y aumenta su revisión: cambió uno de los productos que incluye.`,
      );
  }
  return next;
}
async function main() {
  const input = process.argv[2];
  if (!input)
    throw Error(
      "Indica el archivo de oferta pública revisada que descargaste de Gestión.",
    );
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const target = path.join(root, "site-src/content/catalog-public.json");
  const next = validateOfferTransition(
    JSON.parse(await readFile(target, "utf8")),
    JSON.parse(await readFile(input, "utf8")),
  );
  await writeFile(target + ".tmp", JSON.stringify(next, null, 2) + "\n");
  await rename(target + ".tmp", target);
  console.log(
    `Oferta ${next.version} preparada: ${next.products.length} productos y ${next.options.length} opciones. Compila y revisa la web antes de publicar; el PDF original no cambia.`,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
