import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { NdjsonLedgerFile } from '../adapters/node/NdjsonLedgerFile';
import { LedgerReader, LedgerStore, appendNarrativeEvent } from '../core/ledger/store';
import type { NarrativeDimension, NarrativeEvent } from '../core/ledger/types';
import { createTempProject, cleanupTempProject } from './helpers/temp-dir';

function makeVector(): NarrativeDimension {
  return new Array<number>(20).fill(0) as unknown as NarrativeDimension;
}

function makeEvent(eventId: string): NarrativeEvent {
  return {
    eventId,
    vector: makeVector(),
    vectorSchemaVersion: 1,
    appendedAt: { epochMs: 1000 },
    chartRef: null,
  };
}

async function hashFile(file: string): Promise<string> {
  const data = await fs.readFile(file);
  return createHash('sha256').update(data).digest('hex');
}

describe('AC4-12 账本损坏诊断', () => {
  test('head/末行/checksum 三种篡改均只读拒绝，不截断不重建', async () => {
    const root = await createTempProject();
    try {
      const worldDir = path.join(root, 'world');
      await fs.mkdir(worldDir, { recursive: true });
      const ledgerPath = path.join(worldDir, 'ledger.ndjson');
      const headPath = path.join(worldDir, 'ledger.head.json');
      const io = new NdjsonLedgerFile(ledgerPath, headPath);
      const store = new LedgerStore(io);
      const reader = new LedgerReader(io);

      await appendNarrativeEvent(store, makeEvent('a'));
      await appendNarrativeEvent(store, makeEvent('b'));

      const headText = await fs.readFile(headPath, 'utf8');
      const ledgerText = await fs.readFile(ledgerPath, 'utf8');

      // 1. head eventCount 篡改
      const head1 = JSON.parse(headText) as { eventCount: number };
      head1.eventCount = 999;
      await fs.writeFile(headPath, JSON.stringify(head1, null, 2), 'utf8');
      const hash1 = await hashFile(ledgerPath);
      const result1 = await reader.readAll();
      assert.equal(result1.ok, false);
      if (!result1.ok) assert.match(result1.diagnostic, /head and last line disagree/);
      assert.equal(await hashFile(ledgerPath), hash1);
      await fs.writeFile(headPath, headText, 'utf8');

      // 2. ledger 末行删除
      const lines = ledgerText.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      lines.pop();
      await fs.writeFile(ledgerPath, lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf8');
      const hash2 = await hashFile(ledgerPath);
      const result2 = await reader.readAll();
      assert.equal(result2.ok, false);
      if (!result2.ok) assert.match(result2.diagnostic, /head and last line disagree/);
      assert.equal(await hashFile(ledgerPath), hash2);
      await fs.writeFile(ledgerPath, ledgerText, 'utf8');

      // 3. checksum 篡改
      const head3 = JSON.parse(headText) as { checksum: string };
      head3.checksum = '0'.repeat(64);
      await fs.writeFile(headPath, JSON.stringify(head3, null, 2), 'utf8');
      const hash3 = await hashFile(ledgerPath);
      const result3 = await reader.readAll();
      assert.equal(result3.ok, false);
      if (!result3.ok) assert.match(result3.diagnostic, /checksum/);
      assert.equal(await hashFile(ledgerPath), hash3);
    } finally {
      await cleanupTempProject(root);
    }
  });
});
