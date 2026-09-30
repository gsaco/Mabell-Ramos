/** Shared, dependency-free contract for the website, receiver and management app. */
export const INPUT_SCHEMA_VERSION = 1;
export const MAX_REQUEST_BYTES = 16 * 1024;
export const ALLOWED_SOURCE_PAGES = ['/', '/productos/', '/catering/', '/catalogo/'];
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ContractError extends Error {
  constructor(message, field = '') { super(message); this.name = 'ContractError'; this.field = field; }
}
const fail = (message, field) => { throw new ContractError(message, field); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function object(value, allowed, required, field) {
  if (!plain(value)) fail('Se esperaba un objeto.', field);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('Campo no permitido.', field ? `${field}.${key}` : key);
  for (const key of required) if (!Object.hasOwn(value, key)) fail('Falta un campo obligatorio.', field ? `${field}.${key}` : key);
  return value;
}
function string(value, min, max, field, trim = true) {
  if (typeof value !== 'string') fail('Se esperaba texto.', field);
  const result = (trim ? value.trim() : value).normalize('NFC');
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)) fail('Longitud o caracteres no válidos.', field);
  return result;
}
function oneOf(value, options, field) { if (!options.includes(value)) fail('Valor no permitido.', field); return value; }
function integer(value, min, max, field) { if (!Number.isSafeInteger(value) || value < min || value > max) fail('Cantidad no válida.', field); return value; }
function identifier(value, field) { const result = string(value, 1, 96, field); if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result)) fail('Referencia no válida.', field); return result; }
function date(value, field) {
  if (value === null) return null;
  const parsed = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : new Date(NaN);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('Fecha no válida.', field);
  return value;
}
function nullableText(value, max, field) { return value === null ? null : string(value, 1, max, field); }
function contact(value) {
  object(value, ['name', 'method', 'value'], ['name', 'method', 'value'], 'contact');
  const name = string(value.name, 2, 80, 'contact.name');
  const method = oneOf(value.method, ['whatsapp', 'email'], 'contact.method');
  let address = string(value.value, 3, 254, 'contact.value');
  if (method === 'whatsapp') {
    address = address.replace(/[\s().-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(address)) fail('Incluye un número internacional válido con prefijo de país.', 'contact.value');
  } else {
    if (address.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) fail('Correo no válido.', 'contact.value');
    const at = address.lastIndexOf('@'); address = address.slice(0, at) + address.slice(at).toLowerCase();
  }
  return { name, method, value: address };
}
function event(value) {
  object(value, ['scope', 'attendees', 'time', 'interests'], ['scope', 'attendees', 'time', 'interests'], 'event');
  const scope = oneOf(value.scope, ['food_only', 'food_and_service', 'unsure'], 'event.scope');
  const attendees = value.attendees === null ? null : integer(value.attendees, 1, 10000, 'event.attendees');
  const time = value.time === null ? null : string(value.time, 5, 5, 'event.time');
  if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail('Hora no válida.', 'event.time');
  if (!Array.isArray(value.interests) || value.interests.length > 6 || new Set(value.interests).size !== value.interests.length) fail('Intereses no válidos.', 'event.interests');
  const interests = value.interests.map(x => oneOf(x, ['sweet', 'savory', 'drinks', 'setup', 'tableware', 'staff'], 'event.interests')).sort();
  return { scope, attendees, time, interests };
}

/** Strictly validates and normalizes a request. Dates in the past are checked only for NEW receipts. */
export function validatePublicInquiryInput(value, { includeAntiAbuse = true } = {}) {
  const fields = ['schemaVersion', 'requestId', 'kind', 'contact', 'option', 'catalog', 'occasion', 'requestedDate', 'district', 'event', 'message', 'source', 'privacyNoticeVersion'];
  if (includeAntiAbuse) fields.push('antiAbuseToken', 'website');
  object(value, fields, ['schemaVersion', 'requestId', 'kind', 'contact', 'requestedDate', 'district', 'message', 'source', 'privacyNoticeVersion', ...(includeAntiAbuse ? ['antiAbuseToken'] : [])], '');
  if (value.schemaVersion !== 1) fail('Versión de formulario incompatible.', 'schemaVersion');
  if (typeof value.requestId !== 'string' || !UUID_RE.test(value.requestId)) fail('Identificador no válido.', 'requestId');
  const kind = oneOf(value.kind, ['product_option', 'product_general', 'event', 'catalog_page'], 'kind');
  const result = { schemaVersion: 1, requestId: value.requestId.toLowerCase(), kind, contact: contact(value.contact) };
  if (kind === 'product_option') {
    object(value.option, ['id', 'revision', 'quantity'], ['id', 'revision', 'quantity'], 'option');
    result.option = { id: identifier(value.option.id, 'option.id'), revision: integer(value.option.revision, 1, 1e9, 'option.revision'), quantity: integer(value.option.quantity, 1, 1000, 'option.quantity') };
  } else if (Object.hasOwn(value, 'option')) fail('La opción no corresponde a este formulario.', 'option');
  if (kind === 'catalog_page') {
    object(value.catalog, ['version', 'page'], ['version', 'page'], 'catalog');
    result.catalog = { version: identifier(value.catalog.version, 'catalog.version'), page: integer(value.catalog.page, 1, 1000, 'catalog.page') };
  } else if (Object.hasOwn(value, 'catalog')) fail('La página de catálogo no corresponde a este formulario.', 'catalog');
  if (Object.hasOwn(value, 'occasion')) result.occasion = oneOf(value.occasion, ['disfrutar', 'regalar', 'descubrir', 'evento', 'otra'], 'occasion');
  result.requestedDate = date(value.requestedDate, 'requestedDate');
  result.district = nullableText(value.district, 80, 'district');
  if (kind === 'event') result.event = event(value.event);
  else if (Object.hasOwn(value, 'event')) fail('El evento no corresponde a este formulario.', 'event');
  result.message = string(value.message, 0, 500, 'message');
  object(value.source, ['page', 'campaignCode'], ['page'], 'source');
  result.source = { page: oneOf(value.source.page, ALLOWED_SOURCE_PAGES, 'source.page') };
  if (Object.hasOwn(value.source, 'campaignCode')) {
    result.source.campaignCode = string(value.source.campaignCode, 1, 64, 'source.campaignCode');
    if (!/^[a-zA-Z0-9_-]+$/.test(result.source.campaignCode)) fail('Código de campaña no válido.', 'source.campaignCode');
  }
  result.privacyNoticeVersion = identifier(value.privacyNoticeVersion, 'privacyNoticeVersion');
  if (includeAntiAbuse) {
    result.antiAbuseToken = string(value.antiAbuseToken, 1, 2048, 'antiAbuseToken');
    if (Object.hasOwn(value, 'website')) result.website = string(value.website, 0, 200, 'website');
  }
  return result;
}

export function logicalInput(input) {
  const { antiAbuseToken: _token, website: _trap, ...value } = input;
  return validatePublicInquiryInput(value, { includeAntiAbuse: false });
}
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function hashLogicalInput(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJSON(logicalInput(input))));
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
}
export const inboxPath = requestId => {
  if (!UUID_RE.test(requestId)) fail('Identificador no válido.', 'requestId');
  const id = requestId.toLowerCase(); return `data/inbox/${id.slice(0, 2)}/${id}.json`;
};
export const receiptFor = requestId => `MR-${requestId.toUpperCase()}`;

export function validateAttentionRule(value) {
  if (value === null) return null;
  object(value, ['version', 'responsible', 'timezone', 'responseHours', 'workDays', 'workStart', 'workEnd'], ['version', 'responsible', 'timezone', 'responseHours', 'workDays', 'workStart', 'workEnd'], 'attentionRule');
  const rule = { version: identifier(value.version, 'attentionRule.version'), responsible: oneOf(value.responsible, ['Mabel', 'Ana', null], 'attentionRule.responsible'), timezone: oneOf(value.timezone, ['America/Lima'], 'attentionRule.timezone'), responseHours: integer(value.responseHours, 1, 168, 'attentionRule.responseHours') };
  if (!Array.isArray(value.workDays) || value.workDays.length < 1 || value.workDays.length > 7 || new Set(value.workDays).size !== value.workDays.length) fail('Días de atención no válidos.', 'attentionRule.workDays');
  rule.workDays = value.workDays.map(day => integer(day, 1, 7, 'attentionRule.workDays')).sort();
  for (const field of ['workStart', 'workEnd']) {
    rule[field] = string(value[field], 5, 5, `attentionRule.${field}`);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule[field])) fail('Hora no válida.', `attentionRule.${field}`);
  }
  if (rule.workEnd <= rule.workStart) fail('El horario debe terminar después de comenzar.', 'attentionRule.workEnd');
  return rule;
}
export function validateOfferSnapshot(value) {
  if (value === null) return null;
  object(value, ['catalogVersion', 'optionId', 'optionRevision', 'name', 'occasion', 'saleUnit', 'priceCents', 'currency', 'quantity', 'items', 'presentation', 'deliveryConditions', 'allowedChanges'], ['catalogVersion', 'optionId', 'optionRevision', 'name', 'occasion', 'saleUnit', 'priceCents', 'currency', 'quantity', 'items', 'presentation', 'deliveryConditions', 'allowedChanges'], 'offerSnapshot');
  const result = { catalogVersion: identifier(value.catalogVersion, 'offerSnapshot.catalogVersion'), optionId: identifier(value.optionId, 'offerSnapshot.optionId'), optionRevision: integer(value.optionRevision, 1, 1e9, 'offerSnapshot.optionRevision'), name: string(value.name, 1, 160, 'offerSnapshot.name'), occasion: oneOf(value.occasion, ['disfrutar', 'regalar', 'descubrir'], 'offerSnapshot.occasion'), saleUnit: string(value.saleUnit, 1, 80, 'offerSnapshot.saleUnit'), priceCents: integer(value.priceCents, 0, 1e9, 'offerSnapshot.priceCents'), currency: oneOf(value.currency, ['PEN'], 'offerSnapshot.currency'), quantity: integer(value.quantity, 1, 1000, 'offerSnapshot.quantity') };
  if (!Array.isArray(value.items) || !value.items.length || value.items.length > 100) fail('Contenido de la opción no válido.', 'offerSnapshot.items');
  result.items = value.items.map(item => {
    object(item, ['productId', 'variantId', 'quantity'], ['productId', 'quantity'], 'offerSnapshot.items');
    const record = { productId: identifier(item.productId, 'offerSnapshot.items.productId'), quantity: integer(item.quantity, 1, 10000, 'offerSnapshot.items.quantity') };
    if (Object.hasOwn(item, 'variantId')) record.variantId = identifier(item.variantId, 'offerSnapshot.items.variantId');
    return record;
  });
  for (const field of ['presentation', 'deliveryConditions', 'allowedChanges']) result[field] = string(value[field], 1, 1000, `offerSnapshot.${field}`);
  return result;
}
export function validateStoredPublicInquiry(value) {
  object(value, ['schemaVersion', 'requestId', 'receiptId', 'receivedAt', 'contentHash', 'input', 'offerSnapshot', 'attentionRule'], ['schemaVersion', 'requestId', 'receiptId', 'receivedAt', 'contentHash', 'input', 'offerSnapshot', 'attentionRule'], '');
  if (value.schemaVersion !== 1) fail('Versión del registro incompatible.', 'schemaVersion');
  const input = validatePublicInquiryInput(value.input, { includeAntiAbuse: false });
  if (value.requestId !== input.requestId || value.receiptId !== receiptFor(input.requestId)) fail('Referencias del registro inconsistentes.', 'requestId');
  const parsedTime = new Date(value.receivedAt);
  if (typeof value.receivedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.receivedAt) || Number.isNaN(parsedTime.getTime()) || parsedTime.toISOString() !== value.receivedAt) fail('Hora de recepción no válida.', 'receivedAt');
  if (typeof value.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.contentHash)) fail('Huella no válida.', 'contentHash');
  const offerSnapshot = validateOfferSnapshot(value.offerSnapshot);
  if ((input.kind === 'product_option') !== (offerSnapshot !== null)) fail('Instantánea no compatible con la consulta.', 'offerSnapshot');
  if (offerSnapshot && (offerSnapshot.optionId !== input.option.id || offerSnapshot.optionRevision !== input.option.revision || offerSnapshot.quantity !== input.option.quantity)) fail('La instantánea no coincide con la opción consultada.', 'offerSnapshot');
  return { schemaVersion: 1, requestId: input.requestId, receiptId: value.receiptId, receivedAt: value.receivedAt, contentHash: value.contentHash, input, offerSnapshot, attentionRule: validateAttentionRule(value.attentionRule) };
}
export async function verifyStoredPublicInquiry(value) {
  const result = validateStoredPublicInquiry(value);
  if (await hashLogicalInput(result.input) !== result.contentHash) fail('La huella del registro no coincide.', 'contentHash');
  return result;
}
