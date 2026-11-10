import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LedgerReader, LedgerStore } from '../../core/ledger/store';
import type { LedgerCheckpoint } from '../../core/ledger/store';
import { parseChartSourceData } from '../../core/editor/ChartSourceData';
import { parseTracesSidecar, parseTriggersSidecar } from '../../app/src/game/stageData';

function checkpoint(overrides: Partial<LedgerCheckpoint> = {}): LedgerCheckpoint {
  return {
    schemaVersion: 1,
    eventCount: 0,
    lastEventId: null,
    positionSum: new Array(20).fill(0) as unknown as LedgerCheckpoint['positionSum'],
    checksum: '',
    ...overrides,
  };
}

const hash = (text: string): string => text;

describe('R4f fault boundaries', () => {
  test('ledger head missing/malformed/checksum mismatch → ok=false 诊断，不重建', async () => {
    const head = checkpoint({ eventCount: 1, checksum: 'expected' });
    const reader = new LedgerReader({
      readHead: async () => head,
      readLines: async () => [],
      hash,
    });
    const mismatch = await reader.readAll();
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.match(mismatch.diagnostic, /disagree/);

    const missingHead = new LedgerReader({
      readHead: async () => null,
      readLines: async () => ['{"eventId":"x"}'],
      hash,
    });
    const missing = await missingHead.readAll();
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.match(missing.diagnostic, /missing/);

    const malformed = new LedgerReader({
      readHead: async () => ({ schemaVersion: 99 } as unknown as LedgerCheckpoint),
      readLines: async () => [],
      hash,
    });
    const malformedResult = await malformed.readAll();
    assert.equal(malformedResult.ok, false);
  });

  test('篡改账本 head 后 append 被拒绝，不追加任何行', async () => {
    let appends = 0;
    const store = new LedgerStore({
      readHead: async () => checkpoint({ eventCount: 2, checksum: 'bad' }),
      readLines: async () => [],
      appendLine: async () => { appends += 1; },
      writeHead: async () => undefined,
      hash,
    });
    const event = {
      eventId: 'e1',
      chartRef: 'chart-w1',
      vectorSchemaVersion: 1,
      vector: new Array(20).fill(0),
      appendedAt: { epochMs: 1 },
    } as never;
    await assert.rejects(() => store.append(event));
    assert.equal(appends, 0);
  });

  test('chart sidecar 坏 JSON / 错 chartId / 重复 id 只降级 warnings', () => {
    const badJson = parseTracesSidecar({ schemaVersion: 2, chartId: 'chart-w1', entries: 'no' }, 'chart-w1');
    assert.equal(badJson.items.length, 0);
    assert.ok(badJson.warnings.length > 0);

    const wrongChart = parseTracesSidecar({
      schemaVersion: 2,
      chartId: 'other',
      entries: [],
    }, 'chart-w1');
    assert.equal(wrongChart.items.length, 0);
    assert.ok(wrongChart.warnings.length > 0);

    const duplicate = parseTracesSidecar({
      schemaVersion: 2,
      chartId: 'chart-w1',
      entries: [
        { traceId: 't1' },
        { traceId: 't1' },
      ],
    }, 'chart-w1');
    assert.equal(duplicate.items.length, 0);
    assert.ok(duplicate.warnings.length > 0);
  });

  test('triggers sidecar 坏结构只降级，不抛出', () => {
    const result = parseTriggersSidecar({ schemaVersion: 2, chartId: 'chart-w1', entries: null }, 'chart-w1');
    assert.equal(result.items.length, 0);
    assert.ok(result.warnings.length > 0);
  });

  test('sidecar 失败不影响主谱面数据解析', () => {
    const chart = parseChartSourceData({
      schemaVersion: 2,
      chartId: 'chart-w1',
      provenance: 'Mock',
      layers: [
        { index: 1, kind: 'TopMost' },
        { index: 2, kind: 'Grid' },
      ],
      notes: [
        { timeMs: 0, durationMs: 0, chartLayerIndex: 1, chartPadKind: 'TopMost' },
        { timeMs: 1600, durationMs: 0, chartLayerIndex: 2, gridCellId: 2, chartPadKind: 'Light' },
      ],
    });
    assert.equal(chart.notes.length, 2);
    const sidecar = parseTracesSidecar({ bad: true }, chart.chartId);
    assert.equal(sidecar.items.length, 0);
    assert.equal(chart.notes[1]?.timeMs, 1600);
  });
});
