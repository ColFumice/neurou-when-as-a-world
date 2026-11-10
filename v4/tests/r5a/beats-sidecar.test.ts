import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  beatsSidecarRelPath,
  parseBeatsSidecar,
  readBeatsSidecar,
  writeBeatsSidecar,
  type BeatsSidecar,
  type BeatsSidecarIo,
} from '../../app/src/audio/beatsSidecar';
import { sha256Hex } from '../../app/src/audio/audioHash';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

class FakeIo implements BeatsSidecarIo {
  readonly files = new Map<string, unknown>();
  opened = '';

  async openProjectRoot(path: string): Promise<void> {
    this.opened = path;
  }

  async readProjectFile(relPath: string): Promise<unknown | null> {
    return this.files.get(relPath) ?? null;
  }

  async writeProjectFile(relPath: string, data: unknown): Promise<void> {
    this.files.set(relPath, data);
  }
}

function sidecar(overrides: Partial<BeatsSidecar> = {}): BeatsSidecar {
  return {
    schemaVersion: 1,
    chartId: 'chart-w1',
    audioAssetId: 'asset:audio:main',
    audioSha256: HASH_A,
    analyzer: 'offline-onset-autocorrelation-v1',
    bpm: 120,
    meter: 4,
    offsetMs: 0,
    beatsMs: [0, 500, 1000, 1500, 2000],
    downbeatsMs: [0, 2000],
    confidence: 0.9,
    source: 'Detected',
    generatedAt: '2026-10-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('R5a.1 beats sidecar', () => {
  test('write/read round-trip', async () => {
    const io = new FakeIo();
    await writeBeatsSidecar('/project', 'chart-w1', sidecar(), io);
    assert.equal(io.opened, '/project');
    assert.ok(io.files.has(beatsSidecarRelPath('chart-w1')));
    const result = await readBeatsSidecar('/project', 'chart-w1', {
      io,
      durationMs: 8000,
      currentAudioSha256: HASH_A,
    });
    assert.equal(result.warnings.length, 0);
    assert.deepEqual(result.sidecar, sidecar());
  });

  test('audioSha256 mismatch → stale null + warning', async () => {
    const io = new FakeIo();
    await writeBeatsSidecar('/project', 'chart-w1', sidecar(), io);
    const result = await readBeatsSidecar('/project', 'chart-w1', {
      io,
      currentAudioSha256: HASH_B,
    });
    assert.equal(result.sidecar, null);
    assert.ok(result.warnings.some((warning) => warning.includes('stale')));
  });

  test('manifest sha256 is reused when current hash is omitted', async () => {
    const io = new FakeIo();
    await writeBeatsSidecar('/project', 'chart-w1', sidecar(), io);
    io.files.set('media/manifest.json', {
      assets: [{ assetId: 'asset:audio:main', sha256: HASH_A }],
    });
    const result = await readBeatsSidecar('/project', 'chart-w1', {
      io,
      durationMs: 8000,
    });
    assert.equal(result.warnings.length, 0);
    assert.ok(result.sidecar);
  });

  test('manifest hash mismatch is stale', async () => {
    const io = new FakeIo();
    await writeBeatsSidecar('/project', 'chart-w1', sidecar(), io);
    io.files.set('media/manifest.json', {
      assets: [{ assetId: 'asset:audio:main', sha256: HASH_B }],
    });
    const result = await readBeatsSidecar('/project', 'chart-w1', { io });
    assert.equal(result.sidecar, null);
    assert.ok(result.warnings.some((warning) => warning.includes('stale')));
  });

  test('bad JSON → null + warning', async () => {
    const io = new FakeIo();
    io.files.set(beatsSidecarRelPath('chart-w1'), '{ bad json');
    const result = await readBeatsSidecar('/project', 'chart-w1', { io });
    assert.equal(result.sidecar, null);
    assert.ok(result.warnings[0]?.includes('root must be an object'));
  });

  test('version error → null + warning', async () => {
    const result = parseBeatsSidecar({ ...sidecar(), schemaVersion: 2 }, 'chart-w1');
    assert.equal(result.sidecar, null);
    assert.ok(result.warnings[0]?.includes('schemaVersion'));
  });

  test('time beyond duration → null + warning', async () => {
    const result = parseBeatsSidecar(sidecar({ beatsMs: [0, 500, 9000] }), 'chart-w1', {
      durationMs: 8000,
    });
    assert.equal(result.sidecar, null);
    assert.ok(result.warnings[0]?.includes('exceeds duration'));
  });

  test('unknown field → null + warning', async () => {
    const result = parseBeatsSidecar({ ...sidecar(), extra: true }, 'chart-w1');
    assert.equal(result.sidecar, null);
    assert.ok(result.warnings[0]?.includes('unknown field extra'));
  });

  test('missing sidecar → null + warning', async () => {
    const result = await readBeatsSidecar('/project', 'chart-w1', { io: new FakeIo() });
    assert.equal(result.sidecar, null);
    assert.ok(result.warnings[0]?.includes('missing'));
  });

  test('sha256 uses raw bytes', async () => {
    assert.equal(
      await sha256Hex(new TextEncoder().encode('abc')),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
