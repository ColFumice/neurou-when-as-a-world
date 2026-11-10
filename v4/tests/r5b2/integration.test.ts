import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  beatGrid,
  manualSidecar,
} from '../../app/src/editor/beatsPanelModel';
import type { BeatAudioAsset } from '../../app/src/editor/beatsPanelModel';
import { ClockDriftMonitor } from '../../app/src/game/clockDrift';

const asset: BeatAudioAsset = {
  assetId: 'theme-audio',
  relPath: 'media/audio/theme.wav',
  sha256: 'b'.repeat(64),
  durationMs: 72_000,
};

describe('R5b.2 manual grid / clock debug', () => {
  test('Manual 90 BPM sidecar has Manual/confidence 1 and 72s grid', () => {
    const sidecar = manualSidecar('chart-w1', asset, [], '2026-10-25T00:00:00.000Z', {
      bpm: 90,
      offsetMs: 0,
    });
    assert.ok(sidecar);
    assert.equal(sidecar.source, 'Manual');
    assert.equal(sidecar.confidence, 1);
    assert.equal(sidecar.bpm, 90);
    assert.equal(sidecar.offsetMs, 0);
    assert.equal(sidecar.beatsMs.length, 109);
    assert.equal(sidecar.downbeatsMs.length, 28);
    assert.equal(sidecar.beatsMs[0], 0);
    assert.equal(sidecar.beatsMs[sidecar.beatsMs.length - 1], 72_000);
  });

  test('Manual offset normalizes into [0, period)', () => {
    const grid = beatGrid(90, 100, 72_000);
    assert.ok(grid);
    assert.equal(grid.offsetMs, 100);
    assert.equal(grid.beatsMs[0], 100);
    assert.equal(grid.downbeatsMs[0], 100);
    const wrapped = beatGrid(90, 766.667, 72_000);
    assert.ok(wrapped);
    assert.ok(wrapped.offsetMs < 666.667);
  });

  test('Manual BPM outside 60..200 is rejected', () => {
    assert.equal(beatGrid(59, 0, 72_000), null);
    assert.equal(beatGrid(201, 0, 72_000), null);
    assert.equal(manualSidecar('chart-w1', asset, [], 'x', { bpm: 59, offsetMs: 0 }), null);
  });

  test('CLOCK DEBUG ring keeps 600 samples and exports telemetry', () => {
    const monitor = new ClockDriftMonitor();
    monitor.start(0, 0);
    for (let index = 0; index < 605; index += 1) {
      monitor.sample(index * 500, index * 500, {
        contextTime: index * 0.5,
        timestampPerformanceTime: index * 500,
        timestampContextTime: index * 0.5,
        baseLatency: 0.01,
        outputLatency: 0.02,
        contextState: 'running',
        audioReadyState: 4,
        visibilityState: 'visible',
        reanchorCount: 0,
        source: 'timestamp',
      });
    }
    const exported = monitor.exportDebug();
    assert.equal(exported.capacity, 600);
    assert.equal(exported.count, 600);
    assert.equal(exported.samples.length, 600);
    assert.equal(exported.samples[0]?.seq, 5);
    assert.equal(exported.samples[599]?.seq, 604);
    const last = exported.samples[599];
    assert.equal(last?.driftMs, 0);
    assert.equal(last?.telemetry.source, 'timestamp');
    assert.equal(last?.telemetry.contextState, 'running');
    assert.equal(last?.telemetry.audioReadyState, 4);
    assert.equal(last?.telemetry.visibilityState, 'visible');
    monitor.clearDebug();
    assert.equal(monitor.exportDebug().count, 0);
  });
});
