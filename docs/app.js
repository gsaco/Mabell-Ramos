'use strict';

const titles = ['Portada', 'Chocotejas', 'Alfajores', 'Bombones', 'Trufas y donas', 'Paquetes de regalo', 'Bocaditos dulces', 'Catering dulce', 'Catering salado', 'Arma tu selección', 'Panes personales', 'Bebidas', 'Especiales por encargo', 'Cómo hacer tu pedido'];
const widths = [640, 960, 1280];
const select = document.querySelector('#page-select');
const image = document.querySelector('#page');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const counter = document.querySelector('#counter');
const zoom = document.querySelector('#zoom');
const viewport = document.querySelector('#viewport');
const status = document.querySelector('#status');
const connection = navigator.connection;
let current = 0;
let generation = 0;
let fullLoader = null;
let idleTimer = null;
let ahead = null;
let lastDirection = 1;

titles.forEach((title, index) => select.add(new Option(`${String(index + 1).padStart(2, '0')} · ${title}`, index)));

function slug(index) { return `pagina-${String(index + 1).padStart(2, '0')}`; }
function previewUrl(index, width) { return `assets/previews/${slug(index)}-${width}.webp`; }
function sources(index) { return widths.map(width => `${previewUrl(index, width)} ${width}w`).join(', '); }

function fittedWidth() {
  const style = getComputedStyle(viewport);
  const availableWidth = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const availableHeight = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  return Math.max(1, Math.floor(Math.min(availableWidth, availableHeight * 4216 / 5972)));
}

function setStatus(message) {
  status.textContent = message;
  status.hidden = false;
  viewport.setAttribute('aria-busy', 'true');
}
function ready() {
  status.hidden = true;
  viewport.setAttribute('aria-busy', 'false');
}
function cancelWork() {
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = null;
  if (fullLoader) {
    fullLoader.onload = null;
    fullLoader.onerror = null;
    fullLoader.src = '';
    fullLoader = null;
  }
}

// Anticipa una sola página, después de mostrar la actual, sin descargar originales.
function warmNeighbor() {
  if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return;
  const version = generation;
  const neighbor = current + lastDirection;
  if (neighbor < 0 || neighbor >= titles.length) return;
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (version !== generation || document.visibilityState === 'hidden') return;
    ahead = new Image();
    ahead.decoding = 'async';
    ahead.fetchPriority = 'low';
    ahead.sizes = `${fittedWidth()}px`;
    ahead.srcset = sources(neighbor);
    ahead.src = previewUrl(neighbor, 640);
  }, 400);
}

// La vista sigue visible mientras se prepara el original de resolución completa.
function loadOriginal() {
  if (!viewport.classList.contains('expanded') || fullLoader || image.dataset.quality === 'original') return;
  const version = generation;
  const index = current;
  setStatus('Cargando detalle en calidad original…');
  const candidate = new Image();
  fullLoader = candidate;
  candidate.decoding = 'async';
  candidate.fetchPriority = 'high';
  candidate.onload = async () => {
    try { await candidate.decode(); } catch { /* onload ya confirmó que hay una imagen disponible. */ }
    if (version !== generation || !viewport.classList.contains('expanded')) return;
    fullLoader = null;
    image.dataset.quality = 'original';
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.src = candidate.src;
    image.hidden = false;
    ready();
    warmNeighbor();
  };
  candidate.onerror = () => {
    if (version !== generation) return;
    fullLoader = null;
    setStatus('No se pudo cargar el detalle original. Puedes seguir viendo la página o volver a ampliar para reintentar.');
    viewport.setAttribute('aria-busy', 'false');
  };
  candidate.src = `assets/${slug(index)}.webp`;
}

function show(index, updateHash = true) {
  const selected = Number.isFinite(index) ? Math.max(0, Math.min(titles.length - 1, Math.trunc(index))) : 0;
  if (selected !== current) lastDirection = selected > current ? 1 : -1;
  current = selected;
  generation += 1;
  cancelWork();
  select.value = String(current);
  counter.textContent = `${current + 1} / ${titles.length}`;
  previous.disabled = current === 0;
  next.disabled = current === titles.length - 1;
  setStatus('Cargando página…');
  image.hidden = true;
  image.dataset.quality = 'screen';
  image.alt = `Página ${current + 1}: ${titles[current]} — catálogo de Mabell Ramos`;
  image.sizes = `${fittedWidth()}px`;
  image.srcset = sources(current);
  image.src = previewUrl(current, 640);
  viewport.scrollTo(0, 0);
  if (image.complete && image.naturalWidth && image.currentSrc.includes(slug(current))) screenLoaded();
  if (updateHash) history.replaceState(null, '', `#pagina-${current + 1}`);
}

function screenLoaded() {
  if (!image.currentSrc.includes(slug(current))) return;
  image.hidden = false;
  if (image.dataset.quality === 'original') { ready(); return; }
  if (viewport.classList.contains('expanded')) loadOriginal();
  else { ready(); warmNeighbor(); }
}
image.addEventListener('load', screenLoaded);
image.addEventListener('error', () => {
  setStatus('No se pudo cargar esta página. Vuelve a seleccionarla para reintentar o descarga el PDF original.');
  viewport.setAttribute('aria-busy', 'false');
});
select.addEventListener('change', () => show(Number(select.value)));
previous.addEventListener('click', () => show(current - 1));
next.addEventListener('click', () => show(current + 1));
zoom.addEventListener('click', () => {
  const expanded = viewport.classList.toggle('expanded');
  zoom.setAttribute('aria-pressed', String(expanded));
  zoom.textContent = expanded ? 'Ajustar −' : 'Ampliar ＋';
  viewport.scrollTo(0, 0);
  if (expanded) loadOriginal();
  else show(current);
});
document.addEventListener('keydown', event => {
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName) || viewport.classList.contains('expanded')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
});

// Una URL directa a Alfajores carga Alfajores; nunca descarga primero la portada.
function fromHash() {
  const match = location.hash.match(/^#pagina-(\d+)$/);
  show(match ? Number(match[1]) - 1 : 0);
}
window.addEventListener('hashchange', fromHash);
if ('ResizeObserver' in window) {
  new ResizeObserver(() => {
    if (image.dataset.quality === 'screen') image.sizes = `${fittedWidth()}px`;
  }).observe(viewport);
}
fromHash();
