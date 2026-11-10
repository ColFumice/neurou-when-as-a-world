import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { BeatAnalysisResult } from '../../app/src/audio/beatAnalyzer';
import { analyzeBeats } from '../../app/src/audio/beatAnalyzer';
import {
  detectedSidecar,
  failedView,
  lowConfidenceView,
  manualBpm,
  manualSidecar,
  viewFromSidecar,
} from '../../app/src/editor/beatsPanelModel';
import type { BeatAudioAsset } from '../../app/src/editor/beatsPanelModel';

const asset: BeatAudioAsset = {
  assetId: 'asset:audio:main',
  relPath: 'media/stereo/x/audio.wav',
  sha256: 'a'.repeat(64),
  durationMs: 8000,
};

const detected: BeatAnalysisResult = {
  ok: true,
  bpm: 120,
  meter: 4,
  offsetMs: 0,
  beatsMs: [0, 500, 1000, 1500, 2000],
  downbeatsMs: [0, 2000],
  confidence: 0.92,
};

describe('R5a.3 editor beats UI model', () => {
  test('Analyze success generates Detected sidecar + Ready view', () => {
    const sidecar = detectedSidecar('chart-w1', asset, detected, '2026-10-25T00:00:00.000Z');
    assert.ok(sidecar);
    assert.equal(sidecar.source, 'Detected');
    assert.equal(sidecar.bpm, 120);
    assert.deepEqual(viewFromSidecar(sidecar), {
      status: 'Ready',
      bpm: 120,
      meter: 4,
      confidence: 0.92,
      source: 'Detected',
      reason: null,
      taps: 0,
    });
  });

  test('silent / low confidence maps to Failed or LowConfidence', () => {
    const silent = analyzeBeats(new Float32Array(48000 * 5), 48000);
    assert.equal(silent.ok, false);
    assert.equal(silent.reason, 'Silent');
    assert.equal(failedView(silent.reason ?? 'Failed').status, 'Failed');
    assert.equal(failedView(silent.reason ?? 'Failed').reason, 'Silent');
    assert.equal(lowConfidenceView('NoBeat', 0.1).status, 'LowConfidence');
    assert.equal(lowConfidenceView('NoBeat', 0.1).confidence, 0.1);
  });

  test('Manual Tap computes BPM and Manual sidecar', () => {
    const taps = [1200, 1700, 2200, 2700];
    assert.equal(manualBpm(taps), 120);
    const sidecar = manualSidecar('chart-w1', asset, taps, '2026-10-25T00:00:00.000Z');
    assert.ok(sidecar);
    assert.equal(sidecar.source, 'Manual');
    assert.equal(sidecar.bpm, 120);
    assert.deepEqual(sidecar.downbeatsMs, [0, 2000, 4000, 6000, 8000]);
  });

  test('Manual Tap insufficient / out of range is null', () => {
    assert.equal(manualBpm([0, 500]), null);
    assert.equal(manualBpm([0, 100, 200, 300]), null); // 600 BPM
    assert.equal(manualSidecar('chart-w1', asset, [0, 100, 200], 'x'), null);
  });
});
