import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { NdjsonLedgerFile } from '../../adapters/node/NdjsonLedgerFile';
import { ChartPremiere } from '../../core/chart/ChartPremiere';
import { ChartPremiereDirector } from '../../core/director/ChartPremiereDirector';
import { LedgerReader, LedgerStore } from '../../core/ledger/store';
import { validateNarrativeVector } from '../../core/ledger/vector';
import { cleanupTempProject, createTempProject } from '../helpers/temp-dir';

type PremiereInput = ConstructorParameters<typeof ChartPremiere>[0];

const BASE: PremiereInput = {
  chartId: 'chart-w1',
  source: 'editor',
  completed: true,
  totalNotes: 10,
  perfect: 10,
  good: 0,
  miss: 0,
  maxCombo: 10,
};

function makePremiere(overrides: Partial<PremiereInput> = {}): ChartPremiere {
  return new ChartPremiere({ ...BASE, ...overrides });
}

interface LedgerFixture {
  readonly root: string;
  readonly worldDir: string;
  readonly ledgerPath: string;
  readonly headPath: string;
  readonly io: NdjsonLedgerFile;
  readonly store: LedgerStore;
  readonly reader: LedgerReader;
  readonly director: ChartPremiereDirector;
}

async function setup(): Promise<LedgerFixture> {
  const root = await createTempProject();
  const worldDir = path.join(root, 'worlds', 'w1');
  await fs.mkdir(worldDir, { recursive: true });
  const ledgerPath = path.join(worldDir, 'ledger.ndjson');
  const headPath = path.join(worldDir, 'ledger.head.json');
  const io = new NdjsonLedgerFile(ledgerPath, headPath);
  const store = new LedgerStore(io);
  const reader = new LedgerReader(io);
  return {
    root,
    worldDir,
    ledgerPath,
    headPath,
    io,
    store,
    reader,
    director: new ChartPremiereDirector(store, reader),
  };
}

describe('R4d.2 ChartPremiereDirector 首演账本', () => {
  test('完整首演恰好 +1；重复首演 0；重开读取仍不重复', async () => {
    const fixture = await setup();
    try {
      const first = await fixture.director.recordPremiere(makePremiere(), 1000);
      assert.ok(first);
      assert.equal(first.eventCount, 1);

      const read = await fixture.reader.readAll();
      if (!read.ok) assert.fail(read.diagnostic);
      assert.equal(read.events.length, 1);
      const event = read.events[0];
      assert.equal(event.eventId, 'premiere:chart-w1');
      assert.equal(event.chartRef, 'chart-w1');
      assert.equal(event.vectorSchemaVersion, 1);
      assert.equal(event.appendedAt.epochMs, 1000);
      assert.equal(event.vector.length, 20);
      assert.doesNotThrow(() => validateNarrativeVector(event.vector));

      const repeat = await fixture.director.recordPremiere(makePremiere(), 2000);
      assert.equal(repeat, null);
      const readRepeat = await fixture.reader.readAll();
      if (!readRepeat.ok) assert.fail(readRepeat.diagnostic);
      assert.equal(readRepeat.events.length, 1);

      const reopenedIo = new NdjsonLedgerFile(fixture.ledgerPath, fixture.headPath);
      const reopenedStore = new LedgerStore(reopenedIo);
      const reopenedReader = new LedgerReader(reopenedIo);
      const reopened = new ChartPremiereDirector(reopenedStore, reopenedReader);
      const afterReopen = await reopened.recordPremiere(makePremiere(), 3000);
      assert.equal(afterReopen, null);
      const readReopen = await reopenedReader.readAll();
      if (!readReopen.ok) assert.fail(readReopen.diagnostic);
      assert.equal(readReopen.events.length, 1);
    } finally {
      await cleanupTempProject(fixture.root);
    }
  });

  test('fallback 与未完成首演均不写入账本', async () => {
    const fixture = await setup();
    try {
      const fallback = await fixture.director.recordPremiere(
        makePremiere({ source: 'fallback' }),
        1000,
      );
      assert.equal(fallback, null);
      assert.match(fixture.director.lastDiagnostic ?? '', /fallback/);

      const incomplete = await fixture.director.recordPremiere(
        makePremiere({ completed: false, perfect: 9, maxCombo: 9 }),
        2000,
      );
      assert.equal(incomplete, null);
      assert.match(fixture.director.lastDiagnostic ?? '', /not complete/);

      const read = await fixture.reader.readAll();
      if (!read.ok) assert.fail(read.diagnostic);
      assert.equal(read.events.length, 0);
    } finally {
      await cleanupTempProject(fixture.root);
    }
  });

  test('账本损坏：拒绝写入、不抛异常、不改动任何账本文件', async () => {
    const fixture = await setup();
    try {
      assert.ok(await fixture.director.recordPremiere(makePremiere(), 1000));
      const head = JSON.parse(await fs.readFile(fixture.headPath, 'utf8')) as {
        checksum: string;
      };
      head.checksum = '0'.repeat(64);
      await fs.writeFile(fixture.headPath, JSON.stringify(head, null, 2), 'utf8');

      const ledgerBefore = await fs.readFile(fixture.ledgerPath);
      const headBefore = await fs.readFile(fixture.headPath);

      await assert.doesNotReject(async () => {
        const result = await fixture.director.recordPremiere(
          makePremiere({ chartId: 'chart-w2' }),
          2000,
        );
        assert.equal(result, null);
      });

      assert.match(fixture.director.lastDiagnostic ?? '', /read-only|checksum/);
      assert.deepEqual(await fs.readFile(fixture.ledgerPath), ledgerBefore);
      assert.deepEqual(await fs.readFile(fixture.headPath), headBefore);

      const read = await fixture.reader.readAll();
      assert.equal(read.ok, false);
    } finally {
      await cleanupTempProject(fixture.root);
    }
  });
});
