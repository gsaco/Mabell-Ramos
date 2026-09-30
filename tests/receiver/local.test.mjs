import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createLocalReceiver } from '../../services/inquiry-receiver/local-server.mjs';
import { inboxPath } from '../../services/inquiry-receiver/src/contract.mjs';
import { ID, catalog, makeInput } from './fixtures.mjs';

test('Real local HTTP receipts persist privately and survive receiver restart without duplicates', async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'mabell-receiver-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const catalogPath = path.join(temp, 'catalog.json'); await writeFile(catalogPath, JSON.stringify(catalog));
  const options = { directory: path.join(temp, 'private-data'), catalogPath, privacyNoticeVersion: 'privacy-v1', origins: ['http://127.0.0.1:4173'], now: () => new Date('2026-09-29T18:00:00Z') };
  const start = async () => { const server = createLocalReceiver(options); server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server; };
  let server = await start();
  t.after(() => server.close());
  const post = () => fetch(`http://127.0.0.1:${server.address().port}/v1/consultas`, { method: 'POST', headers: { Origin: 'http://127.0.0.1:4173', 'Content-Type': 'application/json' }, body: JSON.stringify(makeInput({ antiAbuseToken: 'local-development-only' })) });
  const first = await post(); assert.equal(first.status, 201); const receipt = await first.json();
  const file = path.join(options.directory, inboxPath(ID)); const record = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(record.input.contact.name, 'María Ana Joya'); assert.equal(record.receiptId, receipt.receiptId); assert.equal((await stat(file)).mode & 0o777, 0o600);
  await new Promise(resolve => server.close(resolve)); server = await start();
  const repeated = await post(); assert.equal(repeated.status, 200); assert.deepEqual(await repeated.json(), receipt);
  const publicRead = await fetch(`http://127.0.0.1:${server.address().port}/v1/consultas/${ID}`); assert.equal(publicRead.status, 404);
  const nonLocal = await fetch(`http://127.0.0.1:${server.address().port}/v1/consultas`, { method: 'POST', headers: { Origin: 'https://gsaco.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(makeInput()) }); assert.equal(nonLocal.status, 403);
});
test('Local preview refuses internet origins and storage inside public docs', async () => {
  assert.throws(() => createLocalReceiver({ catalogPath: '/tmp/catalog.json', origins: ['https://gsaco.github.io'] }));
});
