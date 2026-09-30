import { validatePublicInquiryInput, UUID_RE } from "./contract.mjs";
import { validateCatalog } from "./catalog-validation.mjs";
const base = document.body.dataset.siteBase || "/";
const configPromise = fetch(`${base}site/runtime.json`, {
  cache: "no-store",
}).then((r) => {
  if (!r.ok) throw Error("No se pudo cargar la configuración.");
  return r.json();
});
let configuration = null;
configPromise
  .then((c) => {
    configuration = c;
    if (c.localPreview) {
      const banner = document.createElement("div");
      banner.className = "local-preview-banner";
      banner.textContent =
        "Vista local · Los envíos se guardan sólo en este equipo; no son consultas comerciales en línea.";
      document.body.prepend(banner);
    }
    document.querySelectorAll(".inquiry-form").forEach((f) => {
      f.querySelector(".submit-inquiry").disabled = !(
        c.receiverEndpoint && c.privacyApproved
      );
      if (!c.localPreview && (!c.receiverEndpoint || !c.privacyApproved)) {
        status(
          f,
          "Puedes consultar por Instagram. La recepción de este formulario todavía no está activada.",
          "unavailable",
        );
        f.querySelector(".submit-inquiry").textContent =
          "Recepción web pendiente";
      }
    });
  })
  .catch(() =>
    document
      .querySelectorAll(".inquiry-form")
      .forEach((f) =>
        status(
          f,
          "La recepción web no está disponible. Puedes escribir por Instagram.",
          "error",
        ),
      ),
  );
function status(form, message, state = "idle") {
  const area = form.querySelector(".form-status");
  area.dataset.state = state;
  area.textContent = message;
}
function todayLima() {
  const ps = new Intl.DateTimeFormat("en", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((t) => ps.find((p) => p.type === t).value)
    .join("-");
}
function freezeFields(form, frozen) {
  form.querySelectorAll("input,select,textarea,details").forEach((el) => {
    if (el.matches("input,select,textarea")) el.disabled = frozen;
  });
  if (!frozen && form.dataset.kind === "event") syncEventScope(form);
}
function syncEventScope(form) {
  const foodOnly = form.querySelector("[name=scope]")?.value === "food_only";
  for (const box of form.querySelectorAll("[name=interest]")) {
    if (["setup", "tableware", "staff"].includes(box.value)) {
      box.disabled = foodOnly;
      if (foodOnly) box.checked = false;
    }
  }
}
const states = new WeakMap();
let turnstileLoader;
function loadTurnstile() {
  return (turnstileLoader ||= new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const s = document.createElement("script");
    s.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    const timer = setTimeout(() => {
      s.remove();
      turnstileLoader = null;
      reject(Error("bot_unavailable"));
    }, 15000);
    s.onload = () => {
      clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else {
        turnstileLoader = null;
        reject(Error("bot_unavailable"));
      }
    };
    s.onerror = () => {
      clearTimeout(timer);
      s.remove();
      turnstileLoader = null;
      reject(Error("bot_unavailable"));
    };
    document.head.append(s);
  }));
}
async function newToken(form, c) {
  if (c.localPreview) return "local-development-only";
  if (!c.turnstileSiteKey) throw Error("bot_unavailable");
  const api = await loadTurnstile();
  const state = states.get(form);
  return new Promise((resolve, reject) => {
    let timer;
    const clear = () => clearTimeout(timer);
    if (state.widget !== undefined) api.remove(state.widget);
    state.widget = api.render(form.querySelector(".bot-check"), {
      sitekey: c.turnstileSiteKey,
      action: "public_inquiry",
      callback: (t) => {
        clear();
        resolve(t);
      },
      "error-callback": () => {
        clear();
        reject(Error("bot_unavailable"));
      },
      "expired-callback": () => {
        clear();
        reject(Error("bot_unavailable"));
      },
    });
    timer = setTimeout(() => {
      api.remove(state.widget);
      state.widget = undefined;
      reject(Error("bot_unavailable"));
    }, 60000);
  });
}
function inputFor(form, c) {
  const f = new FormData(form);
  const kind = form.dataset.kind;
  const v = {
    schemaVersion: 1,
    requestId: crypto.randomUUID(),
    kind,
    contact: { name: f.get("name"), method: "email", value: f.get("email") },
    requestedDate: f.get("requestedDate") || null,
    district: f.get("district") || null,
    message: [f.get("requestText"), f.get("message")]
      .filter(Boolean)
      .join("\n"),
    source: { page: form.dataset.source },
    privacyNoticeVersion: c.privacyNoticeVersion,
    antiAbuseToken: "pending",
    website: f.get("website") || "",
  };
  if (f.get("occasion")) v.occasion = f.get("occasion");
  if (kind === "product_option")
    v.option = {
      id: form.dataset.optionId,
      revision: Number(form.dataset.optionRevision),
      quantity: Number(f.get("quantity")),
    };
  if (kind === "event") {
    v.occasion = "evento";
    v.event = {
      scope: f.get("scope"),
      attendees: f.get("attendees") ? Number(f.get("attendees")) : null,
      time: f.get("time") || null,
      interests: f.getAll("interest"),
    };
  }
  if (kind === "catalog_page") {
    v.catalog = {
      version: c.catalogVersion,
      page: Number(form.dataset.catalogPage || 1),
    };
    const scope = f.get("scope");
    if (scope) {
      delete v.catalog;
      v.kind = "event";
      v.occasion = "evento";
      v.event = { scope, attendees: null, time: null, interests: [] };
      const prefix = `Catálogo ${c.catalogVersion}: página ${form.dataset.catalogPage}, ${form.dataset.catalogTitle}. `;
      if (v.message.length + prefix.length > 500)
        throw Error(
          `Para incluir la referencia del catálogo, usa hasta ${500 - prefix.length} caracteres en tu comentario.`,
        );
      v.message = prefix + v.message;
    }
  }
  const normalized = validatePublicInquiryInput(v);
  if (normalized.requestedDate && normalized.requestedDate < todayLima())
    throw Error("Elige una fecha de hoy o futura, o déjala por definir.");
  delete normalized.antiAbuseToken;
  return Object.freeze(normalized);
}
function receiptValid(v) {
  return (
    v &&
    v.status === "received" &&
    typeof v.receiptId === "string" &&
    /^MR-/.test(v.receiptId) &&
    UUID_RE.test(v.receiptId.slice(3)) &&
    typeof v.receivedAt === "string" &&
    !Number.isNaN(Date.parse(v.receivedAt))
  );
}
const errors = {
  invalid_input: "Revisa los datos indicados antes de enviar.",
  offer_updated:
    "Las condiciones de esta opción cambiaron. Vuelve a cargar la página y revísalas antes de consultar.",
  option_unavailable:
    "Esta opción ya no está disponible. Revisa otras opciones o escríbenos por Instagram.",
  catalog_updated:
    "Hay una nueva versión del catálogo. Vuelve a cargar la página antes de consultar.",
  privacy_updated:
    "El aviso de privacidad cambió. Vuelve a cargar la página para revisarlo.",
  anti_abuse_failed: "No pudimos verificar el envío. Inténtalo de nuevo.",
  rate_limited:
    "Hay varios envíos en poco tiempo. Espera antes de volver a intentar.",
  request_id_conflict:
    "No pudimos verificar la referencia de este envío. Escríbenos por Instagram.",
};
for (const form of document.querySelectorAll(".inquiry-form")) {
  const state = {
    pending: null,
    busy: false,
    received: false,
    uncertain: false,
    widget: undefined,
  };
  states.set(form, state);
  form.addEventListener("input", (ev) =>
    ev.target.removeAttribute("aria-invalid"),
  );
  const submit = form.querySelector(".submit-inquiry"),
    edit = form.querySelector(".edit-inquiry");
  form.querySelector("[name=requestedDate]").min = todayLima();
  edit.addEventListener("click", () => {
    if (state.busy || state.received || state.uncertain) return;
    state.pending = null;
    freezeFields(form, false);
    edit.hidden = true;
    submit.textContent = "Enviar consulta";
    status(form, "Revisa tus datos antes de enviar.", "idle");
  });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (state.busy || state.received) return;
    let c;
    try {
      c = await configPromise;
    } catch {
      status(
        form,
        "La recepción web no está disponible. Puedes escribirnos por Instagram.",
        "error",
      );
      return;
    }
    if (!c.receiverEndpoint || !c.privacyApproved) {
      status(
        form,
        "Este formulario aún no recibe consultas en línea. Puedes escribirnos por Instagram.",
        "unavailable",
      );
      return;
    }
    if (!state.pending && !form.reportValidity()) return;
    try {
      if (!state.pending) state.pending = inputFor(form, c);
    } catch (error) {
      status(
        form,
        error.message === "Longitud o caracteres no válidos."
          ? "Revisa el nombre, el correo y los datos de la consulta."
          : error.message,
        "error",
      );
      return;
    }
    state.busy = true;
    submit.disabled = true;
    submit.textContent = "Enviando…";
    edit.hidden = true;
    freezeFields(form, true);
    status(form, "Enviando tu consulta…", "sending");
    let sent = false;
    try {
      const token = await newToken(form, c);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      let response;
      try {
        sent = true;
        response = await fetch(c.receiverEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...state.pending, antiAbuseToken: token }),
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
        });
      } finally {
        clearTimeout(timeout);
      }
      const result = await response.json();
      if (
        response.ok &&
        receiptValid(result) &&
        result.receiptId.slice(3).toLowerCase() === state.pending.requestId
      ) {
        state.received = true;
        state.uncertain = false;
        status(
          form,
          c.localPreview
            ? "Consulta guardada en este equipo para la prueba local."
            : "Recibimos tu consulta. Revisaremos disponibilidad y condiciones contigo.",
          "received",
        );
        const ref = document.createElement("span");
        ref.className = "receipt-code";
        ref.textContent = `Referencia: ${result.receiptId}`;
        const receiptArea = form.querySelector(".form-status");
        receiptArea.append(ref);
        const time = document.createElement("time");
        time.className = "receipt-time";
        time.dateTime = result.receivedAt;
        time.textContent =
          "Recibida el " +
          new Intl.DateTimeFormat("es-PE", {
            timeZone: "America/Lima",
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(result.receivedAt));
        receiptArea.append(time);
        const summary = document.createElement("span");
        summary.className = "receipt-summary";
        const pending = state.pending;
        summary.textContent =
          pending.kind === "event"
            ? `Evento: ${{ food_only: "sólo alimentos", food_and_service: "alimentos y servicio", unsure: "alcance por definir" }[pending.event.scope]}. Fecha ${pending.requestedDate || "por definir"}.`
            : pending.kind === "product_option"
              ? `${form.querySelector(".form-context").textContent.trim()} · Cantidad: ${pending.option.quantity}.`
              : pending.kind === "catalog_page"
                ? `Catálogo: página ${pending.catalog.page}.`
                : pending.message;
        receiptArea.append(summary);
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "copy-receipt button button-secondary";
        copy.textContent = "Copiar referencia";
        copy.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(result.receiptId);
            copy.textContent = "Referencia copiada";
          } catch {
            ref.tabIndex = 0;
            ref.focus();
            copy.textContent = "Selecciona la referencia para copiar";
          }
        });
        receiptArea.append(copy);
        receiptArea.tabIndex = -1;
        receiptArea.focus();
        submit.hidden = true;
        return;
      }
      if ([400, 403, 409, 413, 429].includes(response.status)) {
        let msg =
          errors[result.error] ||
          "El envío no fue aceptado. Revisa los datos o escríbenos por Instagram.";
        if (response.status === 429) {
          const wait = Number(response.headers.get("Retry-After"));
          if (Number.isFinite(wait) && wait > 0)
            msg += ` Intenta nuevamente en ${Math.ceil(wait / 60)} minuto(s).`;
        }
        status(form, msg, "error");
        if (result.field && !state.uncertain) {
          const names = {
            "contact.name": "name",
            "contact.value": "email",
            requestedDate: "requestedDate",
            district: "district",
            "event.attendees": "attendees",
            message: "message",
            "option.quantity": "quantity",
          };
          const field = form.elements.namedItem(
            names[result.field] || result.field,
          );
          if (field) {
            state.pending = null;
            freezeFields(form, false);
            submit.textContent = "Enviar consulta";
            field.setAttribute("aria-invalid", "true");
            field.focus();
          }
        }
        if (
          [
            "offer_updated",
            "option_unavailable",
            "catalog_updated",
            "privacy_updated",
          ].includes(result.error)
        ) {
          state.uncertain = false;
          await reviewUpdate(form, c, result.error);
          return;
        }
        if (result.error !== "request_id_conflict") {
          edit.hidden = state.uncertain || !state.pending;
          submit.textContent = state.pending
            ? "Reintentar el mismo envío"
            : "Enviar consulta";
        } else submit.hidden = true;
      } else {
        state.uncertain = true;
        status(
          form,
          "No pudimos confirmar la recepción. Reintenta el mismo envío para comprobarlo sin duplicar tu consulta.",
          "unknown",
        );
        submit.textContent = "Comprobar recepción";
      }
    } catch (error) {
      if (error.message === "bot_unavailable") {
        status(
          form,
          "No pudimos completar la verificación del formulario. Inténtalo de nuevo o escribe por Instagram.",
          "error",
        );
        edit.hidden = state.uncertain;
        submit.textContent = "Reintentar envío";
      } else {
        if (sent) state.uncertain = true;
        status(
          form,
          sent
            ? "No pudimos confirmar la recepción. Reintenta el mismo envío para comprobarlo sin duplicar tu consulta."
            : "La conexión no está disponible. Puedes reintentar o escribir por Instagram.",
          "unknown",
        );
        submit.textContent = "Comprobar recepción";
      }
    } finally {
      state.busy = false;
      submit.disabled = false;
    }
  });
}
function openHash() {
  let target;
  try {
    target = document.getElementById(
      decodeURIComponent(location.hash.slice(1)),
    );
  } catch {
    return;
  }
  if (!target) {
    if (
      /^#opcion-[A-Za-z0-9._-]+$/.test(location.hash) &&
      !document.querySelector(".retired-option")
    ) {
      const notice = document.createElement("p");
      notice.className = "container retired-option";
      notice.setAttribute("role", "status");
      notice.textContent =
        "Esta opción ya no está publicada. Explora las preparaciones actuales o consulta por otra elección.";
      document.querySelector(".page-intro").after(notice);
    }
    return;
  }
  if (target.id.startsWith("opcion-")) {
    target.querySelector("details").open = true;
    requestAnimationFrame(() =>
      target.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      }),
    );
  }
}
addEventListener("hashchange", openHash);
openHash();
for (const b of document.querySelectorAll(".share-option"))
  b.addEventListener("click", async () => {
    const u = new URL(location.href);
    u.search = "";
    u.hash = `opcion-${b.dataset.shareId}`;
    const area = b.parentElement.querySelector(".share-status");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mabell Ramos", url: u.href });
        area.textContent = "";
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(u.href);
        area.textContent = "Enlace copiado.";
      } else {
        const a = document.createElement("a");
        a.href = u.href;
        a.textContent = "Enlace a esta opción";
        area.replaceChildren(a);
      }
    } catch (err) {
      if (err.name !== "AbortError")
        area.textContent =
          "Puedes copiar el enlace desde la barra de direcciones.";
    }
  });
let catalogPagesPromise;
async function updateCatalogue({ page, title }) {
  const form = document.querySelector("[data-catalog-form]");
  if (!form) return;
  const s = states.get(form);
  if (!s.pending) {
    form.dataset.catalogPage = page;
    form.dataset.catalogTitle = title;
    form.querySelector("[data-catalog-context]").textContent =
      `Página ${page} · ${title}`;
    const prior = form.querySelector(".catalog-scope");
    if (prior) prior.remove();
    form.querySelector("[name=message]").maxLength = 500;
    form.querySelector("[name=message]").nextElementSibling.textContent =
      "Hasta 500 caracteres. No incluyas datos de pago.";
    if ([7, 8, 9, 10, 11, 12].includes(page)) {
      const wrap = document.createElement("div");
      wrap.className = "catalog-scope";
      const label = document.createElement("label");
      label.htmlFor = `${form.id}-scope`;
      label.textContent = "¿Qué necesitas para tu reunión?";
      const select = document.createElement("select");
      select.id = label.htmlFor;
      select.name = "scope";
      [
        ["unsure", "Aún no lo sé"],
        ["food_only", "Sólo alimentos"],
        ["food_and_service", "Alimentos y servicio"],
      ].forEach(([v, t]) => select.add(new Option(t, v)));
      wrap.append(label, select);
      form.querySelector(".form-context").after(wrap);
      const comment = form.querySelector("[name=message]");
      const prefix = `Catálogo ${configuration?.catalogVersion || "catalogo-referencia-2026-09-29"}: página ${page}, ${title}. `;
      comment.maxLength = 500 - prefix.length;
      comment.nextElementSibling.textContent = `Hasta ${comment.maxLength} caracteres; incluiremos la referencia de esta página.`;
    }
  }
  try {
    const pages = await (catalogPagesPromise ||= fetch(
      `${base}site/catalog-pages.json`,
    ).then((r) => r.json()));
    const p = pages.find((p) => p.page === page);
    if (!p) return;
    const target = document.querySelector("#transcription-content");
    target.replaceChildren();
    const section = document.createElement("div");
    section.className = "transcription-section";
    const heading = document.createElement("h2");
    heading.textContent = `Página ${p.page}. ${p.title}`;
    section.append(heading);
    for (const group of p.sections) {
      const h = document.createElement("h3");
      h.textContent = group.heading;
      section.append(h);
      const ul = document.createElement("ul");
      for (const row of group.rows) {
        const li = document.createElement("li");
        li.textContent =
          typeof row === "string" ? row : Object.values(row).join(" · ");
        ul.append(li);
      }
      section.append(ul);
    }
    for (const note of p.notes || []) {
      const para = document.createElement("p");
      para.textContent = note;
      section.append(para);
    }
    target.append(section);
  } catch {
    document.querySelector("#transcription-content").textContent =
      "No pudimos cargar la lectura de esta página. Intenta nuevamente o consulta por Instagram.";
    catalogPagesPromise = null;
  }
}
addEventListener("catalogue-page", (ev) => updateCatalogue(ev.detail));
if (document.querySelector("[data-catalog-form]")) {
  const select = document.querySelector("#page-select");
  const n = Number(select?.value || 0);
  updateCatalogue({
    page: n + 1,
    title: select?.options[n]?.textContent.replace(/^\d+ · /, "") || "Portada",
  });
}

for (const a of document.querySelectorAll("[data-scope-choice]"))
  a.addEventListener("click", () => {
    const f = document.querySelector("[data-kind=event]");
    if (!states.get(f)?.pending) {
      const select = f.querySelector("[name=scope]");
      select.value = a.dataset.scopeChoice;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
for (const f of document.querySelectorAll("[data-kind=event]")) {
  const select = f.querySelector("[name=scope]");
  select.addEventListener("change", () => syncEventScope(f));
  syncEventScope(f);
}
async function reviewUpdate(form, c, code) {
  const state = states.get(form),
    submit = form.querySelector(".submit-inquiry");
  submit.hidden = true;
  form.querySelector(".edit-inquiry").hidden = true;
  form.querySelector(".offer-review")?.remove();
  const panel = document.createElement("section");
  panel.className = "offer-review";
  panel.setAttribute("aria-label", "Revisar condiciones actualizadas");
  const heading = document.createElement("h3");
  heading.textContent = "Revisa lo que cambió";
  panel.append(heading);
  try {
    let current;
    if (code === "privacy_updated") {
      current = await fetch(`${base}site/runtime.json`, {
        cache: "no-store",
      }).then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      });
      if (!current.privacyApproved || !current.privacyNoticeVersion)
        throw Error();
      const p = document.createElement("p");
      p.textContent =
        "El aviso de privacidad se actualizó. Tus datos permanecen en el formulario. Revísalo antes de continuar.";
      const a = document.createElement("a");
      a.href = base + "privacidad/";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Leer aviso actualizado";
      panel.append(p, a);
    } else {
      current = validateCatalog(
        await fetch(`${base}site/catalog-public.json`, {
          cache: "no-store",
        }).then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        }),
      );
      if (code === "catalog_updated") {
        const p = document.createElement("p");
        p.textContent = `Hay una nueva edición del catálogo: ${current.catalog.version}. Revisa su contenido antes de consultar. Tus datos siguen aquí.`;
        panel.append(p);
        const image = document.querySelector("#page");
        if (image) {
          image.srcset = image.srcset
            .split(",")
            .map((s) => {
              const [u, w] = s.trim().split(" ");
              return `${u.split("?")[0]}?edition=${encodeURIComponent(current.catalog.version)} ${w}`;
            })
            .join(", ");
          image.src =
            image.src.split("?")[0] +
            "?edition=" +
            encodeURIComponent(current.catalog.version);
        }
        catalogPagesPromise = null;
      } else {
        const option = current.options.find(
          (o) =>
            o.id === form.dataset.optionId && o.availability === "on_request",
        );
        state.revisedOption = option || null;
        const p = document.createElement("p");
        if (option) {
          p.textContent = `${option.name} · ${new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(option.priceCents / 100)} por ${option.saleUnit}.`;
          panel.append(p);
          for (const [name, value] of [
            [
              "Contenido",
              option.items
                .map(
                  (i) =>
                    `${i.quantity} ${current.products.find((p) => p.id === i.productId).name}`,
                )
                .join(" · "),
            ],
            ["Presentación", option.presentation],
            ["Entrega", option.deliveryConditions],
            ["Cambios", option.allowedChanges],
          ]) {
            const entry = document.createElement("p");
            const strong = document.createElement("strong");
            strong.textContent = name + ": ";
            entry.append(strong, document.createTextNode(value));
            panel.append(entry);
          }
        } else {
          p.textContent =
            "Esta opción ya no se encuentra disponible. Puedes consultar por otra preparación conservando tus datos.";
          panel.append(p);
        }
      }
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-secondary";
    button.textContent =
      code === "privacy_updated"
        ? "He revisado el aviso actualizado"
        : code === "catalog_updated"
          ? "He revisado el catálogo actualizado"
          : state.revisedOption
            ? "Usar condiciones actualizadas"
            : "Consultar por otra preparación";
    button.addEventListener("click", () => {
      state.pending = null;
      freezeFields(form, false);
      if (code === "privacy_updated") {
        Object.assign(c, {
          privacyNoticeVersion: current.privacyNoticeVersion,
          privacyApproved: true,
        });
      } else if (code === "catalog_updated") {
        c.catalogVersion = current.catalog.version;
        const select = document.querySelector("#page-select");
        updateCatalogue({
          page: Number(select.value) + 1,
          title: select.selectedOptions[0].textContent.replace(/^\d+ · /, ""),
        });
      } else if (state.revisedOption) {
        form.dataset.optionRevision = state.revisedOption.revision;
        form.querySelector(".form-context").textContent =
          state.revisedOption.name + " · Condiciones actualizadas";
        const card = form.closest(".option-card");
        card.querySelector(".price").textContent =
          new Intl.NumberFormat("es-PE", {
            style: "currency",
            currency: "PEN",
          }).format(state.revisedOption.priceCents / 100) +
          " por " +
          state.revisedOption.saleUnit;
        const dd = card.querySelectorAll("dl dd");
        const fresh = state.revisedOption;
        const items = fresh.items.map(
          (i) =>
            `${i.quantity} ${current.products.find((p) => p.id === i.productId).name}${i.variantId ? ` · ${i.variantId}` : ""}`,
        );
        dd[0].textContent = items.concat(fresh.includes).join(" · ");
        card.querySelector("h3").textContent = fresh.name;
        card.querySelector("h3").nextElementSibling.textContent =
          items.join(" · ");
        const quantity = form.querySelector("[name=quantity]");
        form.querySelector(`label[for="${quantity.id}"]`).textContent =
          `Cantidad (${fresh.saleUnit})`;
        dd[1].textContent = fresh.presentation;
        dd[2].textContent = fresh.deliveryConditions;
        dd[3].textContent = fresh.allowedChanges;
      } else {
        form.dataset.kind = "product_general";
        delete form.dataset.optionId;
        delete form.dataset.optionRevision;
        form.querySelector(".form-context").textContent =
          "Consulta general por productos";
        const quantity = form.querySelector("[name=quantity]");
        form.querySelector(`label[for="${quantity.id}"]`)?.remove();
        quantity.remove();
        const label = document.createElement("label");
        label.htmlFor = form.id + "-request";
        label.textContent = "¿Qué te gustaría pedir?";
        const input = document.createElement("input");
        input.name = "requestText";
        input.id = label.htmlFor;
        input.required = true;
        input.maxLength = 180;
        form.querySelector(".form-context").after(label, input);
        form.querySelector("[name=message]").maxLength = 300;
      }
      panel.remove();
      submit.hidden = false;
      submit.textContent = "Enviar consulta";
      status(
        form,
        "Tus datos se conservaron. Revisa las condiciones y envía cuando estés listo.",
        "idle",
      );
    });
    panel.append(button);
    form.querySelector(".form-status").after(panel);
  } catch {
    status(
      form,
      "No pudimos cargar las condiciones actuales. Conservamos tus datos; vuelve a intentarlo o escribe por Instagram.",
      "error",
    );
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button button-secondary";
    retry.textContent = "Cargar condiciones actualizadas";
    retry.onclick = () => reviewUpdate(form, c, code);
    panel.append(retry);
    form.querySelector(".form-status").after(panel);
  }
}

for (const details of document.querySelectorAll(".option-consultation"))
  details.addEventListener("toggle", () => {
    if (details.open) {
      const context = details.querySelector(".form-context");
      context.tabIndex = -1;
      context.focus();
    }
  });
