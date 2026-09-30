import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { boundedJSON, InquiryWriter } from '../../services/inquiry-receiver/src/worker.mjs';
import { readConfiguration, verifyTurnstile, hashRateSource } from '../../services/inquiry-receiver/src/config.mjs';
import { GitHubInboxRepository, encodeBase64 } from '../../services/inquiry-receiver/src/github.mjs';
import { inboxPath } from '../../services/inquiry-receiver/src/contract.mjs';
import { MemoryRateStorage } from '../../services/inquiry-receiver/local-server.mjs';
import { makeInput, ID, OTHER_ID, env } from './fixtures.mjs';

const endpoint = 'https://receiver.example.test/v1/consultas';
const request = (body = makeInput(), headers = {}, method = 'POST') => new Request(endpoint, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://gsaco.github.io', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
test('Worker disabled by default, rejects malicious origin, and exposes no public read/list endpoint', async () => {
  const disabled = await worker.fetch(request(), { ...env, RECEIVER_ENABLED: 'false' }); assert.equal(disabled.status, 503); assert.deepEqual(await disabled.json(), { error: 'receiver_disabled' });
  const forbidden = await worker.fetch(request(makeInput(), { Origin: 'https://evil.test' }), env); assert.equal(forbidden.status, 403); assert.equal(forbidden.headers.get('access-control-allow-origin'), null);
  const list = await worker.fetch(new Request('https://receiver.example.test/v1/consultas/adf9c8d1'), env); assert.equal(list.status, 404);
  const get = await worker.fetch(request(undefined, {}, 'GET'), env); assert.equal(get.status, 405); assert.equal(get.headers.get('cache-control'), 'no-store');
});
test('Exact preflight CORS disallows arbitrary headers/credential flow and accepts JSON POST', async () => {
  const valid = await worker.fetch(request(undefined, { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }, 'OPTIONS'), env);
  assert.equal(valid.status, 204); assert.equal(valid.headers.get('access-control-allow-origin'), 'https://gsaco.github.io'); assert.equal(valid.headers.get('access-control-allow-credentials'), null);
  const invalid = await worker.fetch(request(undefined, { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' }, 'OPTIONS'), env); assert.equal(invalid.status, 403);
});
test('Content type, declared length, actual streaming length and invalid UTF8 are bounded', async () => {
  await assert.rejects(() => boundedJSON(request({}, { 'Content-Type': 'text/plain' })), error => error.status === 415);
  await assert.rejects(() => boundedJSON(request({}, { 'Content-Length': '16385' })), error => error.status === 413);
  await assert.rejects(() => boundedJSON(request({ message: 'x'.repeat(17000) })), error => error.status === 413);
  await assert.rejects(() => boundedJSON(new Request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0xff]) })), error => error.status === 400);
});
test('Valid requests only invoke stable business writer with hashed network key and safe response', async () => {
  let requestCount = 0;
  const fixtureEnv = { ...env, INQUIRY_WRITER: { idFromName: name => { assert.equal(name, 'mabell-ramos-inbox-v1'); return 'business-id'; }, get: id => { assert.equal(id, 'business-id'); return { fetch: async (_url, options) => { requestCount++; const body = JSON.parse(options.body); assert.match(body.rateKey, /^[a-f0-9]{64}$/); assert.ok(!options.body.includes('192.0.2.5')); return new Response(JSON.stringify({ receiptId: `MR-${ID.toUpperCase()}`, receivedAt: '2026-09-29T18:00:00.000Z', status: 'received' }), { status: 201 }); } }; } } };
  const result = await worker.fetch(request(makeInput(), { 'CF-Connecting-IP': '192.0.2.5' }), fixtureEnv);
  assert.equal(result.status, 201); assert.equal(requestCount, 1); assert.deepEqual(Object.keys(await result.json()).sort(), ['receiptId', 'receivedAt', 'status']);
});
test('Missing credential, unsafe public origin, unset retention and plain HTTP catalog fail closed', () => {
  for (const patch of [{ GITHUB_TOKEN: '' }, { RATE_HASH_SECRET: 'weak' }, { ALLOWED_ORIGINS: '["*"]' }, { RETENTION_DAYS: '' }, { PUBLIC_CATALOG_JSON: '', PUBLIC_CATALOG_URL: 'http://localhost/catalog.json' }, { GITHUB_REPOSITORY: 'owner/repo/../../public' }]) assert.throws(() => readConfiguration({ ...env, ...patch }));
});
test('Turnstile verified by server must match real configured hostname and action; raw IP is not forwarded', async () => {
  const config = readConfiguration(env);
  const fake = result => async (_url, options) => { assert.equal(options.method, 'POST'); assert.equal(options.body.get('secret'), env.TURNSTILE_SECRET); assert.equal(options.body.get('remoteip'), null); return Response.json(result); };
  assert.equal(await verifyTurnstile('valid', ID, config, fake({ success: true, hostname: 'gsaco.github.io', action: 'public_inquiry' })), true);
  assert.equal(await verifyTurnstile('valid', ID, config, fake({ success: true, hostname: 'evil.test', action: 'public_inquiry' })), false);
  assert.equal(await verifyTurnstile('valid', ID, config, fake({ success: true, hostname: 'gsaco.github.io', action: 'login' })), false);
  await assert.rejects(() => verifyTurnstile('valid', ID, config, async () => { throw new Error('Cloud offline'); }), error => error.code === 'anti_abuse_unavailable');
  assert.notEqual(await hashRateSource('192.0.2.5', env.RATE_HASH_SECRET), await hashRateSource('192.0.2.5', 'another-secret-long-enough-for-hmac'));
});
test('GitHub adapter refuses a public repo and never records PII in path/commit message', async () => {
  const publicRepo = new GitHubInboxRepository({ repository: 'owner/private-inbox', token: 'secret', fetcher: async () => Response.json({ private: false, full_name: 'owner/private-inbox' }) });
  await assert.rejects(() => publicRepo.assertPrivate(), error => error.code === 'repository_not_private');
  const calls = [];
  const repository = new GitHubInboxRepository({ repository: 'owner/private-inbox', token: 'secret', fetcher: async (url, options) => { calls.push({ url, options }); return new Response(null, { status: 201 }); } });
  await repository.create(inboxPath(ID), { requestId: ID, input: { contact: { name: 'María', value: 'private@example.test' } } });
  const write = JSON.parse(calls[0].options.body); assert.equal(write.message, `Receive inquiry ${ID}`); assert.ok(!calls[0].url.includes('María')); assert.ok(!write.message.includes('private@example.test')); assert.equal(write.sha, undefined); assert.equal(write.branch, 'main');
  assert.equal(new TextDecoder().decode(Uint8Array.from(atob(encodeBase64('ají')), ch => ch.charCodeAt(0))), 'ají');
});
test('Real Durable Object fetch coordinates a complete receipt round trip and concurrent retry', async t => {
  const records = new Map(); let writes = 0, inFlight = 0, maximumInFlight = 0;
  t.mock.method(globalThis, 'fetch', async (address, options = {}) => {
    inFlight++; maximumInFlight = Math.max(maximumInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, 1));
    try {
      if (address === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return Response.json({ success: true, hostname: 'gsaco.github.io', action: 'public_inquiry' });
      const url = new URL(address), path = url.pathname.split('/contents/')[1];
      if (!path) return Response.json({ private: true, archived: false, full_name: env.GITHUB_REPOSITORY });
      if (options.method === 'PUT') {
        writes++; const body = JSON.parse(options.body); assert.equal(body.sha, undefined);
        if (records.has(path)) return Response.json({ message: 'already exists' }, { status: 422 });
        records.set(path, body.content); return Response.json({ content: { path } }, { status: 201 });
      }
      if (!records.has(path)) return new Response(null, { status: 404 });
      const content = records.get(path); return Response.json({ type: 'file', encoding: 'base64', path, content, size: atob(content).length });
    } finally { inFlight--; }
  });
  const storage = new MemoryRateStorage(); storage.getAlarm = async () => storage.alarm ?? null; storage.setAlarm = async time => { storage.alarm = time; };
  const object = new InquiryWriter({ storage }, env);
  const send = input => object.fetch(new Request('https://writer.internal/receive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { ...input, requestedDate: null }, rateKey: 'a'.repeat(64) }) }));
  const results = await Promise.all([send(makeInput()), send(makeInput()), send(makeInput({ requestId: OTHER_ID }))]);
  assert.deepEqual(results.map(value => value.status), [201, 200, 201]); assert.equal(writes, 2); assert.equal(records.size, 2); assert.equal(maximumInFlight, 1);
  assert.equal((await results[1].json()).receiptId, `MR-${ID.toUpperCase()}`); assert.ok(storage.alarm > Date.now());
});
test('Refreshing a consumed anti-abuse token retains inquiry ID but changes verification idempotency key', async () => {
  const config = readConfiguration(env), keys = [];
  const fetcher = async (_url, options) => { keys.push(options.body.get('idempotency_key')); return Response.json({ success: false }); };
  await verifyTurnstile('first-token', ID, config, fetcher); await verifyTurnstile('fresh-token', ID, config, fetcher); await verifyTurnstile('fresh-token', ID, config, fetcher);
  assert.notEqual(keys[0], keys[1]); assert.equal(keys[1], keys[2]); assert.match(keys[0], /^[a-f0-9-]{36}$/);
});
test('Durable Object alarm prunes 300 expired rate counters in supported 128-key batches and preserves current counters', async t => {
  const clock = new Date('2026-09-29T18:00:00.000Z').getTime();
  t.mock.method(Date, 'now', () => clock);
  const bucket = Math.floor(clock / 600000);
  const values = new Map(Array.from({ length: 300 }, (_, index) => [`rate:attempt:source:${String(index).padStart(3, '0')}`, { bucket: bucket - 1, count: 1 }]));
  values.set('rate:new:global', { bucket, count: 2 });
  const batches = []; let alarm = null;
  const storage = {
    async list({ prefix, startAfter, limit }) {
      return new Map([...values].sort(([a], [b]) => a.localeCompare(b)).filter(([key]) => key.startsWith(prefix) && (!startAfter || key > startAfter)).slice(0, limit));
    },
    async delete(keys) {
      assert.ok(keys.length <= 128, 'Cloudflare rejects more than 128 keys per delete');
      batches.push(keys.length); for (const key of keys) values.delete(key);
    },
    async setAlarm(time) { alarm = time; },
  };
  await new InquiryWriter({ storage }, env).alarm();
  assert.deepEqual(batches, [128, 128, 44]);
  assert.deepEqual([...values], [['rate:new:global', { bucket, count: 2 }]]);
  assert.equal(alarm, clock + 600000);
});
