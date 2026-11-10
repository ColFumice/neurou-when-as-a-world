import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RainIntensity } from '../../core/world/types';
import { RainAudio } from '../../app/src/game/rain/RainAudio';

class FakeParam {
  value = 0;
  targets: number[] = [];
  setTargetAtTime(value: number): void {
    this.value = value;
    this.targets.push(value);
  }
}

class FakeGain {
  gain = new FakeParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeFilter {
  type = '';
  frequency = new FakeParam();
  Q = new FakeParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeSource {
  buffer: unknown = null;
  loop = false;
  started = false;
  stopped = false;
  connect(): void {}
  start(): void { this.started = true; }
  stop(): void { this.stopped = true; }
  disconnect(): void {}
}

class FakeContext {
  sampleRate = 48_000;
  currentTime = 0;
  state = 'suspended';
  destination = {};
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  filters: FakeFilter[] = [];
  resumed = 0;
  closed = 0;

  createBuffer(): { getChannelData(): Float32Array } {
    return { getChannelData: () => new Float32Array(16) };
  }

  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  createBiquadFilter(): FakeFilter {
    const filter = new FakeFilter();
    this.filters.push(filter);
    return filter;
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  async resume(): Promise<void> { this.resumed += 1; }
  async close(): Promise<void> { this.closed += 1; }
}

function make(): { context: FakeContext; audio: RainAudio } {
  const context = new FakeContext();
  return {
    context,
    audio: new RainAudio({ contextFactory: () => context as never }),
  };
}

describe('R4e.2b RainAudio', () => {
  test('setEnabled(false) → 静音，且不创建 AudioContext', () => {
    const context = new FakeContext();
    let created = 0;
    const audio = new RainAudio({
      contextFactory: () => {
        created += 1;
        return context as never;
      },
    });
    audio.setEnabled(false);
    assert.equal(created, 0);
    assert.equal(audio.enabled, false);
  });

  test('三种 intensity 音量映射正确', () => {
    assert.equal(RainAudio.volumeFor(RainIntensity.Light), 0.15);
    assert.equal(RainAudio.volumeFor(RainIntensity.Moderate), 0.30);
    assert.equal(RainAudio.volumeFor(RainIntensity.Heavy), 0.50);
  });

  test('启用后的 setIntensity 写入 gain 目标值；关闭静音', () => {
    const { context, audio } = make();
    audio.setIntensity(RainIntensity.Light);
    audio.setEnabled(true);
    assert.equal(context.gains[0]?.gain.value, 0.15);
    audio.setIntensity(RainIntensity.Moderate);
    assert.equal(context.gains[0]?.gain.value, 0.30);
    audio.setIntensity(RainIntensity.Heavy);
    assert.equal(context.gains[0]?.gain.value, 0.50);
    audio.setEnabled(false);
    assert.equal(context.gains[0]?.gain.value, 0);
  });

  test('resume 在用户手势中调用 AudioContext.resume', async () => {
    const { context, audio } = make();
    audio.setEnabled(true);
    await audio.resume();
    assert.equal(context.resumed, 1);
  });

  test('dispose 停止 source、关闭 context，之后不再创建新图', () => {
    const { context, audio } = make();
    audio.setEnabled(true);
    const source = context.sources[0];
    audio.dispose();
    assert.equal(source?.stopped, true);
    assert.equal(context.closed, 1);
    const before = context.gains.length;
    audio.setEnabled(true);
    assert.equal(context.gains.length, before);
  });
});
