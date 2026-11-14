// Editorial product presentation. Approved prices/options remain separate.
export function renderProductShowcase({
  content,
  manifest,
  e,
  url,
  asset,
  svg,
  ig,
  commercial,
  inquiryForm,
}) {
  const wa = (
    message = "Hola, Mabell Ramos. Me interesan sus chocotejas y alfajores. ¿Me ayudan a elegir?",
  ) => `https://wa.me/51932666526?text=${encodeURIComponent(message)}`;
  const whatsappIcon = `<svg class="icon whatsapp-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 11.5a9 9 0 0 1-13.4 7.84L3 20.5l1.2-4.43A9 9 0 1 1 21 11.5Z"/><path d="M8.1 7.3c.3-.3.7-.2.9.2l1 2c.2.3.1.6-.2.9l-.6.6c.7 1.5 1.8 2.6 3.4 3.3l.6-.7c.2-.3.5-.4.8-.2l2 1c.4.2.5.5.3.9-.5 1.1-1.4 1.6-2.5 1.3-3.6-.9-6.4-3.7-7.3-7.1-.3-1 .3-1.8 1.1-2.2Z"/></svg>`;
  const playIcon = `<svg class="story-play-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 4.5v15l12-7.5z"/></svg>`;
  const assets = new Map(manifest.assets.map((a) => [a.id, a]));
  const photoUrl = (file) => asset(`productos/${file.split("/").pop()}`);
  const srcset = (id, format) =>
    assets
      .get(id)
      .variants.filter((v) => v.format === format)
      .map((v) => `${photoUrl(v.file)} ${v.width}w`)
      .join(", ");
  const photo = (id, alt, sizes, eager = false) => {
    const a = assets.get(id);
    return `<picture><source type="image/avif" srcset="${srcset(id, "avif")}" sizes="${sizes}"><img src="${photoUrl(a.variants.find((v) => v.format === "webp").file)}" srcset="${srcset(id, "webp")}" sizes="${sizes}" width="${a.original.width}" height="${a.original.height}" alt="${e(alt)}" loading="${eager ? "eager" : "lazy"}" ${eager ? 'fetchpriority="high"' : ""} decoding="async"></picture>`;
  };
  const flavorCard = (
    f,
    family,
  ) => `<article class="flavor-card" id="sabor-${e(f.id)}" data-family="${e(family.name)}" data-inquiry="${e(f.inquiry)}">
    <div class="flavor-photo">${photo(f.image, `${family.id === "chocotejas" ? "Chocoteja de " + f.name.toLowerCase() + " partida, con su ingrediente sobre el plato" : "Alfajor " + (f.id === "clasico" ? "clásico redondo" : "redondo de " + f.name.toLowerCase()) + ", con su ingrediente sobre el plato"}.`, family.id === "chocotejas" ? "(max-width:600px) calc(100vw - 40px), (max-width:1100px) calc((100vw - 88px)/2), (min-width:1440px) 318px, 23vw" : "(max-width:600px) calc(100vw - 40px), (max-width:760px) calc((100vw - 72px)/2), (min-width:1440px) 432px, 31vw")}</div>
    <div class="flavor-copy"><h3>${e(f.name)}</h3><p class="flavor-description">${e(f.description)}</p>
    <a class="button flavor-consult" href="${e(wa(f.inquiry))}" aria-label="Consultar por WhatsApp: ${e(f.name)}">Consultar por WhatsApp ${whatsappIcon}</a></div>
  </article>`;
  const family = (f) =>
    `<section class="product-family product-family--${f.id}" id="${f.id}" aria-labelledby="titulo-${f.id}"><div class="product-container"><div class="family-heading"><div><p class="eyebrow">${e(f.eyebrow)}</p><h2 id="titulo-${f.id}">${e(f.name)}<span class="flavor-count">${f.flavors.length} sabores</span></h2><p class="family-description">${e(f.description)}</p></div></div><div id="producto-${f.id}" class="flavor-grid flavor-grid--${f.flavors.length}">${f.flavors.map((p) => flavorCard(p, f)).join("")}</div></div></section>`;
  return `<section class="product-hero product-story" aria-labelledby="product-title"><div class="product-container product-story-inner">
    <div class="page-intro product-hero-copy"><img class="hero-brand-logo" src="${asset("logo-128.webp")}" width="76" height="76" alt=""><div><p class="eyebrow">PASTELERÍA AFROPERUANA</p><h1 id="product-title">Mabell Ramos</h1></div></div>
    <div class="product-story-media">
      <video id="brand-story-video" class="product-story-video" controls playsinline preload="none" width="1920" height="1080" poster="${asset("historia/mabell-ramos-poster-ana-joya.jpg")}" aria-label="Conoce nuestra historia: video completo, 1 minuto 40 segundos"><source src="${asset("historia/mabell-ramos-historia.mp4")}" type="video/mp4">Tu navegador no admite la reproducción de este video.</video>
      <button class="story-poster-play" type="button" data-story-play aria-controls="brand-story-video" aria-label="Reproducir video completo de Mabell Ramos, 1 minuto 40 segundos" hidden><span class="story-poster-controls"><span class="story-play-circle">${playIcon}</span><span class="story-duration">1:40</span></span></button>
    </div>
    <div class="product-story-copy"><h2>Elige tu sabor favorito.</h2><p class="product-hero-lead">Chocotejas y alfajores para disfrutar y compartir. Te ayudamos con tu pedido.</p><div class="product-hero-actions"><a class="button product-button-light" href="${e(wa())}">Consultar por WhatsApp ${whatsappIcon}</a><a class="product-explore" href="#chocotejas">Explorar sabores ${svg("chevron-down")}</a></div><p class="story-status" role="status" hidden></p><div class="story-credit"><img src="${asset("historia/logo-gobierno-peru-cierre.png")}" width="950" height="250" alt="Gobierno del Perú — logo del cierre del video" decoding="async"></div></div>
  </div></section>
  <nav class="product-navigation" aria-label="Familias de productos" id="sabores"><div class="product-container"><div class="product-nav-links"><a href="#chocotejas" aria-current="location">Chocotejas</a><a href="#alfajores">Alfajores</a></div></div></nav>
  ${content.families.map(family).join("")}
  ${commercial}
  ${content.reviews?.length ? `<section class="product-review" aria-label="Comentarios de nuestra comunidad" aria-roledescription="carrusel"><div class="product-container product-review-inner"><div class="review-stage"><p class="eyebrow">DE NUESTRA COMUNIDAD</p><div id="review-slides" aria-live="polite" aria-atomic="true">${content.reviews.map((review, index) => `<article class="review-slide" aria-label="Comentario ${index + 1} de ${content.reviews.length}"><blockquote>“${e(review.quote)}”</blockquote><p>${e(review.author)} · ${review.sourceType === "story" ? "Historia en Instagram" : "Comentario en Instagram"}</p><a href="${e(review.url)}" target="_blank" rel="noopener noreferrer">${review.sourceType === "story" ? "Ver historia en destacados" : "Leer el comentario original"} ↗</a></article>`).join("")}</div></div><div class="review-controls" hidden><button type="button" data-review-prev aria-label="Comentario anterior" aria-controls="review-slides">←</button><span class="review-count" aria-hidden="true">1 / ${content.reviews.length}</span><button type="button" data-review-next aria-label="Comentario siguiente" aria-controls="review-slides">→</button></div></div></section>` : ""}
  <section class="product-order" id="consulta-productos" aria-label="Consulta nuestros productos"><div class="product-container product-order-actions"><a class="button product-button-light external" href="${e(wa())}">Consultar por WhatsApp ${svg("arrow-right")}</a><a class="button product-instagram" href="${e(ig)}" target="_blank" rel="noopener noreferrer">Visitar Instagram ${svg("instagram")}</a></div></section>
  <aside class="product-mobile-contact" aria-label="Contacto rápido"><a class="button" href="${e(wa())}">Consultar por WhatsApp ${svg("arrow-right")}</a></aside>
  <section class="product-inquiry section" data-product-inquiry hidden><div class="container narrow"><h2>Consulta por productos.</h2><p>Cuéntanos tus sabores favoritos y la ocasión.</p>${inquiryForm}</div></section>`;
}
