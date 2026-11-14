import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import { validateCatalog } from "../site-src/scripts/catalog-validation.mjs";
import { renderCatering } from "./catering-page.mjs";
import { renderProductShowcase } from "./product-showcase.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = async (name) =>
  JSON.parse(await readFile(path.join(root, "site-src/content", name), "utf8"));
const data = validateCatalog(
  process.env.PUBLIC_CATALOG_PATH
    ? JSON.parse(await readFile(process.env.PUBLIC_CATALOG_PATH, "utf8"))
    : await json("catalog-public.json"),
);
const outRoot = process.env.SITE_OUTPUT_DIR
  ? path.resolve(process.env.SITE_OUTPUT_DIR)
  : path.join(root, "docs");
const editorial = await json("editorial.json");
const imagery = await json("editorial-images.json");
const productShowcase = await json("product-showcase.json");
const productRevision = createHash("sha256")
  .update(await readFile(path.join(root, "site-src/styles/products.css")))
  .update(await readFile(path.join(root, "site-src/scripts/products.js")))
  .digest("hex")
  .slice(0, 12);
const productAssetRoot = path.join(
  root,
  "assets-source/productos-finales-2026-11-12",
);
const productAssets = JSON.parse(
  await readFile(path.join(productAssetRoot, "manifest.json"), "utf8"),
);
const combinationAssetRoot = path.join(
  root,
  "assets-source/combinaciones-finales-2026-11-12",
);
const combinationAssets = JSON.parse(
  await readFile(path.join(combinationAssetRoot, "manifest.json"), "utf8"),
);
const config = await json("site-config.json");
if (
  config.receiverEndpoint &&
  (!config.privacyApproved ||
    !config.privacyNoticeVersion ||
    !config.privacy.retention ||
    !config.turnstileSiteKey)
)
  throw Error(
    "Approve privacy and configure bot protection before enabling the receiver.",
  );
if (config.receiverEndpoint && !/^https:\/\//.test(config.receiverEndpoint))
  throw Error("Production receiver requires HTTPS.");
const base = process.env.SITE_BASE ?? config.siteBase;
if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base))
  throw new Error("SITE_BASE must be an absolute directory path.");
const url = (route) => `${base}${route.replace(/^\//, "")}`;
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const e = escape;
const asset = (file) => url(`assets/web/${file}`);
const ig = data.contact.instagram;
const icons = {
  mensaje: "message",
  bandeja: "tray",
  calendario: "calendar",
  hoja: "leaf",
  flecha: "arrow-right",
};
const svg = (name, cls = "") =>
  `<svg class="icon ${cls}" aria-hidden="true" width="24" height="24"><use href="${asset("iconos-ui.svg")}#${icons[name] || name}"></use></svg>`;
const arrow = '<span aria-hidden="true">↗</span>';
const link = (href, text, cls = "text-link") =>
  `<a class="${cls}" href="${e(href)}">${text} ${arrow}</a>`;
const titles = [
  "Portada",
  "Chocotejas",
  "Alfajores",
  "Bombones",
  "Trufas y donas",
  "Paquetes de regalo",
  "Bocaditos dulces",
  "Catering dulce",
  "Catering salado",
  "Arma tu selección",
  "Panes personales",
  "Bebidas",
  "Especiales por encargo",
  "Cómo hacer tu pedido",
];
const occasionNames = {
  disfrutar: "Para disfrutar",
  regalar: "Para regalar",
  descubrir: "Para descubrir",
};
const groups = Object.keys(occasionNames).filter((key) =>
  data.options.some((o) => o.occasion === key),
);
const nav = (route) =>
  `<a class="skip-link" href="#contenido">Ir al contenido</a><header class="site-header"><div class="container header-inner"><a class="site-brand" href="${url("productos/")}" aria-label="Mabell Ramos, productos"><img src="${asset("logo-128.webp")}" alt="" width="64" height="64"><span>MABELL RAMOS<small>${route === "productos/" ? "PASTELERÍA AFROPERUANA" : "DULCES CON RAÍZ"}</small></span></a><nav aria-label="Principal">${[
    ["productos/", "Productos"],
    ["catering/", "Catering"],
  ]
    .map(
      ([p, t]) =>
        `<a href="${url(p)}" ${p === route ? 'aria-current="page"' : ""}>${t}</a>`,
    )
    .join(
      "",
    )}</nav><a class="button button-small" href="${route === "productos/" ? "https://wa.me/51932666526?text=Hola%2C%20me%20interesan%20sus%20dulces." : route === "catering/" ? "#consulta-evento" : "https://wa.me/51932666526?text=Hola%2C%20me%20interesan%20sus%20dulces."}">${route === "productos/" ? "WhatsApp" : route === "catering/" ? "Solicitar cotización" : "Consultar"} ${svg("mensaje")}</a></div></header>`;
const footer = (route = "") =>
  `<footer class="site-footer"><div class="container footer-grid"><div><a class="footer-brand" href="${url("productos/")}">Mabell Ramos</a><p>Pastelería fina con raíz afroperuana.</p><small>Magdalena del Mar, Lima</small></div><nav aria-label="Pie de página">${link(url("productos/"), "Productos")}${link(url("catering/"), "Catering")}</nav><div>${link(ig, "Instagram", "text-link external")}<p>${link(url("privacidad/"), "Privacidad")}</p></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} Mabell Ramos</span></div></footer>`;
function picture(name, alt, hero = false) {
  const spec = imagery[name];
  if (!spec) throw new Error(`Unknown editorial image: ${name}`);
  const widths = spec.widths;
  const stem = spec.stem;
  const sizes = hero
    ? "(min-width:1256px) 623px, (max-width:760px) calc(100vw - 40px), calc(56vw - 81px)"
    : "(max-width:760px) calc(100vw - 40px), (min-width:1256px) 365px, 33vw";
  const set = (format, values = widths) =>
    values.map((w) => `${asset(`${stem}-${w}.${format}`)} ${w}w`).join(", ");
  const phoneWidths = widths.filter((w) => w <= 800);
  const source = `<source type="image/avif" media="(max-width:480px)" srcset="${set("avif", phoneWidths)}" sizes="calc(100vw - 40px)"><source type="image/avif" srcset="${set("avif")}" sizes="${sizes}"><source media="(max-width:480px)" srcset="${set("webp", phoneWidths)}" sizes="calc(100vw - 40px)">`;
  return `<figure class="editorial-image ${hero ? "hero-image" : ""}"><picture>${source}<img src="${asset(`${stem}-${widths[0]}.webp`)}" srcset="${widths.map((w) => `${asset(`${stem}-${w}.webp`)} ${w}w`).join(", ")}" sizes="${hero ? "(min-width:1256px) 623px, (max-width:760px) calc(100vw - 40px), calc(56vw - 81px)" : "(max-width:760px) calc(100vw - 40px), (min-width:1256px) 365px, 33vw"}" width="${spec.width}" height="${spec.height}" alt="${e(alt || spec.alt)}" ${hero ? 'fetchpriority="high"' : 'loading="lazy" fetchpriority="low"'} decoding="async"></picture><figcaption>Presentación referencial · Ilustración editorial</figcaption></figure>`;
}
const intro = (eyebrow, title, text) =>
  `<div class="page-intro"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="lead">${text}</p></div>`;
const steps = (catering) =>
  `<ol class="steps">${(catering
    ? [
        [
          "01",
          "Nos cuentas tu evento",
          "Fecha aproximada, personas y lo que necesitas.",
          "mensaje",
        ],
        [
          "02",
          "Definimos alimentos y servicio",
          "Cantidades, entrega, montaje y atención según el alcance.",
          "bandeja",
        ],
        [
          "03",
          "Confirmamos condiciones y fecha",
          "Revisamos disponibilidad antes de acordar el servicio.",
          "calendario",
        ],
      ]
    : [
        ["01", "Elige", "Explora los productos y elige tus favoritos.", "hoja"],
        [
          "02",
          "Cuéntanos qué necesitas",
          "Indica tu ocasión, fecha y presentación.",
          "mensaje",
        ],
        [
          "03",
          "Coordinamos contigo",
          "Confirmamos disponibilidad, precio y entrega.",
          "calendario",
        ],
      ]
  )
    .map(
      ([n, t, d, i]) =>
        `<li><div class="step-mark"><span>${n}</span>${svg(i)}</div><h3>${t}</h3><p>${d}</p></li>`,
    )
    .join("")}</ol>`;
let formCounter = 0;
function form({
  kind = "product_general",
  source = "/productos/",
  option = null,
  catalog = false,
  event = false,
  occasion = null,
} = {}) {
  const id = `consulta-${++formCounter}`;
  return `<form method="post" class="inquiry-form" id="${id}" data-kind="${kind}" data-source="${source}" ${option ? `data-option-id="${e(option.id)}" data-option-revision="${option.revision}"` : ""} ${catalog ? "data-catalog-form" : ""}>
 <div class="form-context" ${catalog ? "data-catalog-context" : ""}>${option ? `<strong>${e(option.name)}</strong><span>${e(option.saleUnit)} · ${e(option.presentation)}</span>` : catalog ? "Consulta sobre la página seleccionada" : event ? "Cuéntanos tu evento" : "Cuéntanos qué te gustaría pedir"}</div>
 ${event ? `<fieldset><legend>Tu evento</legend><label for="${id}-scope">¿Qué necesitas?</label><select id="${id}-scope" name="scope"><option value="unsure">Aún no lo sé</option><option value="food_only">Sólo alimentos</option><option value="food_and_service">Alimentos y servicio</option></select><label for="${id}-attendees">Personas aproximadas <span>(opcional)</span></label><input id="${id}-attendees" name="attendees" type="number" inputmode="numeric" min="1" max="10000" placeholder="Aún por definir"></fieldset>` : ""}
 ${option ? `<label for="${id}-quantity">Cantidad (${e(option.saleUnit)})</label><input id="${id}-quantity" name="quantity" type="number" min="1" max="1000" value="1" required>` : ""}
 ${
   !event
     ? `<label for="${id}-occasion">Es para… <span>(opcional)</span></label><select id="${id}-occasion" name="occasion"><option value="">Prefiero conversarlo</option>${[
         ["disfrutar", "Disfrutar o volver a pedir"],
         ["regalar", "Regalar"],
         ["descubrir", "Probar nuevos sabores"],
         ["evento", "Una reunión o evento"],
         ["otra", "Otra ocasión"],
       ]
         .map(
           ([v, t]) =>
             `<option value="${v}" ${occasion === v ? "selected" : ""}>${t}</option>`,
         )
         .join("")}</select>`
     : ""
 }
 ${kind === "product_general" ? `<label for="${id}-request">¿Qué te gustaría pedir?</label><input id="${id}-request" name="requestText" maxlength="180" required placeholder="Una preparación, un regalo o repetir un pedido"><small>Nos ayuda a entender tu consulta.</small>` : ""}
 <div class="field-pair"><div><label for="${id}-date">Fecha deseada <span>(opcional)</span></label><input id="${id}-date" name="requestedDate" type="date"><small>Puedes dejarla por definir.</small></div><div><label for="${id}-district">Distrito o zona <span>(opcional)</span></label><input id="${id}-district" name="district" maxlength="80" autocomplete="address-level2"></div></div>
 <fieldset><legend>Cómo te contactamos</legend><label for="${id}-name">Tu nombre</label><input id="${id}-name" name="name" required minlength="2" maxlength="80" autocomplete="name"><label for="${id}-email">Tu correo electrónico</label><input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email"><small>Usaremos este correo para responder tu consulta.</small></fieldset>
 <details class="additional"><summary>${event ? "Añadir detalles del evento" : "Añadir un comentario o referencia de recompra"}</summary><div>${
   event
     ? `<label for="${id}-time">Horario aproximado <span>(opcional)</span></label><input id="${id}-time" name="time" type="time"><fieldset class="checks"><legend>¿Qué te interesa?</legend>${[
         ["sweet", "Dulces"],
         ["savory", "Salados"],
         ["drinks", "Bebidas"],
         ["setup", "Montaje"],
         ["tableware", "Menaje"],
         ["staff", "Atención"],
       ]
         .map(
           ([v, t]) =>
             `<label><input type="checkbox" name="interest" value="${v}">${t}</label>`,
         )
         .join("")}</fieldset>`
     : ""
 }<label for="${id}-message">${event ? "¿Hay algo más que debamos saber?" : "¿Qué preparación buscas o qué pedido quieres repetir?"}</label><textarea id="${id}-message" name="message" rows="3" maxlength="${kind === "product_general" ? 300 : 500}"></textarea><small>Hasta ${kind === "product_general" ? 300 : 500} caracteres. No incluyas datos de pago.</small></div></details>
 <div class="honeypot" aria-hidden="true"><label for="${id}-website">Sitio web</label><input id="${id}-website" name="website" tabindex="-1" autocomplete="off"></div>
 <p class="privacy-note">Usaremos estos datos para atender tu consulta. ${link(url("privacidad/"), "Cómo tratamos tus datos")}</p><div class="bot-check"></div><p class="form-status" role="status" aria-live="polite"></p><button class="button submit-inquiry" type="submit" disabled>${event ? "Enviar consulta de evento" : "Enviar consulta"} ${svg("flecha")}</button><button type="button" class="button button-secondary edit-inquiry" hidden>Revisar o cambiar datos</button><p class="form-help">Revisaremos disponibilidad y condiciones antes de confirmar el pedido.</p><a class="text-link external" href="${ig}">Prefiero escribir por Instagram ${arrow}</a><noscript><p>Para enviar el formulario necesitas activar JavaScript. También puedes escribirnos por Instagram.</p></noscript></form>`;
}
function consultation() {
  return `<section class="section consultation" id="consulta"><div class="container consultation-grid"><div><p class="eyebrow">CONVERSEMOS</p><h2>Una ocasión.<br>Una propuesta para ti.</h2><p>¿Buscas dulces o estás organizando una reunión? Elige cómo empezar y cuéntanos lo que necesitas.</p>${link(ig, "También estamos en Instagram", "text-link external")}</div><div class="home-contact-actions"><a class="button" href="https://wa.me/51932666526?text=Hola%2C%20Mabell%20Ramos.%20Me%20interesan%20sus%20chocotejas%20y%20alfajores.">Consultar por WhatsApp ${svg("mensaje")}</a><a class="text-link" href="${url("catering/#consulta-evento")}">Solicitar cotización de catering ${arrow}</a></div></div></section>`;
}
const faq = () =>
  `<section class="section faq"><div class="container narrow"><p class="eyebrow">ANTES DE ENCARGAR</p><h2>Lo coordinamos contigo.</h2>${[
    [
      "¿Puedo cambiar sabores o presentación?",
      "Revisa los cambios disponibles en cada opción. Si necesitas algo distinto, cuéntanos para confirmar precio y preparación.",
    ],
    [
      "¿Cómo coordinamos la entrega?",
      "Indícanos fecha y distrito. Confirmaremos contigo la entrega y su costo.",
    ],
    [
      "¿Enviar una consulta confirma el pedido?",
      "Primero revisaremos disponibilidad y condiciones contigo. El pedido se confirma después del acuerdo.",
    ],
    [
      "¿Quiero pedir lo mismo que antes?",
      "Puedes compartirnos el nombre de la opción o la referencia de tu pedido anterior. No necesitas crear una cuenta.",
    ],
  ]
    .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`)
    .join(
      "",
    )}${link("#consulta-productos", "Consultar por productos")}</div></section>`;
function optionCard(o) {
  const items = o.items.map(
    (i) =>
      `${i.quantity} ${data.products.find((p) => p.id === i.productId).name}${i.variantId ? ` · ${i.variantId}` : ""}`,
  );
  return `<article class="option-card" id="opcion-${e(o.id)}">${o.image ? publicImage(o.image) : ""}<p class="eyebrow">${occasionNames[o.occasion]}</p><h3>${e(o.name)}</h3><p>${e(items.join(" · "))}</p><p class="price">${new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(o.priceCents / 100)} <small>por ${e(o.saleUnit)}</small></p><details><summary>Ver contenido y consultar</summary><dl><dt>Qué incluye</dt><dd><ul>${items.map((i) => `<li>${e(i)}</li>`).join("")}</ul>${o.includes.map((i) => `<p>${e(i)}</p>`).join("")}</dd><dt>Presentación</dt><dd>${e(o.presentation)}</dd><dt>Entrega</dt><dd>${e(o.deliveryConditions)}</dd><dt>Cambios</dt><dd>${e(o.allowedChanges)}</dd></dl><p>Conoce estos sabores: ${o.items.map((i) => link(`#producto-${i.productId}`, e(data.products.find((p) => p.id === i.productId).name))).join(", ")}</p>${o.availability === "on_request" ? `<details class="option-consultation"><summary>Consultar esta opción</summary>${form({ kind: "product_option", option: o })}</details>` : '<p class="availability">Esta opción no está disponible por el momento.</p><a href="#opciones">Ver otras opciones</a>'}<button type="button" class="share-option text-link" data-share-id="${e(o.id)}">Compartir opción ↗</button><span role="status" class="share-status"></span></details></article>`;
}
function publicImage(im) {
  const safe = im.src.startsWith("https://") ? im.src : url(im.src);
  return `<figure class="editorial-image"><img src="${e(safe)}" alt="${e(im.alt)}" width="800" height="800" loading="lazy" decoding="async">${im.kind === "illustration" ? "<figcaption>Presentación referencial · Ilustración editorial</figcaption>" : ""}</figure>`;
}
function productCard(p) {
  return `<article class="product-ficha" id="producto-${e(p.id)}">${p.image ? publicImage(p.image) : ""}<p class="eyebrow">${e(p.family)}</p><h3>${e(p.name)}</h3><p>${e(p.description)}</p><dl>${Object.entries(
    p.attributes,
  )
    .map(
      ([k, v]) =>
        `<dt>${e({ filling: "Relleno", cacao: "Cacao del chocolate", size: "Tamaño", shape: "Forma", coverage: "Cobertura", decoration: "Decoración" }[k] || k)}</dt><dd>${e(v)}</dd>`,
    )
    .join(
      "",
    )}</dl>${p.validVariants.length ? `<p><strong>Variantes:</strong> ${p.validVariants.map(e).join(", ")}.</p>` : ""}<p class="cultural">${e(p.culturalDescription)}</p>${p.ingredients ? `<p><strong>Ingredientes:</strong> ${e(p.ingredients)}</p>` : ""}${p.allergens ? `<p><strong>Alérgenos:</strong> ${e(p.allergens)}</p>` : ""}</article>`;
}
function videoBlock(v) {
  if (v.kind !== "real" || v.authorized !== true) return "";
  if (!/^[a-zA-Z0-9/_-]+\.mp4$/.test(v.src) || !v.poster) return "";
  return `<figure class="real-video"><video controls preload="none" poster="${url(v.poster)}" width="960" height="540"><source src="${url(v.src)}" type="video/mp4">Tu navegador no puede reproducir el video.</video><figcaption>${e(v.caption)}</figcaption></figure>`;
}
function products() {
  const commercial =
    groups.length || data.products.length
      ? `<section class="section product-approved"><div class="container">${groups.length ? `<h2>Opciones para tu ocasión.</h2><nav class="anchor-nav" aria-label="Opciones por ocasión">${groups.map((k) => `<a href="#para-${k}">${occasionNames[k]}</a>`).join("")}</nav>` : ""}</div><div id="opciones">${groups
          .map(
            (k) =>
              `<section class="section container" id="para-${k}"><p class="eyebrow">TU ELECCIÓN</p><h2>${occasionNames[k]}</h2><div class="option-grid">${data.options
                .filter((o) => o.occasion === k)
                .map(optionCard)
                .join("")}</div></section>`,
          )
          .join(
            "",
          )}</div>${data.products.length ? `<div class="container"><h2>El detalle de cada preparación.</h2><div class="product-grid">${data.products.map(productCard).join("")}</div></div>` : ""}</section>`
      : "";
  return renderProductShowcase({
    content: productShowcase,
    manifest: {
      assets: [...productAssets.assets, ...combinationAssets.assets],
    },
    e,
    url,
    asset,
    svg,
    ig,
    commercial,
    inquiryForm: form(),
  });
}

function catering() {
  return renderCatering({
    url,
    e,
    enabled: config.cateringEmailEnabled === true,
  });
}

function privacy() {
  return `<section class="section container narrow">${intro("TUS DATOS", "Privacidad", "Una consulta sirve para iniciar una conversación y acordar las condiciones de tu pedido.")}<div class="prose"><h2 id="catering">Solicitudes de catering</h2><p>Tu nombre, WhatsApp y los datos que compartas sobre tu reunión se utilizan para preparar una propuesta y coordinar contigo. El correo electrónico es opcional. La solicitud no confirma una reserva ni te suscribe a publicidad.</p><p>El formulario de catering utiliza FormSubmit para enviar la información a mabellramospe@gmail.com. El proveedor conserva un respaldo de los envíos durante 30 días. Puedes consultar sus <a href="https://formsubmit.co/privacy.pdf" target="_blank" rel="noopener noreferrer">condiciones de privacidad</a>. Para solicitar acceso, corrección o eliminación de tus datos, escribe a <a href="mailto:mabellramospe@gmail.com">mabellramospe@gmail.com</a>.</p><p>La copia recibida en el correo del negocio se utiliza para atender y dar seguimiento a tu solicitud; no se publica en esta web. Si eliges WhatsApp, el mensaje se abrirá para que lo revises antes de enviarlo.</p>${config.receiverEndpoint && config.privacyApproved ? `<h2>Otros formularios de esta web</h2><h2>Para qué solicitamos tus datos</h2><p>El nombre, el correo y los detalles de tu solicitud se utilizan para responder y coordinar productos o servicios. Enviar una consulta no te suscribe a promociones ni confirma un pedido.</p><h2>Cómo se conserva una consulta</h2><p>Cuando la recepción web está activada, la consulta se guarda en un repositorio privado de GitHub y se incorpora a la gestión del negocio. El código y el catálogo públicos no contienen los datos de quienes consultan.</p><h2>Quién atiende tu solicitud</h2><p>${e(config.privacy.responsible)}. Para consultar por el uso o la corrección de tus datos, comunícate a través de ${link(config.privacy.contactUrl, "Instagram")}.</p><h2>Conservación</h2><p>${config.privacyApproved && config.privacy.retention ? e(config.privacy.retention) : "Los otros formularios de recepción en GitHub permanecen desactivados. Puedes iniciar la conversación por WhatsApp o Instagram."}</p><p>GitHub conserva un historial de versiones. Las solicitudes de eliminación requieren revisar también ese historial y las copias conservadas; borrar un archivo actual no elimina por sí solo sus versiones anteriores.</p>` : ""}<h2>Uso de esta web</h2><p>No se crean cuentas de clientes ni se realizan pagos desde esta página. No utilizamos cookies publicitarias ni incorporamos seguimiento comercial. Si se activa la protección del formulario, su proveedor verificará el envío para limitar el abuso.</p>${config.receiverEndpoint && config.privacyApproved && config.privacyNoticeVersion ? `<p>Versión del aviso: ${e(config.privacyNoticeVersion)}.</p>` : ""}</div></section>`;
}
function layout(route, title, description, body, extraHead = "") {
  const absolute = config.siteOrigin + url(route);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#432653"><meta name="description" content="${e(description)}"><title>${e(title)} · Mabell Ramos</title><link rel="canonical" href="${absolute}"><meta property="og:title" content="${e(title)} · Mabell Ramos"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${absolute}"><meta property="og:image" content="${config.siteOrigin + asset("social-inicio-v2.jpg")}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="${asset("favicon.svg")}" type="image/svg+xml"><link rel="apple-touch-icon" href="${asset("apple-touch-icon.png")}">${extraHead}<link rel="preload" href="${asset("inter-400.woff2")}" as="font" type="font/woff2" crossorigin><link rel="preload" href="${asset("bodoni-moda-600.woff2")}" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${url("site/site.css")}"><script type="module" src="${url("site/site.js")}"></script>${route === "catering/" ? `<link rel="stylesheet" href="${url("site/catering.css")}"><script type="module" src="${url("site/catering.js")}"></script>` : ""}${route === "productos/" ? `<link rel="stylesheet" href="${url(`site/products.css?v=${productRevision}`)}"><script type="module" src="${url(`site/products.js?v=${productRevision}`)}"></script>` : ""}</head><body data-page="${route}" data-site-base="${base}">${nav(route)}<main id="contenido">${body}</main>${footer(route)}</body></html>`;
}
async function save(route, content) {
  const out = path.join(outRoot, route);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(
    out,
    typeof content === "string" ? content.replace(/[ \t]+$/gm, "") : content,
  );
}
const redirect = `<script>if(/^#pagina-\\d+$/.test(location.hash)){let n=Number(location.hash.slice(8));location.replace('${url("catalogo/")}#pagina-'+(n>=1&&n<=14?n:1));}</script>`;
await save(
  "index.html",
  layout(
    "productos/",
    "Chocotejas y alfajores · Productos",
    "Pastelería fina con raíz afroperuana. Explora nuestros productos y consulta por catering.",
    products(),
    redirect,
  ),
);
await save(
  "productos/index.html",
  layout(
    "productos/",
    "Chocotejas y alfajores · Productos",
    "Chocotejas de lúcuma, ají, frejol colado y manjar de pallar; alfajores clásicos, de cañihua y de pistacho y arándano. Pastelería afroperuana de Mabell Ramos.",
    products(),
  ),
);
await save(
  "catering/index.html",
  layout(
    "catering/",
    "Alimentos y catering para tu reunión",
    "Distingue la entrega de alimentos del montaje y la atención. Cuéntanos qué necesitas para tu evento.",
    catering(),
  ),
);
await save(
  "privacidad/index.html",
  layout(
    "privacidad/",
    "Privacidad",
    "Cómo se utilizan los datos al consultar por productos o catering.",
    privacy(),
  ),
);
await save(
  "404.html",
  layout(
    "404.html",
    "No encontramos esta página",
    "Vuelve a los productos de Mabell Ramos.",
    `<section class="section container narrow">${intro("VOLVAMOS A LOS SABORES", "Esta página no está aquí.", "Explora nuestros productos para encontrar tu preparación.")}<div class="actions">${link(url("productos/"), "Ver productos", "button")}</div></section>`,
  ),
);
// The viewer's original styles remain isolated. Only its surrounding shell uses site styles.
let viewer = await readFile(
  path.join(root, "site-src/catalogue/index.html"),
  "utf8",
);
viewer = viewer
  .replace('href="styles.css?v=2"', `href="${url("catalogo/viewer.css")}"`)
  .replace('src="app.js?v=2"', `src="${url("catalogo/viewer.js")}"`);
viewer = viewer.replace(
  "</head>",
  `<link rel="stylesheet" href="${url("site/site.css")}"><link rel="icon" href="${asset("favicon.svg")}" type="image/svg+xml"><script type="module" src="${url("site/site.js")}"></script></head>`,
);
viewer = viewer
  .replace(
    "<body>",
    `<body class="catalogue-page" data-page="catalogo/" data-site-base="${base}">${nav("catalogo/")}<div class="catalogue-shell">`,
  )
  .replace("<main>", '<main id="contenido">');
viewer = viewer.replace('href="./"', `href="${url("productos/")}"`);
viewer = viewer.replace(
  "<noscript>",
  `<p class="catalogue-edition">Confirma disponibilidad y condiciones al consultar. Este catálogo es una referencia de la propuesta; sus páginas no cambian al actualizar una opción comercial.</p><section class="catalogue-access"><details id="catalog-transcription"><summary>Leer contenido de esta página</summary><div id="transcription-content" aria-live="polite"><p>Selecciona una página para leer su contenido.</p></div></details><details id="catalog-consultation"><summary>Consultar esta página</summary>${form({ kind: "catalog_page", source: "/catalogo/", catalog: true })}</details></section><noscript>`,
);
viewer = viewer.replace(/<footer>[\s\S]*?<\/footer>/, "");
viewer = viewer.replace("</body>", `</div>${footer()}</body>`);
viewer = viewer.replace(
  "</head>",
  '<meta name="robots" content="noindex"></head>',
);
await save("catalogo/index.html", viewer);
let app = await readFile(path.join(root, "site-src/catalogue/app.js"), "utf8");
app = app.replaceAll("`assets/", "`../assets/");
app = app.replace(
  "if (['SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName) || viewport.classList.contains('expanded')) return;",
  "if (!viewport.contains(event.target) || viewport.classList.contains('expanded')) return;",
);
app = app.replace("function show(index) {", "function show(index) {");
// Notify the surrounding consultation without coupling viewer CSS to the storefront.
app = app.replace(
  "counter.textContent = `${current + 1} / ${titles.length}`;",
  "counter.textContent = `${current + 1} / ${titles.length}`;\n  window.dispatchEvent(new CustomEvent('catalogue-page', {detail:{page:current+1,title:titles[current]}}));",
);
await save("catalogo/viewer.js", app);
await save(
  "catalogo/viewer.css",
  scopeViewer(
    await readFile(path.join(root, "site-src/catalogue/styles.css"), "utf8"),
  ),
);
await save(
  "site/runtime.json",
  JSON.stringify(
    {
      ...config,
      siteBase: base,
      contact: data.contact,
      catalogVersion: data.catalog.version,
      localPreview: false,
    },
    null,
    2,
  ),
);
await save("site/catalog-public.json", JSON.stringify(data, null, 2));
for (const f of ["site.js", "catalog-validation.mjs", "catering.js"])
  await copyFile(
    path.join(root, "site-src/scripts", f),
    path.join(outRoot, "site", f),
  );
await copyFile(
  path.join(root, "services/inquiry-receiver/src/contract.mjs"),
  path.join(outRoot, "site/contract.mjs"),
);
await copyFile(
  path.join(root, "site-src/styles/site.css"),
  path.join(outRoot, "site/site.css"),
);
try {
  await copyFile(
    path.join(root, "site-src/content/catalog-pages.json"),
    path.join(outRoot, "site/catalog-pages.json"),
  );
} catch {
  await save(
    "site/catalog-pages.json",
    JSON.stringify(
      titles.map((title, i) => ({
        page: i + 1,
        title,
        sections: [],
        notes: ["Consulta los detalles de esta página en el catálogo."],
      })),
    ),
  );
}
await copyFile(
  path.join(root, "site-src/styles/catering.css"),
  path.join(outRoot, "site/catering.css"),
);
await copyFile(
  path.join(root, "site-src/styles/products.css"),
  path.join(outRoot, "site/products.css"),
);
await copyFile(
  path.join(root, "site-src/scripts/products.js"),
  path.join(outRoot, "site/products.js"),
);
await mkdir(path.join(outRoot, "assets/web/historia"), { recursive: true });
for (const file of [
  "mabell-ramos-historia.mp4",
  "mabell-ramos-poster-ana-joya.jpg",
  "logo-peru-mimp.png",
]) {
  await copyFile(
    path.join(root, "assets-source/historia", file),
    path.join(outRoot, "assets/web/historia", file),
  );
}
await mkdir(path.join(outRoot, "assets/web/productos"), { recursive: true });
for (const [assetRoot, collection] of [
  [productAssetRoot, productAssets],
  [combinationAssetRoot, combinationAssets],
]) {
  for (const image of collection.assets) {
    for (const variant of image.variants) {
      await copyFile(
        path.join(assetRoot, variant.file),
        path.join(outRoot, "assets/web/productos", path.basename(variant.file)),
      );
    }
  }
}
await save(
  "robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${config.siteOrigin + url("sitemap.xml")}\n`,
);
await save(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["", "productos/", "catering/", "privacidad/"].map((p) => `<url><loc>${config.siteOrigin + url(p)}</loc></url>`).join("")}</urlset>`,
);
console.log(
  `Built 5 pages and 404 at ${base}. ${data.products.length} approved products, ${data.options.length} approved options. Original catalogue assets untouched.`,
);

function scopeViewer(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "",
    pos = 0;
  while (pos < css.length) {
    const start = css.indexOf("{", pos);
    if (start < 0) {
      out += css.slice(pos);
      break;
    }
    const selector = css.slice(pos, start);
    let depth = 1,
      end = start + 1;
    while (depth && end < css.length) {
      if (css[end] === "{") depth++;
      if (css[end] === "}") depth--;
      end++;
    }
    const content = css.slice(start + 1, end - 1);
    if (selector.trim().startsWith("@"))
      out += selector + "{" + scopeViewer(content) + "}";
    else {
      const scoped = selector
        .split(",")
        .map((s) => {
          s = s.trim();
          return s === ":root" || s === "body"
            ? ".catalogue-shell"
            : ".catalogue-shell " + s;
        })
        .join(",");
      out += scoped + "{" + content + "}";
    }
    pos = end;
  }
  return out;
}
