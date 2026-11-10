import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartPremiere } from '../../core/chart/ChartPremiere';
import { ChartPremiereDirector } from '../../core/director/ChartPremiereDirector';
import { validateNarrativeVector } from '../../core/ledger/vector';
import type { NarrativeDimension } from '../../core/ledger/types';

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

function derive(overrides: Partial<PremiereInput> = {}): NarrativeDimension {
  return ChartPremiereDirector.deriveVector(makePremiere(overrides));
}

describe('R4d.1 ChartPremiereDirector 20 维推导', () => {
  test('全 Perfect：固定 0..100 向量', () => {
    const vector = derive();
    assert.equal(vector.length, 20);
    assert.deepEqual([...vector], [
      0, 45, 0, 0, 70, 0, 20, 40, 0, 60,
      0, 0, 90, 0, 25, 0, 0, 60, 0, 55,
    ]);
    assert.doesNotThrow(() => validateNarrativeVector(vector));
  });

  test('全 Miss：Grey / Residue / Conflict 上升', () => {
    const vector = derive({ perfect: 0, good: 0, miss: 10, maxCombo: 0 });
    assert.deepEqual([...vector], [
      30, 0, 0, 0, 0, 50, 20, 0, 0, 0,
      0, 45, 0, 0, 0, 45, 0, 60, 0, 0,
    ]);
  });

  test('混合判定：Perfect/Good/Miss 与 maxCombo 参与推导', () => {
    const vector = derive({ perfect: 2, good: 1, miss: 1, totalNotes: 4, maxCombo: 3 });
    assert.deepEqual([...vector], [
      8, 36, 0, 0, 38, 13, 20, 25, 0, 37,
      0, 11, 56, 0, 16, 11, 0, 60, 0, 37,
    ]);
  });

  test('空 trace / 空 NEU / 空 trigger 的零值安全', () => {
    const vector = derive({
      tracesTotal: 0,
      tracesRevealed: 0,
      tracesTouched: 0,
      deepRevealed: 0,
      anomalousRevealed: 0,
      rainRevealed: 0,
      frameLost: 0,
      neuAudioModules: 0,
      neuEffectModules: 0,
      neuLightModules: 0,
      neuResourceModules: 0,
      neuSubtitleModules: 0,
      triggerEnter: 0,
      triggerExit: 0,
      triggerDwell: 0,
      triggerOccupancy: 0,
      triggerParallax: 0,
    });
    assert.deepEqual([...vector], [
      0, 45, 0, 0, 70, 0, 20, 40, 0, 60,
      0, 0, 90, 0, 25, 0, 0, 60, 0, 55,
    ]);
  });

  test('Trace：Revealed/Touched/Deep/Anomalous/Rain/FrameLost', () => {
    const vector = derive({
      tracesTotal: 4,
      tracesRevealed: 2,
      tracesTouched: 1,
      deepRevealed: 1,
      anomalousRevealed: 1,
      rainRevealed: 1,
      frameLost: 1,
    });
    assert.deepEqual([...vector], [
      13, 45, 25, 25, 85, 13, 20, 50, 46, 60,
      0, 14, 90, 33, 35, 14, 31, 60, 0, 70,
    ]);
  });

  test('NEU：Audio/Effect/Light/Resource/Subtitle', () => {
    const vector = derive({
      neuAudioModules: 2,
      neuEffectModules: 1,
      neuLightModules: 3,
      neuResourceModules: 1,
      neuSubtitleModules: 2,
    });
    assert.deepEqual([...vector], [
      0, 55, 20, 0, 70, 0, 30, 53, 0, 76,
      16, 0, 94, 14, 45, 0, 0, 68, 22, 61,
    ]);
  });

  test('Trigger：3 种信号与完整完成加成', () => {
    const vector = derive({
      triggerEnter: 1,
      triggerDwell: 1,
      triggerOccupancy: 1,
    });
    assert.deepEqual([...vector], [
      12, 45, 0, 0, 70, 0, 38, 40, 0, 60,
      12, 0, 90, 0, 25, 0, 0, 72, 24, 55,
    ]);
  });

  test('所有样例的每一维都在 0..100 且为有限数', () => {
    const samples = [
      makePremiere(),
      makePremiere({ perfect: 0, good: 0, miss: 10, maxCombo: 0 }),
      makePremiere({ perfect: 2, good: 1, miss: 1, totalNotes: 4, maxCombo: 3 }),
      makePremiere({
        tracesTotal: 4,
        tracesRevealed: 4,
        tracesTouched: 4,
        deepRevealed: 4,
        anomalousRevealed: 4,
        rainRevealed: 4,
        frameLost: 4,
        neuAudioModules: 99,
        neuEffectModules: 99,
        neuLightModules: 99,
        neuResourceModules: 99,
        neuSubtitleModules: 99,
        triggerEnter: 1,
        triggerExit: 1,
        triggerDwell: 1,
        triggerOccupancy: 1,
        triggerParallax: 1,
      }),
    ];
    for (const premiere of samples) {
      const vector = ChartPremiereDirector.deriveVector(premiere);
      assert.equal(vector.length, 20);
      for (const value of vector) {
        assert.ok(Number.isFinite(value));
        assert.ok(value >= 0 && value <= 100);
      }
      assert.doesNotThrow(() => validateNarrativeVector(vector));
    }
  });
});
