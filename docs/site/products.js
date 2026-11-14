// Full brand film: one play target, then standard accessible video controls.
const story = document.querySelector(".product-story");
if (story) {
  const video = story.querySelector("video");
  const posterPlay = story.querySelector(".story-poster-play");
  const status = story.querySelector(".story-status");
  video.controls = false;
  story.classList.add("is-enhanced");
  posterPlay.hidden = false;
  posterPlay.addEventListener("click", async () => {
    status.hidden = true;
    posterPlay.hidden = true;
    video.controls = true;
    video.focus({ preventScroll: true });
    if (video.error) video.load();
    try {
      await video.play();
    } catch {
      posterPlay.hidden = false;
      status.textContent = "Pulsa reproducir en el video para comenzar.";
      status.hidden = false;
    }
  });
  video.addEventListener("play", () => {
    posterPlay.hidden = true;
    status.hidden = true;
  });
  video.addEventListener("error", () => {
    posterPlay.hidden = false;
    status.textContent =
      "No se pudo cargar el video. Pulsa reproducir para volver a intentarlo.";
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
