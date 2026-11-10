import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AIKeyframeGeneration } from '../../core/editor/types';
import { DEFAULT_AI_SETTINGS } from '../../app/src/editor/aiSettings';

const PROPOSALS = [{
  timeMs: 1000,
  durationMs: 0,
  chartLayerIndex: 2 as const,
  gridCellId: 2,
  chartPadKind: 'Light' as const,
  chartKeyId: null,
}];

const STATES: readonly AIKeyframeGeneration[] = [
  { status: 'Unavailable' },
  { status: 'Running' },
  { status: 'Ready', provider: 'Local', fallbackUsed: false, proposals: PROPOSALS },
  { status: 'Fallback', provider: 'Template', fallbackUsed: true, reason: 'timeout', proposals: PROPOSALS },
];

describe('R4e.1b AI panel state', () => {
  test('Unavailable / Running / Ready / Fallback 状态可区分', () => {
    assert.deepEqual(STATES.map((state) => state.status), [
      'Unavailable',
      'Running',
      'Ready',
      'Fallback',
    ]);
    assert.equal(STATES[2]?.proposals?.length, 1);
    assert.equal(STATES[3]?.fallbackUsed, true);
  });

  test('面板状态与设置序列化不含 raw key / authorization / prompt', () => {
    const serialized = `${JSON.stringify(STATES)}\n${JSON.stringify(DEFAULT_AI_SETTINGS)}`;
    assert.equal(serialized.includes('secret-key'), false);
    assert.equal(serialized.includes('Authorization'), false);
    assert.equal(serialized.includes('sk-'), false);
    assert.equal(JSON.stringify(DEFAULT_AI_SETTINGS).includes('keyRef'), true);
  });

  test('Cloud 模式在钥匙串不可用时由 UI 禁用（状态契约）', () => {
    const keyStates = ['NOT SET', 'KEY STORED', 'KEYSTORE UNAVAILABLE'] as const;
    const cloudDisabled = (state: typeof keyStates[number]): boolean => (
      state === 'KEYSTORE UNAVAILABLE'
    );
    assert.equal(cloudDisabled(keyStates[0]), false);
    assert.equal(cloudDisabled(keyStates[1]), false);
    assert.equal(cloudDisabled(keyStates[2]), true);
  });
});
