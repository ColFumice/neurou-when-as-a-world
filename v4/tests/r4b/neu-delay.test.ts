import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NeuRuntime } from '../../core/editor/runtime/NeuRuntime';
import type { NeuModule } from '../../core/editor/runtime/types';
import { audio, neu, rhythm } from './helpers';

function delayGraph(): NeuModule[] {
  return [
    rhythm('r', 1000, ['delay']),
    neu('delay', 'Delay', ['audio'], ['r'], { delayMs: 500 }),
    audio('audio', ['delay']),
  ];
}

function countUntil(runtime: NeuRuntime, times: readonly number[]): number {
  let count = 0;
  for (const time of times) {
    runtime.advanceTo(time, true, (signal) => {
      if (signal.kind === 'Audio') count += 1;
    });
  }
  return count;
}

describe('R4b AC4-21 Delay 按 playhead 时间轴', () => {
  test('延时只在 due 时刻之后发射', () => {
    const runtime = new NeuRuntime(delayGraph());
    runtime.reset(0);
    assert.equal(countUntil(runtime, [1000, 1400]), 0);
    assert.equal(countUntil(runtime, [1500]), 1);
  });

  test('暂停期间不推进；恢复后继续按时间轴补发', () => {
    const runtime = new NeuRuntime(delayGraph());
    runtime.reset(0);
    runtime.advanceTo(1000, true, () => undefined);
    runtime.advanceTo(1200, false, () => undefined);
    let count = 0;
    runtime.advanceTo(1200, true, (signal) => {
      if (signal.kind === 'Audio') count += 1;
    });
    assert.equal(count, 0);
    runtime.advanceTo(1500, true, (signal) => {
      if (signal.kind === 'Audio') count += 1;
    });
    assert.equal(count, 1);
  });

  test('大帧跳跃补发所有 due 脉冲', () => {
    const runtime = new NeuRuntime(delayGraph());
    runtime.reset(0);
    assert.equal(countUntil(runtime, [1000, 2000]), 1);
  });

  test('delayMs 是数字字符串时仍按时间轴延时', () => {
    const modules = [
      rhythm('r', 1000, ['delay']),
      neu('delay', 'Delay', ['audio'], ['r'], { delayMs: '500' }),
      audio('audio', ['delay']),
    ];
    const runtime = new NeuRuntime(modules);
    runtime.reset(0);
    assert.equal(countUntil(runtime, [1000, 1400]), 0);
    assert.equal(countUntil(runtime, [1500]), 1);
  });
});
