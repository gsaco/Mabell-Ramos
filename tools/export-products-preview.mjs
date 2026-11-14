// Export a connected, self-contained snapshot. Internal navigation must never
// leave this snapshot for GitHub Pages, which may contain an older release.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
const requestedPage = process.argv[3] || "productos";
const pages = [
  { route: "", name: "inicio", bundle: "products" },
  { route: "productos/", name: "productos", bundle: "products" },
  { route: "catering/", name: "catering", bundle: "catering" },
  { route: "privacidad/", name: "privacidad", bundle: null },
];
if (!pages.some((p) => p.name === requestedPage))
  throw new Error("Unsupported preview page");
if (!out || !path.isAbsolute(out))
  throw new Error("Provide an absolute preview directory.");
const config = JSON.parse(
  await readFile(path.join(root, "site-src/content/site-config.json"), "utf8"),
);
const base = config.siteBase;
const site = config.siteOrigin + base;
const mime = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const embedded = new Map();
async function dataUrl(file) {
  if (!embedded.has(file))
    embedded.set(
      file,
      `data:${mime[path.extname(file)]};base64,${(await readFile(file)).toString("base64")}`,
    );
  return embedded.get(file);
}
async function replaceAsync(str, regex, replacer) {
  for (const match of [...str.matchAll(regex)].reverse())
    str =
      str.slice(0, match.index) +
      (await replacer(match)) +
      str.slice(match.index + match[0].length);
  return str;
}
function localHref(href) {
  if (!href.startsWith(base) && !href.startsWith(site)) return href;
  const target = new URL(href, config.siteOrigin);
  const route = target.pathname.slice(base.length).replace(/index\.html$/, "");
  const page = pages.find((p) => p.route === route || p.route === route + "/");
  if (!page)
    throw new Error(`Preview navigation has an unexported route: ${href}`);
  return `${page.name}-vista-previa.html${target.search}${target.hash}`;
}
const icons = (
  await readFile(path.join(root, "docs/assets/web/iconos-ui.svg"), "utf8")
).replace(
  "<svg ",
  '<svg aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;overflow:hidden" ',
);
let commonJS = await readFile(
  path.join(root, "site-src/scripts/site.js"),
  "utf8",
);
// file:// previews cannot fetch relative JSON or import filesystem ES modules.
// Embed the exact generated runtime and dependencies, keeping business behavior.
for (const dependency of ["contract.mjs", "catalog-validation.mjs"]) {
  const code = await readFile(path.join(root, "docs/site", dependency));
  commonJS = commonJS.replace(
    `"./${dependency}"`,
    `"data:text/javascript;base64,${code.toString("base64")}"`,
  );
}
const configStart = commonJS.indexOf("const configPromise =");
const configEnd = commonJS.indexOf("let configuration =", configStart);
if (configStart < 0 || configEnd < 0)
  throw new Error("Preview runtime injection needs review");
const runtime = JSON.parse(
  await readFile(path.join(root, "docs/site/runtime.json"), "utf8"),
);
commonJS =
  commonJS.slice(0, configStart) +
  `const configPromise = Promise.resolve(${JSON.stringify(runtime)});\n` +
  commonJS.slice(configEnd);
await mkdir(out, { recursive: true });
await mkdir(path.join(out, "media"), { recursive: true });
await copyFile(
  path.join(root, "docs/assets/web/historia/mabell-ramos-historia.mp4"),
  path.join(out, "media/mabell-ramos-historia.mp4"),
);
for (const page of pages) {
  let html = await readFile(
    path.join(root, "docs", page.route, "index.html"),
    "utf8",
  );
  html = html
    .replace(/<script type="module"[^>]*><\/script>/g, "")
    .replace(/<link rel="preload"[^>]*>/g, "");
  // The legacy catalogue redirect belongs to the hosted site, not this snapshot.
  if (!page.route)
    html = html.replace(/<script>if\(\/\^#pagina-[\s\S]*?<\/script>/, "");
  html = html.replace(/<source\b[^>]*type="image\/avif"[^>]*>/g, "");
  html = await replaceAsync(html, /<(img|source)\b[^>]*>/g, async ([tag]) => {
    if (tag.includes('type="video/mp4"'))
      return tag.replace(
        /src="[^"]+"/,
        'src="media/mabell-ramos-historia.mp4"',
      );
    const set = tag.match(/srcset="([^"]+)"/);
    const src = set
      ? set[1].split(", ").at(-1).split(" ")[0]
      : tag.match(/src="([^"]+)"/)?.[1];
    if (!src?.startsWith(base + "assets/")) return tag;
    const file = path.join(root, "docs", src.slice(base.length));
    tag = tag.replace(/\s(?:srcset|sizes|src)="[^"]*"/g, "");
    return tag.replace(
      />$/,
      ` ${tag.startsWith("<source") ? "srcset" : "src"}="${await dataUrl(file)}">`,
    );
  });
  html = await replaceAsync(
    html,
    /poster="([^"]+)"/g,
    async ([attribute, src]) =>
      src.startsWith(base + "assets/")
        ? `poster="${await dataUrl(path.join(root, "docs", src.slice(base.length)))}"`
        : attribute,
  );
  html = await replaceAsync(
    html,
    /<link\b[^>]*rel="(?:icon|apple-touch-icon)"[^>]*>/g,
    async ([tag]) => {
      const href = tag.match(/href="([^"]+)"/)?.[1];
      return href?.startsWith(base + "assets/")
        ? tag.replace(
            href,
            await dataUrl(path.join(root, "docs", href.slice(base.length))),
          )
        : tag;
    },
  );
  let css = await readFile(path.join(root, "site-src/styles/site.css"), "utf8");
  if (page.bundle)
    css +=
      "\n" +
      (await readFile(
        path.join(root, `site-src/styles/${page.bundle}.css`),
        "utf8",
      ));
  css = await replaceAsync(
    css,
    /url\(["']?(\.\.\/assets\/web\/[^)'"\s]+)["']?\)/g,
    async ([, src]) =>
      `url("${await dataUrl(path.resolve(root, "docs/site", src))}")`,
  );
  html = html
    .replace(/<link rel="stylesheet"[^>]*>/g, "")
    .replace("</head>", `<style>${css}</style></head>`);
  html = html.replaceAll(`${base}assets/web/iconos-ui.svg#`, "#");
  html = html.replace('<main id="contenido">', icons + '<main id="contenido">');
  html = html.replace(/<a\b[^>]*>/g, (tag) =>
    tag.replace(/href="([^"]*)"/, (_, href) => `href="${localHref(href)}"`),
  );
  const script = page.bundle
    ? await readFile(
        path.join(root, `site-src/scripts/${page.bundle}.js`),
        "utf8",
      )
    : "";
  html = html.replace(
    "</body>",
    `<script type="module">${commonJS}</script><script type="module">${script}</script></body>`,
  );
  await writeFile(path.join(out, `${page.name}-vista-previa.html`), html);
}
console.log(
  `Connected preview (Inicio, Productos, Catering, Privacidad): ${path.join(out, requestedPage + "-vista-previa.html")}`,
);
