// Full brand film: explicit playback only; the native player remains the fallback.
const story = document.querySelector(".product-story");
if (story) {
  const video = story.querySelector("video");
  const posterPlay = story.querySelector(".story-poster-play");
  const watchButton = story.querySelector(".story-watch");
  const label = story.querySelector("[data-story-label]");
  const status = story.querySelector(".story-status");
  let started = false;
  video.controls = false;
  story.classList.add("is-enhanced");
  posterPlay.hidden = false;
  watchButton.hidden = false;
  const updatePlayback = () => {
    const playing = !video.paused && !video.ended;
    story.classList.toggle("is-playing", playing);
    watchButton
      .querySelector("path")
      .setAttribute(
        "d",
        playing ? "M6 4h4v16H6z M14 4h4v16h-4z" : "M7 4.5v15l12-7.5z",
      );
    label.textContent = playing
      ? "Pausar video"
      : video.ended
        ? "Volver a ver · 1:40"
        : started
          ? "Continuar video"
          : "Ver video completo · 1:40";
  };
  story.querySelectorAll("[data-story-play]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!video.paused && !video.ended) {
        video.pause();
        return;
      }
      status.hidden = true;
      posterPlay.hidden = true;
      video.controls = true;
      if (button === posterPlay) video.focus({ preventScroll: true });
      if (video.error) video.load();
      try {
        await video.play();
        started = true;
        updatePlayback();
      } catch {
        status.textContent = "Pulsa reproducir en el video para comenzar.";
        status.hidden = false;
      }
    });
  });
  video.addEventListener("play", () => {
    started = true;
    posterPlay.hidden = true;
    status.hidden = true;
    updatePlayback();
  });
  video.addEventListener("pause", updatePlayback);
  video.addEventListener("ended", updatePlayback);
  video.addEventListener("error", () => {
    status.textContent =
      "No se pudo cargar el video. Pulsa el botón para volver a intentarlo.";
    status.hidden = false;
  });
}

// Product family navigation and community reviews.
const header = document.querySelector(".site-header");
const nav = document.querySelector(".product-navigation");
const familyLinks = [...document.querySelectorAll(".product-nav-links a")];
const familySections = familyLinks.map((a) => document.querySelector(a.hash));
let frame;
function updateNavigation() {
  frame = null;
  const stickyHeader = getComputedStyle(header).position === "sticky";
  document.body.style.setProperty(
    "--product-header-height",
    `${stickyHeader ? header.getBoundingClientRect().height : 0}px`,
  );
  const limit =
    (stickyHeader ? header.getBoundingClientRect().height : 0) +
    nav.getBoundingClientRect().height +
    64;
  let active = 0;
  familySections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= limit) active = index;
  });
  familyLinks.forEach((link, index) => {
    if (index === active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
function scheduleNavigation() {
  if (!frame) frame = requestAnimationFrame(updateNavigation);
}
if (header && nav) {
  addEventListener("scroll", scheduleNavigation, { passive: true });
  addEventListener("resize", scheduleNavigation, { passive: true });
  if ("ResizeObserver" in window)
    new ResizeObserver(scheduleNavigation).observe(header);
  updateNavigation();
}

// Manual carousel: no autoplay; without JavaScript all comments remain readable.
const reviewCarousel = document.querySelector(".product-review");
if (reviewCarousel) {
  const slides = [...reviewCarousel.querySelectorAll(".review-slide")];
  const controls = reviewCarousel.querySelector(".review-controls");
  const count = reviewCarousel.querySelector(".review-count");
  let current = 0;
  const showReview = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
    });
    count.textContent = `${current + 1} / ${slides.length}`;
  };
  if (slides.length > 1) {
    controls.hidden = false;
    showReview(0);
    controls
      .querySelector("[data-review-prev]")
      .addEventListener("click", () => showReview(current - 1));
    controls
      .querySelector("[data-review-next]")
      .addEventListener("click", () => showReview(current + 1));
  }
}
