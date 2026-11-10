import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
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

describe('AC4-11 账本 append-only', () => {
  test('连续追加、单写者、head 更新与 .bak 保留', async () => {
    const root = await createTempProject();
    try {
      const worldDir = path.join(root, 'world');
      await fs.mkdir(worldDir, { recursive: true });
      const ledgerPath = path.join(worldDir, 'ledger.ndjson');
      const headPath = path.join(worldDir, 'ledger.head.json');
      const io = new NdjsonLedgerFile(ledgerPath, headPath);
      const store = new LedgerStore(io);
      const reader = new LedgerReader(io);

      for (let index = 1; index <= 3; index += 1) {
        await appendNarrativeEvent(store, makeEvent(String(index)));
      }

      const result = await reader.readAll();
      if (!result.ok) assert.fail(result.diagnostic);
      assert.equal(result.events.length, 3);
      assert.deepEqual(result.events.map((event) => event.eventId), ['1', '2', '3']);

      const head = await io.readHead();
      assert.ok(head);
      assert.equal(head.eventCount, 3);
      assert.equal(head.lastEventId, '3');

      assert.equal(typeof (store as unknown as { update?: unknown }).update, 'undefined');
      assert.equal('delete' in store, false);

      await appendNarrativeEvent(store, makeEvent('4'));
      const head4 = await io.readHead();
      assert.ok(head4);
      assert.equal(head4.eventCount, 4);
      assert.equal(head4.lastEventId, '4');

      const bak = JSON.parse(await fs.readFile(headPath + '.bak', 'utf8')) as { eventCount: number };
      assert.equal(bak.eventCount, 3);

      const result4 = await reader.readAll();
      if (!result4.ok) assert.fail(result4.diagnostic);
      assert.equal(result4.events.length, 4);
    } finally {
      await cleanupTempProject(root);
    }
  });
});
