import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TauriMediaImporter,
  type MediaStereoPair,
} from '../../adapters/tauri/TauriMediaImporter';
import type { MediaSource } from '../../core/media/types';
import {
  TauriInvokeError,
  type TauriInvokeFn,
  type TauriResult,
} from '../../adapters/tauri/tauriInvoke';

interface InvokeCall {
  readonly command: string;
  readonly args?: Record<string, unknown>;
}

function makeInvoke(
  handler: (command: string, args?: Record<string, unknown>) => TauriResult<unknown>,
): { fn: TauriInvokeFn; calls: InvokeCall[] } {
  const calls: InvokeCall[] = [];
  const fn: TauriInvokeFn = async <T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<TauriResult<T>> => {
    calls.push({ command, args });
    return handler(command, args) as unknown as TauriResult<T>;
  };
  return { fn, calls };
}

function asset(
  assetId: string,
  kind: MediaSource['kind'],
  relPath: string,
  extra: Partial<MediaSource> = {},
): MediaSource {
  return {
    assetId,
    kind,
    displayName: relPath,
    relPath,
    sha256: 'a'.repeat(64),
    sourceSha256: 'b'.repeat(64),
    bytes: 1024,
    durationMs: 1000,
    width: kind === 'Video' ? 320 : 0,
    height: kind === 'Video' ? 180 : 0,
    fps: kind === 'Video' ? 24 : 0,
    videoCodec: kind === 'Video' ? 'h264' : null,
    audioCodec: kind === 'Audio' ? 'pcm_s16le' : null,
    audioChannels: kind === 'Audio' ? 2 : 0,
    sampleRate: kind === 'Audio' ? 48000 : 0,
    createdAt: 1,
    derivedFrom: null,
    trim: null,
    ...extra,
  };
}

function pair(): MediaStereoPair {
  return {
    stereoPairId: 'fedcba9876543210',
    leftAssetId: '1111111111111111',
    rightAssetId: '2222222222222222',
    audioAssetId: '3333333333333333',
    createdAt: 1,
  };
}

describe('R3.5a-stereo TauriMediaImporter', () => {
  test('probe / importStereo / trim / extractFrames 参数与返回', async () => {
    const stereo = pair();
    const left = asset(
      stereo.leftAssetId,
      'Video',
      `media/stereo/${stereo.stereoPairId}/left.mp4`,
      { stereoPairId: stereo.stereoPairId, eye: 'Left' },
    );
    const right = asset(
      stereo.rightAssetId,
      'Video',
      `media/stereo/${stereo.stereoPairId}/right.mp4`,
      { stereoPairId: stereo.stereoPairId, eye: 'Right' },
    );
    const audio = asset(
      stereo.audioAssetId,
      'Audio',
      `media/stereo/${stereo.stereoPairId}/audio.wav`,
      { stereoPairId: stereo.stereoPairId, audioChannel: 'Stereo' },
    );
    const { fn, calls } = makeInvoke((command) => {
      if (command === 'media_probe') {
        return {
          ok: true,
          value: {
            kind: 'Video',
            formatName: 'mov,mp4',
            durationMs: 1000,
            width: 320,
            height: 180,
            fps: 24,
            videoCodec: 'h264',
            audioCodec: null,
            audioChannels: 0,
            sampleRate: 0,
            bytes: 1024,
          },
        };
      }
      if (command === 'media_import_stereo') {
        return {
          ok: true,
          value: { pair: stereo, left, right, audio, deduped: false },
        };
      }
      if (command === 'media_trim') {
        return { ok: true, value: { sourceAssetId: left.assetId, asset: left } };
      }
      if (command === 'media_extract_frames') {
        return {
          ok: true,
          value: [{
            timeMs: 0,
            relPath: `media/frames/${left.assetId}/0.jpg`,
            width: 160,
            height: 90,
          }],
        };
      }
      return { ok: true, value: undefined };
    });
    const importer = new TauriMediaImporter(fn);

    const probe = await importer.probe('C:\\in\\left.mp4');
    assert.equal(probe.kind, 'Video');
    assert.deepEqual(calls[0], {
      command: 'media_probe',
      args: { sourcePath: 'C:\\in\\left.mp4' },
    });

    const imported = await importer.importStereo('C:\\in\\left.mp4', 'C:\\in\\right.mp4');
    assert.equal(imported.deduped, false);
    assert.equal(imported.left.eye, 'Left');
    assert.equal(imported.right.eye, 'Right');
    assert.equal(imported.audio.audioChannel, 'Stereo');
    assert.deepEqual(calls[1], {
      command: 'media_import_stereo',
      args: { leftPath: 'C:\\in\\left.mp4', rightPath: 'C:\\in\\right.mp4' },
    });

    const trimmed = await importer.trim(left.assetId, 100, 900);
    assert.equal(trimmed.sourceAssetId, left.assetId);
    assert.deepEqual(calls[2], {
      command: 'media_trim',
      args: { assetId: left.assetId, startMs: 100, endMs: 900 },
    });

    const frames = await importer.extractFrames(left.assetId, [0, 500], 160);
    assert.equal(frames.length, 1);
    assert.deepEqual(calls[3], {
      command: 'media_extract_frames',
      args: { assetId: left.assetId, timesMs: [0, 500], maxWidth: 160 },
    });
  });

  test('importMono 已废弃且不触发 invoke；extractFrames 省略 maxWidth', async () => {
    const { fn, calls } = makeInvoke((command) => {
      if (command === 'media_extract_frames') return { ok: true, value: [] };
      return { ok: true, value: undefined };
    });
    const importer = new TauriMediaImporter(fn);

    await assert.rejects(
      importer.importMono('C:\\in\\clip.mp4', 'clip.mp4', 'Video'),
      (error: unknown) => error instanceof TauriInvokeError
        && error.code === 'MonoImportDisabled',
    );
    assert.equal(calls.length, 0);

    await importer.extractFrames('0123456789abcdef', [0]);
    assert.deepEqual(calls[0].args, {
      assetId: '0123456789abcdef',
      timesMs: [0],
    });
  });

  test('readMediaFile 将 Rust Vec<u8> 转成 Uint8Array', async () => {
    const { fn, calls } = makeInvoke((command) => {
      if (command === 'media_read_file') return { ok: true, value: [1, 2, 3, 255] };
      return { ok: true, value: undefined };
    });
    const importer = new TauriMediaImporter(fn);
    const bytes = await importer.readMediaFile('media/stereo/pair/left.mp4');
    assert.deepEqual([...bytes], [1, 2, 3, 255]);
    assert.deepEqual(calls[0], {
      command: 'media_read_file',
      args: { relPath: 'media/stereo/pair/left.mp4' },
    });
  });

  test('错误码归一化为 TauriInvokeError', async () => {
    const { fn } = makeInvoke(() => ({
      ok: false,
      code: 'StereoResolutionMismatch',
      message: 'left 320x180, right 320x182',
    }));
    const importer = new TauriMediaImporter(fn);
    await assert.rejects(
      importer.importStereo('C:\\in\\left.mp4', 'C:\\in\\right.mp4'),
      (error: unknown) => error instanceof TauriInvokeError
        && error.code === 'StereoResolutionMismatch'
        && error.message === 'left 320x180, right 320x182',
    );
  });
});
