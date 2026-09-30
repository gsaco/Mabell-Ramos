import { ContractError, hashLogicalInput, inboxPath, logicalInput, receiptFor, validateAttentionRule, validateOfferSnapshot, validatePublicInquiryInput, verifyStoredPublicInquiry } from './contract.mjs';

export class ReceiverError extends Error {
  constructor(code, status = 503, field = null, retryAfter = null) { super(code); this.name = 'ReceiverError'; this.code = code; this.status = status; this.field = field; this.retryAfter = retryAfter; }
}
export function limaDate(now) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
function offerFor(input, catalog) {
  if (input.kind === 'catalog_page') {
    const version = catalog?.catalog?.version ?? catalog?.version;
    const pages = catalog?.catalog?.pages ?? catalog?.pages;
    if (input.catalog.version !== version || !Number.isSafeInteger(pages) || input.catalog.page > pages) throw new ReceiverError('catalog_updated', 409, 'catalog');
    return null;
  }
  if (input.kind !== 'product_option') return null;
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.options)) throw new ReceiverError('configuration_unavailable');
  const matches = catalog.options.filter(option => option.id === input.option.id);
  if (matches.length !== 1 || matches[0].availability !== 'on_request') throw new ReceiverError('option_unavailable', 409, 'option');
  const option = matches[0];
  if (option.revision !== input.option.revision) throw new ReceiverError('offer_updated', 409, 'option');
  try {
    const snapshot = validateOfferSnapshot({ catalogVersion: catalog.version, optionId: option.id, optionRevision: option.revision, name: option.name, occasion: option.occasion, saleUnit: option.saleUnit, priceCents: option.priceCents, currency: option.currency, quantity: input.option.quantity, items: option.items, presentation: option.presentation, deliveryConditions: option.deliveryConditions, allowedChanges: option.allowedChanges });
    for (const item of snapshot.items) {
      const product = catalog.products?.find(value => value.id === item.productId);
      if (!product || (item.variantId && (!Array.isArray(product.validVariants) || !product.validVariants.includes(item.variantId)))) throw new Error('Unapproved product or variant');
    }
    return snapshot;
  } catch { throw new ReceiverError('configuration_unavailable'); }
}
function sameReceipt(record, hash) {
  if (record.contentHash !== hash) throw new ReceiverError('request_id_conflict', 409, 'requestId');
  return { statusCode: 200, receipt: { receiptId: record.receiptId, receivedAt: record.receivedAt, status: 'received' } };
}

/** Invoked inside a per-business serial writer. The repository is the durable source of truth. */
export async function receiveInquiry(raw, {
  repository, verifyAntiAbuse, loadCatalog, rateLimiter, rateKey,
  privacyNoticeVersion, attentionRule = null, now = () => new Date(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  let input;
  try { input = validatePublicInquiryInput(raw); }
  catch (error) { if (error instanceof ContractError) throw new ReceiverError('invalid_input', 400, error.field); throw error; }
  const hash = await hashLogicalInput(input);
  const path = inboxPath(input.requestId);
  await repository.assertPrivate();
  const existing = await repository.read(path);
  // This MUST happen before date, privacy, bot-token and current-offer checks.
  if (existing) return sameReceipt(await verifyStoredPublicInquiry(existing), hash);
  if (input.website) throw new ReceiverError('anti_abuse_failed', 403);
  if (input.privacyNoticeVersion !== privacyNoticeVersion) throw new ReceiverError('privacy_updated', 409, 'privacyNoticeVersion');
  const received = now();
  if (input.requestedDate && input.requestedDate < limaDate(received)) throw new ReceiverError('invalid_input', 400, 'requestedDate');
  await rateLimiter.check(rateKey, received.getTime());
  const offerSnapshot = offerFor(input, await loadCatalog());
  const verified = await verifyAntiAbuse(input.antiAbuseToken, input.requestId);
  if (!verified) throw new ReceiverError('anti_abuse_failed', 403);
  const record = { schemaVersion: 1, requestId: input.requestId, receiptId: receiptFor(input.requestId), receivedAt: received.toISOString(), contentHash: hash, input: logicalInput(input), offerSnapshot, attentionRule: validateAttentionRule(attentionRule) };
  await verifyStoredPublicInquiry(record);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await repository.create(path, record);
      const persisted = await repository.read(path);
      if (!persisted) throw new ReceiverError('receipt_unconfirmed');
      const checked = await verifyStoredPublicInquiry(persisted);
      if (checked.contentHash !== hash) throw new ReceiverError('request_id_conflict', 409, 'requestId');
      return { statusCode: 201, receipt: { receiptId: checked.receiptId, receivedAt: checked.receivedAt, status: 'received' } };
    } catch (error) {
      // A response may be lost after GitHub committed. Resolve via the immutable file.
      try {
        const after = await repository.read(path);
        if (after) return sameReceipt(await verifyStoredPublicInquiry(after), hash);
      } catch (readError) {
        if (readError instanceof ReceiverError && readError.code === 'request_id_conflict') throw readError;
      }
      if (error instanceof ReceiverError && error.code === 'request_id_conflict') throw error;
      if (attempt < 2 && [409, 422].includes(error.upstreamStatus)) { await sleep([250, 750][attempt]); continue; }
      throw new ReceiverError('receipt_unconfirmed', 503, null, error.retryAfter ?? 30);
    }
  }
  throw new ReceiverError('receipt_unconfirmed');
}

/** Explicit mutex survives request interleaving within a Durable Object instance. */
export class SerialWriter {
  #tail = Promise.resolve();
  async run(task) {
    const previous = this.#tail;
    let release;
    this.#tail = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await task(); } finally { release(); }
  }
}

export class StoredRateLimiter {
  constructor(storage, { perSource = 6, global = 60, windowSeconds = 600, prefix = 'rate:new:' } = {}) { this.storage = storage; this.perSource = perSource; this.global = global; this.windowSeconds = windowSeconds; this.prefix = prefix; }
  async check(key, now) {
    const bucket = Math.floor(now / (this.windowSeconds * 1000));
    const retryAfter = this.windowSeconds - Math.floor(now / 1000) % this.windowSeconds;
    await this.storage.transaction(async transaction => {
      const globalValue = await transaction.get(`${this.prefix}global`);
      const sourceValue = await transaction.get(`${this.prefix}source:${key}`);
      const globalCount = globalValue?.bucket === bucket ? globalValue.count : 0;
      const sourceCount = sourceValue?.bucket === bucket ? sourceValue.count : 0;
      if (globalCount >= this.global || sourceCount >= this.perSource) throw new ReceiverError('rate_limited', 429, null, retryAfter);
      await transaction.put(`${this.prefix}global`, { bucket, count: globalCount + 1 });
      await transaction.put(`${this.prefix}source:${key}`, { bucket, count: sourceCount + 1 });
      // Alarms clear old hashed rate counters; no contact/IP is persisted here.
    });
  }
}
