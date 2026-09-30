import test from 'node:test';
import assert from 'node:assert/strict';
import { receiveInquiry, ReceiverError, SerialWriter, StoredRateLimiter, limaDate } from '../../services/inquiry-receiver/src/core.mjs';
import { inboxPath } from '../../services/inquiry-receiver/src/contract.mjs';
import { MemoryRateStorage } from '../../services/inquiry-receiver/local-server.mjs';
import { MemoryRepository, makeInput, makeOptionInput, catalog, baseDeps, ID, OTHER_ID } from './fixtures.mjs';

test('Receipts are issued only after independently reading persisted private data', async () => {
  const repository = new MemoryRepository(); const result = await receiveInquiry(makeInput(), baseDeps(repository));
  assert.equal(result.statusCode, 201); assert.equal(result.receipt.status, 'received'); assert.equal(repository.creates, 1); assert.equal(repository.reads, 2);
  assert.equal(repository.records.get(inboxPath(ID)).input.contact.name, 'María Ana Joya');
  assert.deepEqual(Object.keys(result.receipt).sort(), ['receiptId', 'receivedAt', 'status']);
});
test('Retry of saved request ignores consumed token, old date, withdrawn offer and changed privacy version', async () => {
  const repository = new MemoryRepository(); const input = makeOptionInput();
  const first = await receiveInquiry(input, baseDeps(repository));
  const deps = { ...baseDeps(repository), verifyAntiAbuse: async () => { throw new Error('Must not verify twice'); }, loadCatalog: async () => { throw new Error('Must not inspect withdrawn offer'); }, privacyNoticeVersion: 'privacy-v2', now: () => new Date('2027-01-01T00:00:00Z'), rateLimiter: { check: async () => { throw new Error('No new write rate charge'); } } };
  const second = await receiveInquiry({ ...input, antiAbuseToken: 'fresh-or-consumed-token' }, deps);
  assert.equal(second.statusCode, 200); assert.deepEqual(second.receipt, first.receipt); assert.equal(repository.creates, 1);
});
test('Same request ID with different contact or message never overwrites original', async () => {
  const repository = new MemoryRepository(); await receiveInquiry(makeInput(), baseDeps(repository));
  await assert.rejects(() => receiveInquiry(makeInput({ message: 'New content' }), baseDeps(repository)), error => error.code === 'request_id_conflict' && error.status === 409);
  assert.equal(repository.creates, 1);
});
test('Lost GitHub response after commit is recovered from source of truth', async () => {
  const repository = new MemoryRepository(); repository.failAfterCreate = true;
  const result = await receiveInquiry(makeInput(), baseDeps(repository));
  assert.equal(result.statusCode, 200); assert.equal(repository.creates, 1); assert.equal(result.receipt.status, 'received');
});
test('Failed persistence, quota, invalid stored data and public repositories cannot produce success', async () => {
  const repository = new MemoryRepository(); repository.create = async () => { throw new Error('Upstream token expired'); };
  await assert.rejects(() => receiveInquiry(makeInput(), baseDeps(repository)), error => error.code === 'receipt_unconfirmed');
  const publicRepository = new MemoryRepository(); publicRepository.private = false;
  await assert.rejects(() => receiveInquiry(makeInput(), baseDeps(publicRepository))); assert.equal(publicRepository.reads, 0); assert.equal(publicRepository.creates, 0);
  const corruptRepository = new MemoryRepository(); corruptRepository.records.set(inboxPath(ID), { schemaVersion: 1 });
  await assert.rejects(() => receiveInquiry(makeInput(), baseDeps(corruptRepository))); assert.equal(corruptRepository.creates, 0);
});
test('Explicit mutex prevents duplicate writes in concurrent same-ID requests and preserves different inquiries', async () => {
  const repository = new MemoryRepository(), writer = new SerialWriter();
  const results = await Promise.all(Array.from({ length: 8 }, () => writer.run(() => receiveInquiry(makeInput(), baseDeps(repository)))));
  assert.equal(results.filter(result => result.statusCode === 201).length, 1); assert.equal(repository.creates, 1);
  await writer.run(() => receiveInquiry(makeInput({ requestId: OTHER_ID }), baseDeps(repository)));
  assert.equal(repository.creates, 2); assert.equal(repository.records.size, 2);
});
test('Offer changes cause review and preserve original submitted values; price always comes from server', async () => {
  const repository = new MemoryRepository();
  await assert.rejects(() => receiveInquiry(makeOptionInput({ option: { id: 'selection', revision: 1, quantity: 1 } }), baseDeps(repository)), error => error.code === 'offer_updated');
  await receiveInquiry(makeOptionInput(), baseDeps(repository));
  const record = repository.records.get(inboxPath(ID)); assert.equal(record.offerSnapshot.priceCents, 4000); assert.equal(record.offerSnapshot.quantity, 2); assert.equal(record.offerSnapshot.occasion, 'descubrir'); assert.equal(record.input.occasion, undefined);
  const unavailable = new MemoryRepository();
  await assert.rejects(() => receiveInquiry(makeOptionInput(), { ...baseDeps(unavailable), loadCatalog: async () => ({ ...catalog, options: [{ ...catalog.options[0], availability: 'temporarily_unavailable' }] }) }), error => error.code === 'option_unavailable'); assert.equal(unavailable.creates, 0);
});
test('Server does not accept unapproved variant or unknown catalog page', async () => {
  const repository = new MemoryRepository();
  await assert.rejects(() => receiveInquiry(makeOptionInput(), { ...baseDeps(repository), loadCatalog: async () => ({ ...catalog, products: [] }) }), error => error.code === 'configuration_unavailable');
  await assert.rejects(() => receiveInquiry(makeInput({ kind: 'catalog_page', catalog: { version: 'document-v1', page: 15 } }), baseDeps(repository)), error => error.code === 'catalog_updated');
});
test('Bot-token failure and honeypot never write; attention rule is received-time immutable snapshot', async () => {
  const repository = new MemoryRepository();
  await assert.rejects(() => receiveInquiry(makeInput({ website: 'spam.example' }), baseDeps(repository)), error => error.code === 'anti_abuse_failed');
  await assert.rejects(() => receiveInquiry(makeInput(), { ...baseDeps(repository), verifyAntiAbuse: async () => false }), error => error.code === 'anti_abuse_failed');
  assert.equal(repository.creates, 0);
  const attentionRule = { version: 'rule-v1', responsible: 'Ana', timezone: 'America/Lima', responseHours: 24, workDays: [1, 2, 3, 4, 5], workStart: '09:00', workEnd: '18:00' };
  await receiveInquiry(makeInput(), { ...baseDeps(repository), attentionRule }); attentionRule.responsible = 'Mabel';
  assert.equal(repository.records.get(inboxPath(ID)).attentionRule.responsible, 'Ana');
});
test('Per-source/global limits survive shared storage and reset at configured bucket boundary', async () => {
  const storage = new MemoryRateStorage(), limiter = new StoredRateLimiter(storage, { perSource: 2, global: 3, windowSeconds: 60 });
  await limiter.check('a', 1000); await limiter.check('a', 2000);
  await assert.rejects(() => limiter.check('a', 3000), error => error instanceof ReceiverError && error.status === 429 && error.retryAfter === 57);
  await limiter.check('b', 4000);
  await assert.rejects(() => new StoredRateLimiter(storage, { perSource: 2, global: 3, windowSeconds: 60 }).check('c', 5000), error => error.code === 'rate_limited');
  await limiter.check('a', 60000);
});
test('Desired dates use Lima local day and do not promise same-day acceptance', async () => {
  assert.equal(limaDate(new Date('2026-09-30T01:00:00Z')), '2026-09-29');
  const repository = new MemoryRepository();
  await receiveInquiry(makeInput({ requestedDate: '2026-09-29' }), baseDeps(repository));
  await assert.rejects(() => receiveInquiry(makeInput({ requestId: OTHER_ID, requestedDate: '2026-09-28' }), baseDeps(repository)), error => error.field === 'requestedDate');
});
test('GitHub conflict uses bounded retries and re-reading, never uncontrolled rewrites', async () => {
  const repository = new MemoryRepository(); let attempts = 0;
  const create = repository.create.bind(repository);
  repository.create = async (path, record) => { attempts++; if (attempts < 3) { const error = new Error('409 branch race'); error.upstreamStatus = 409; throw error; } return create(path, record); };
  await receiveInquiry(makeInput(), baseDeps(repository)); assert.equal(attempts, 3); assert.equal(repository.records.size, 1);
});
