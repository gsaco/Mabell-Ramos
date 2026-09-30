import { ContractError, MAX_REQUEST_BYTES, validatePublicInquiryInput } from './contract.mjs';
import { ReceiverError, SerialWriter, StoredRateLimiter, receiveInquiry } from './core.mjs';
import { GitHubInboxRepository } from './github.mjs';
import { hashRateSource, loadConfiguredCatalog, readConfiguration, verifyTurnstile } from './config.mjs';

export function jsonResponse(body, status = 200, { origin = null, retryAfter = null } = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (origin) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Expose-Headers': 'Retry-After' });
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  return new Response(JSON.stringify(body), { status, headers });
}
export function errorResponse(error, origin = null) {
  const known = error instanceof ReceiverError || error instanceof ContractError;
  const status = error instanceof ContractError ? 400 : known ? error.status : 503;
  const body = { error: error instanceof ContractError ? 'invalid_input' : known ? error.code : 'receipt_unconfirmed' };
  if (known && error.field) body.field = error.field;
  return jsonResponse(body, status, { origin, retryAfter: known ? error.retryAfter : 30 });
}
export async function boundedJSON(request) {
  const mediaType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') throw new ReceiverError('unsupported_media_type', 415);
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_REQUEST_BYTES)) throw new ReceiverError('request_too_large', 413);
  if (!request.body) throw new ReceiverError('invalid_input', 400);
  const reader = request.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new ReceiverError('request_too_large', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) { if (error instanceof ReceiverError) throw error; throw new ReceiverError('invalid_input', 400); }
}

export default {
  async fetch(request, env) {
    let origin = null;
    try {
      const path = new URL(request.url).pathname;
      if (path !== '/v1/consultas') return jsonResponse({ error: 'not_found' }, 404);
      const config = readConfiguration(env);
      const suppliedOrigin = request.headers.get('origin');
      if (!suppliedOrigin || !config.origins.includes(suppliedOrigin)) throw new ReceiverError('origin_not_allowed', 403);
      origin = suppliedOrigin;
      if (request.method === 'OPTIONS') {
        const requestedHeaders = (request.headers.get('access-control-request-headers') || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
        if (request.headers.get('access-control-request-method') !== 'POST' || requestedHeaders.some(value => value !== 'content-type')) throw new ReceiverError('origin_not_allowed', 403);
        const headers = new Headers(jsonResponse({}, 200, { origin }).headers);
        headers.set('Access-Control-Max-Age', '600'); return new Response(null, { status: 204, headers });
      }
      if (request.method !== 'POST') throw new ReceiverError('method_not_allowed', 405);
      const input = validatePublicInquiryInput(await boundedJSON(request));
      if (!env.INQUIRY_WRITER) throw new ReceiverError('configuration_unavailable');
      const rateKey = await hashRateSource(request.headers.get('CF-Connecting-IP') || 'unknown-source', config.hashSecret);
      // The caller never controls a repository, file path or DO identity.
      const objectId = env.INQUIRY_WRITER.idFromName('mabell-ramos-inbox-v1');
      const writer = env.INQUIRY_WRITER.get(objectId);
      const internal = await writer.fetch('https://writer.internal/receive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, rateKey }) });
      const result = await internal.json();
      return jsonResponse(result, internal.status, { origin, retryAfter: Number(internal.headers.get('Retry-After')) || null });
    } catch (error) { return errorResponse(error, origin); }
  },
};

/** One named Durable Object serializes the whole read/check/write/read operation for this business. */
export class InquiryWriter {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.writer = new SerialWriter(); }
  async fetch(request) {
    return this.writer.run(async () => {
      try {
        if (request.method !== 'POST' || new URL(request.url).pathname !== '/receive') throw new ReceiverError('not_found', 404);
        const config = readConfiguration(this.env);
        const { input, rateKey } = await request.json();
        if (typeof rateKey !== 'string' || !/^[a-f0-9]{64}$/.test(rateKey)) throw new ReceiverError('invalid_input', 400);
        const ingress = new StoredRateLimiter(this.ctx.storage, { ...config.rate, perSource: config.rate.perSource * 8, global: config.rate.global * 8, prefix: 'rate:attempt:' });
        await ingress.check(rateKey, Date.now());
        const rateLimiter = new StoredRateLimiter(this.ctx.storage, config.rate);
        const repository = new GitHubInboxRepository(config);
        if (!await this.ctx.storage.getAlarm()) await this.ctx.storage.setAlarm(Date.now() + config.rate.windowSeconds * 1000);
        const result = await receiveInquiry(input, { repository, verifyAntiAbuse: (token, id) => verifyTurnstile(token, id, config), loadCatalog: () => loadConfiguredCatalog(config), rateLimiter, rateKey, privacyNoticeVersion: config.privacyNoticeVersion, attentionRule: config.attentionRule });
        return jsonResponse(result.receipt, result.statusCode);
      } catch (error) { return errorResponse(error); }
    });
  }
  async alarm() {
    await this.writer.run(async () => {
      const config = readConfiguration(this.env);
      const bucket = Math.floor(Date.now() / (config.rate.windowSeconds * 1000));
      let startAfter;
      while (true) {
        const entries = await this.ctx.storage.list({ prefix: 'rate:', limit: 1000, ...(startAfter ? { startAfter } : {}) });
        if (!entries.size) break;
        const stale = [...entries].filter(([, value]) => value.bucket < bucket).map(([key]) => key);
        // The asynchronous storage API accepts at most 128 keys per delete.
        for (let offset = 0; offset < stale.length; offset += 128) {
          await this.ctx.storage.delete(stale.slice(offset, offset + 128));
        }
        startAfter = [...entries.keys()].at(-1);
        if (entries.size < 1000) break;
      }
      if ((await this.ctx.storage.list({ prefix: 'rate:', limit: 1 })).size) await this.ctx.storage.setAlarm(Date.now() + config.rate.windowSeconds * 1000);
    });
  }
}
