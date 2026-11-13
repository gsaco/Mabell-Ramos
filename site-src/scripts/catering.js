// Catering is an email inquiry, separate from the optional private CRM receiver.
const form = document.querySelector("#catering-form");
if (form) {
  const submit = form.querySelector(".catering-submit");
  const area = form.querySelector(".catering-status");
  const alternative = form.querySelector(".catering-whatsapp");
  const scopeNames = {
    unsure: "Por definir",
    food_only: "Solo alimentos",
    food_and_service: "Alimentos + servicio",
  };
  let busy = false,
    received = false,
    pending = null;
  form.noValidate = true;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  form.elements.date.min = today;
  const phoneNumber = (value) => {
    const clean = value.replace(/[\s().-]/g, "");
    return /^9\d{8}$/.test(clean)
      ? "+51" + clean
      : /^51\d{9}$/.test(clean)
        ? "+" + clean
        : clean;
  };
  function values() {
    return Object.fromEntries(
      [
        "name",
        "phone",
        "date",
        "guests",
        "district",
        "scope",
        "email",
        "message",
      ].map((k) => [k, form.elements[k].value.trim()]),
    );
  }
  function summary(v) {
    return [
      "Hola, quisiera cotizar catering para mi reunión.",
      v.name && `Nombre: ${v.name}`,
      v.phone && `WhatsApp: ${phoneNumber(v.phone)}`,
      `Fecha: ${v.date || "Por definir"}`,
      `Personas: ${v.guests || "Por definir"}`,
      `Distrito: ${v.district || "Por definir"}`,
      `Servicio: ${scopeNames[v.scope]}`,
      v.email && `Correo: ${v.email}`,
      v.message && `Comentario: ${v.message}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  function updateWhatsApp() {
    alternative.href =
      "https://wa.me/51932666526?text=" + encodeURIComponent(summary(values()));
  }
  function status(message, state) {
    area.textContent = message;
    area.dataset.state = state;
  }
  function clearError(input) {
    input.removeAttribute("aria-invalid");
    const error = document.getElementById(input.id + "-error");
    if (error) error.textContent = "";
    const desc = (input.getAttribute("aria-describedby") || "")
      .split(" ")
      .filter((id) => id && id !== input.id + "-error");
    if (desc.length) input.setAttribute("aria-describedby", desc.join(" "));
    else input.removeAttribute("aria-describedby");
  }
  function validate() {
    let first = null;
    for (const input of form.querySelectorAll(
      "input:not([type=hidden]),textarea",
    )) {
      clearError(input);
      if (input.name === "_honey") continue;
      let message = "";
      if (input.name === "name" && input.value.trim().length < 2)
        message = "Escribe tu nombre (al menos 2 caracteres).";
      else if (
        input.name === "phone" &&
        !/^\+[1-9]\d{7,14}$/.test(phoneNumber(input.value))
      )
        message =
          "Escribe un WhatsApp de 9 dígitos o incluye el prefijo internacional.";
      else if (input.validity.typeMismatch)
        message = "Revisa el formato del correo electrónico.";
      else if (
        input.name === "date" &&
        (input.validity.badInput || input.validity.rangeUnderflow)
      )
        message = "Elige una fecha de hoy o futura, o déjala por definir.";
      else if (input.name === "guests" && !input.validity.valid)
        message =
          "Indica una cantidad entera entre 1 y 10 000, o déjala por definir.";
      else if (!input.validity.valid)
        message = "Revisa este dato antes de continuar.";
      if (message) {
        input.closest("details")?.setAttribute("open", "");
        input.setAttribute("aria-invalid", "true");
        const err = document.getElementById(input.id + "-error");
        if (err) {
          err.textContent = message;
          input.setAttribute(
            "aria-describedby",
            (
              (input.getAttribute("aria-describedby") || "") +
              " " +
              err.id
            ).trim(),
          );
        }
        first ||= input;
      }
    }
    if (first) {
      status("Revisa los campos indicados. Tus datos siguen aquí.", "error");
      first.focus();
      return false;
    }
    return true;
  }
  form.addEventListener("input", (event) => {
    clearError(event.target);
    updateWhatsApp();
    if (!busy && !received) pending = null;
  });
  form.addEventListener("change", updateWhatsApp);
  function payload(v) {
    const reference = "MR-CAT-" + crypto.randomUUID();
    const p = {
      name: v.name,
      WhatsApp: phoneNumber(v.phone),
      Fecha: v.date || "Por definir",
      Personas: v.guests || "Por definir",
      Distrito: v.district || "Por definir",
      Servicio: scopeNames[v.scope],
      Comentario: v.message || "Sin comentario",
      Referencia: reference,
      _subject: `Catering · ${v.guests ? v.guests + " personas" : "Personas por definir"} · ${v.district || "Zona por definir"} · ${v.date || "Fecha por definir"}`,
      _template: "table",
      _url: "https://gsaco.github.io/Mabell-Ramos/catering/",
      _honey: form.elements._honey.value,
    };
    if (v.email) {
      p.email = v.email;
      p._replyto = v.email;
    }
    return p;
  }
  if (form.dataset.enabled !== "true") {
    status(
      "El envío por correo está en preparación. Puedes completar tus datos y continuar por WhatsApp.",
      "pending",
    );
    submit.textContent = "Continuar por WhatsApp";
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || received || !validate()) return;
    updateWhatsApp();
    if (form.dataset.enabled !== "true") {
      location.href = alternative.href;
      return;
    }
    if (form.elements._honey.value) {
      status(
        "No pudimos verificar el envío. Puedes escribirnos por WhatsApp.",
        "error",
      );
      return;
    }
    pending ||= payload(values());
    busy = true;
    submit.disabled = true;
    submit.textContent = "Enviando…";
    for (const input of form.querySelectorAll("input,select,textarea"))
      input.disabled = true;
    status("Estamos enviando tu solicitud…", "sending");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(
        "https://formsubmit.co/ajax/mabellramospe@gmail.com",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(pending),
          signal: controller.signal,
          credentials: "omit",
        },
      );
      const result = await response.json();
      // Activation responses must never be shown as a customer receipt.
      const activation = /activat|confirm your email|verify your email/i.test(
        result.message || "",
      );
      if (
        !response.ok ||
        ![true, "true"].includes(result.success) ||
        activation
      )
        throw Error(activation ? "activation" : "delivery");
      received = true;
      status("", "received");
      const title = document.createElement("strong");
      title.textContent = "Recibimos tu solicitud.";
      const text = document.createElement("p");
      text.textContent =
        "Te contactaremos por WhatsApp para revisar disponibilidad y preparar tu propuesta. Esto todavía no confirma una reserva.";
      const ref = document.createElement("small");
      ref.textContent = "Referencia: " + pending.Referencia;
      area.append(title, text, ref);
      area.focus();
      submit.hidden = true;
    } catch (error) {
      status(
        error.message === "activation"
          ? "El envío por correo aún necesita activación. Tus datos siguen aquí; puedes continuar por WhatsApp."
          : "No pudimos confirmar el envío. Conservamos tus datos. Puedes reintentar o enviarlos por WhatsApp. Si ya recibiste confirmación, evita reenviarlos.",
        "error",
      );
      submit.textContent = "Reintentar envío";
      area.focus();
    } finally {
      clearTimeout(timeout);
      busy = false;
      if (!received) {
        for (const input of form.querySelectorAll("input,select,textarea"))
          input.disabled = false;
        submit.disabled = false;
      }
    }
  });
  updateWhatsApp();
}
