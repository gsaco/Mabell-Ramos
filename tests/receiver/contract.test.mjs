import test from 'node:test';
import assert from 'node:assert/strict';
import { hashLogicalInput, validatePublicInquiryInput, ContractError, inboxPath, verifyStoredPublicInquiry, canonicalJSON } from '../../services/inquiry-receiver/src/contract.mjs';
import { receiveInquiry } from '../../services/inquiry-receiver/src/core.mjs';
import { makeInput, baseDeps, MemoryRepository, ID } from './fixtures.mjs';

test('Unicode names, accents and international WhatsApp are preserved and normalized', () => {
  const value = validatePublicInquiryInput(makeInput({ contact: { name: ' Jose\u0301 Saco Alvarado ', method: 'whatsapp', value: '+51 (987) 654-321' } }));
  assert.equal(value.contact.name, 'José Saco Alvarado'); assert.equal(value.contact.value, '+51987654321'); assert.match(value.message, /ají/);
});
test('Rejects unknown fields and attempted operational injection at every boundary', () => {
  for (const patch of [{ total: 1 }, { responsible: 'Ana' }, { confirmedAt: 'now' }, { marketingConsent: true }, { path: 'data/state.json' }, { contact: { name: 'Ana', method: 'email', value: 'ana@example.test', secret: true } }, { source: { page: '/productos/', url: 'https://attacker.test/?phone=123' } }]) assert.throws(() => validatePublicInquiryInput(makeInput(patch)), ContractError);
});
test('Contract rejects impossible dates, injection routes, ambiguous kind fields and invalid numeric input', () => {
  for (const patch of [{ requestedDate: '2026-99-99' }, { requestedDate: '2026-02-30' }, { source: { page: '/productos/?email=a' } }, { kind: 'product_general', event: { scope: 'food_only', attendees: 1, time: null, interests: [] } }, { kind: 'product_option', option: { id: '../private', revision: 1, quantity: 1 } }, { kind: 'event', event: { scope: 'food_only', attendees: 0, time: null, interests: [] } }, { message: 'x'.repeat(501) }, { contact: { name: 'Ana', method: 'whatsapp', value: '987654321' } }]) assert.throws(() => validatePublicInquiryInput(makeInput(patch)), ContractError);
});
test('Nullable event details and field order have canonical logical meaning', async () => {
  const input = makeInput({ kind: 'event', requestedDate: null, district: null, event: { scope: 'unsure', attendees: null, time: null, interests: ['drinks', 'sweet'] } });
  const differentToken = { ...input, antiAbuseToken: 'replacement-token', event: { ...input.event, interests: ['sweet', 'drinks'] } };
  assert.equal(await hashLogicalInput(input), await hashLogicalInput(differentToken));
  assert.equal(canonicalJSON({ b: 2, a: 1 }), canonicalJSON({ a: 1, b: 2 }));
});
test('Stored envelope verification detects tampering and never accepts bot token or extra fields', async () => {
  const repository = new MemoryRepository(); await receiveInquiry(makeInput(), baseDeps(repository));
  const record = repository.records.get(inboxPath(ID));
  assert.ok(!Object.hasOwn(record.input, 'antiAbuseToken')); assert.ok(!Object.hasOwn(record.input, 'website'));
  const valid = await verifyStoredPublicInquiry(record); assert.equal(valid.input.contact.name, 'María Ana Joya');
  await assert.rejects(() => verifyStoredPublicInquiry({ ...record, input: { ...record.input, message: 'Changed without integrity update' } }), ContractError);
  await assert.rejects(() => verifyStoredPublicInquiry({ ...record, receiptId: 'MR-FAKE' }), ContractError);
  await assert.rejects(() => verifyStoredPublicInquiry({ ...record, input: { ...record.input, antiAbuseToken: 'should-never-be-stored' } }), ContractError);
});
