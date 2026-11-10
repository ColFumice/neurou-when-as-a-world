import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crossedDownbeats,
  downbeatDisplay,
} from '../../app/src/game/downbeatHud';
import {
  readBeatsSidecar,
  type BeatsSidecar,
  type BeatsSidecarIo,
} from '../../app/src/audio/beatsSidecar';

class FakeIo implements BeatsSidecarIo {
  files = new Map<string, unknown>();

  async openProjectRoot(): Promise<void> {}
  async readProjectFile(relPath: string): Promise<unknown | null> {
    return this.files.get(relPath) ?? null;
  }
  async writeProjectFile(relPath: string, data: unknown): Promise<void> {
    this.files.set(relPath, data);
  }
}

function valid(): BeatsSidecar {
  return {
    schemaVersion: 1,
    chartId: 'chart-w1',
    audioAssetId: 'asset:audio:main',
    audioSha256: 'a'.repeat(64),
    analyzer: 'offline-onset-autocorrelation-v1',
    bpm: 120,
    meter: 4,
    offsetMs: 0,
    beatsMs: [0, 500, 1000, 2000],
    downbeatsMs: [0, 2000],
    confidence: 0.9,
    source: 'Detected',
    generatedAt: '2026-10-25T00:00:00.000Z',
  };
}

describe('R5a.3 HUD downbeat', () => {
  test('valid beats enables BPM/meter display', () => {
    assert.deepEqual(downbeatDisplay(valid()), { bpm: 120, meter: 4 });
  });

  test('crossed downbeat triggers only when playhead passes it', () => {
    assert.deepEqual(crossedDownbeats([0, 2000, 4000], -1, 0), [0]);
    assert.deepEqual(crossedDownbeats([0, 2000, 4000], 1000, 2100), [2000]);
    assert.deepEqual(crossedDownbeats([0, 2000, 4000], 2000, 4000), [4000]);
    assert.deepEqual(crossedDownbeats([0, 2000, 4000], 4100, 200), []);
  });

  test('missing sidecar does not enable display', async () => {
    const io = new FakeIo();
    const result = await readBeatsSidecar('/project', 'chart-w1', { io });
    assert.equal(result.sidecar, null);
    assert.equal(downbeatDisplay(result.sidecar), null);
  });

  test('stale audioSha256 does not enable display', async () => {
    const io = new FakeIo();
    io.files.set('charts/chart-w1.beats.json', valid());
    io.files.set('media/manifest.json', {
      assets: [{ assetId: 'asset:audio:main', sha256: 'b'.repeat(64) }],
    });
    const result = await readBeatsSidecar('/project', 'chart-w1', { io });
    assert.equal(result.sidecar, null);
    assert.equal(downbeatDisplay(result.sidecar), null);
  });
});
