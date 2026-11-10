import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { NdjsonLedgerFile } from '../../adapters/node/NdjsonLedgerFile';
import { ChartPremiere } from '../../core/chart/ChartPremiere';
import { ChartPremiereDirector } from '../../core/director/ChartPremiereDirector';
import { LedgerReader, LedgerStore } from '../../core/ledger/store';
import {
  isValidWorldId,
  worldLedgerPaths,
} from '../../app/src/game/narrative/ledgerPaths';
import { cleanupTempProject, createTempProject } from '../helpers/temp-dir';

type PremiereInput = ConstructorParameters<typeof ChartPremiere>[0];

function makePremiere(chartId = 'chart-w1'): ChartPremiere {
  const input: PremiereInput = {
    chartId,
    source: 'editor',
    completed: true,
    totalNotes: 10,
    perfect: 10,
    good: 0,
    miss: 0,
    maxCombo: 10,
  };
  return new ChartPremiere(input);
}

describe('R4d.4 真实项目账本路径', () => {
  test('worlds/<worldId>/ledger.ndjson + head', () => {
    assert.deepEqual(worldLedgerPaths('w1'), {
      ledgerPath: 'worlds/w1/ledger.ndjson',
      headPath: 'worlds/w1/ledger.head.json',
    });
  });

  test('非法 worldId 拒绝', () => {
    for (const worldId of ['', '.', '..', '../w1', 'w1/../x', 'w1\\x', 'w 1', 'w1:']) {
      assert.equal(isValidWorldId(worldId), false, worldId);
      assert.throws(() => worldLedgerPaths(worldId), RangeError, worldId);
    }
  });

  test('真实相对路径写入、重开识别首演', async () => {
    const root = await createTempProject();
    try {
      const paths = worldLedgerPaths('w1');
      const ledgerPath = path.join(root, paths.ledgerPath);
      const headPath = path.join(root, paths.headPath);
      await fs.mkdir(path.dirname(ledgerPath), { recursive: true });

      const io = new NdjsonLedgerFile(ledgerPath, headPath);
      const store = new LedgerStore(io);
      const reader = new LedgerReader(io);
      const director = new ChartPremiereDirector(store, reader);

      const checkpoint = await director.recordPremiere(makePremiere(), 1234);
      assert.ok(checkpoint);
      assert.equal(checkpoint.eventCount, 1);
      assert.equal((await fs.stat(ledgerPath)).isFile(), true);
      assert.equal((await fs.stat(headPath)).isFile(), true);

      const reopenedIo = new NdjsonLedgerFile(ledgerPath, headPath);
      const reopenedReader = new LedgerReader(reopenedIo);
      const reopenedStore = new LedgerStore(reopenedIo);
      const reopened = new ChartPremiereDirector(reopenedStore, reopenedReader);
      assert.equal(await reopened.recordPremiere(makePremiere(), 2000), null);

      const read = await reopenedReader.readAll();
      if (!read.ok) assert.fail(read.diagnostic);
      assert.equal(read.events.length, 1);
      assert.equal(read.events[0]?.chartRef, 'chart-w1');
    } finally {
      await cleanupTempProject(root);
    }
  });

  test('head 损坏 → 只读诊断、不追加、不抛异常、文件不变', async () => {
    const root = await createTempProject();
    try {
      const paths = worldLedgerPaths('w1');
      const ledgerPath = path.join(root, paths.ledgerPath);
      const headPath = path.join(root, paths.headPath);
      await fs.mkdir(path.dirname(ledgerPath), { recursive: true });

      const io = new NdjsonLedgerFile(ledgerPath, headPath);
      const store = new LedgerStore(io);
      const reader = new LedgerReader(io);
      const director = new ChartPremiereDirector(store, reader);
      assert.ok(await director.recordPremiere(makePremiere(), 1234));

      const head = JSON.parse(await fs.readFile(headPath, 'utf8')) as { checksum: string };
      head.checksum = '0'.repeat(64);
      await fs.writeFile(headPath, JSON.stringify(head, null, 2), 'utf8');

      const ledgerBefore = await fs.readFile(ledgerPath);
      const headBefore = await fs.readFile(headPath);
      await assert.doesNotReject(async () => {
        assert.equal(await director.recordPremiere(makePremiere('chart-w2'), 2000), null);
      });
      assert.match(director.lastDiagnostic ?? '', /read-only|checksum/);
      assert.deepEqual(await fs.readFile(ledgerPath), ledgerBefore);
      assert.deepEqual(await fs.readFile(headPath), headBefore);

      const read = await reader.readAll();
      assert.equal(read.ok, false);
    } finally {
      await cleanupTempProject(root);
    }
  });
});
