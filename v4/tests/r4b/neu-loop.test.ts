import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NeuRuntime } from '../../core/editor/runtime/NeuRuntime';
import type { CycleWarning } from '../../core/eventgraph/RandomMode';
import { audio, neu, rhythm } from './helpers';

function cycleGraph(): {
  readonly modules: ReturnType<typeof rhythm>[];
  readonly warnings: CycleWarning[];
  readonly runtime: NeuRuntime;
} {
  const modules = [
    rhythm('r', 100, ['loop', 'audio']),
    neu('loop', 'Channel', ['loop', 'audio'], ['r', 'loop']),
    audio('audio', ['r', 'loop']),
  ];
  const warnings: CycleWarning[] = [];
  const runtime = new NeuRuntime(modules, {
    onCycleWarning: (warning) => warnings.push(warning),
  });
  return { modules, warnings, runtime };
}

function runCycle(): { count: number; warnings: CycleWarning[] } {
  const { warnings, runtime } = cycleGraph();
  runtime.reset(0);
  let count = 0;
  runtime.advanceTo(100, true, (signal) => {
    if (signal.kind === 'Audio') count += 1;
  });
  return { count, warnings };
}

describe('R4b AC4-21 原生 feedback loop', () => {
  test('ring 达到 100 次上限，产生 CycleWarning，不崩溃', () => {
    const result = runCycle();
    assert.equal(result.count, 100);
    assert.ok(result.warnings.length >= 1);
    assert.equal(result.warnings[0]?.limit, 100);
    assert.equal(result.warnings[0]?.reason, 'GraphCycle');
  });

  test('ring 超限不阻塞其他分支', () => {
    const modules = [
      rhythm('r', 100, ['loop', 'direct', 'audio']),
      neu('loop', 'Channel', ['loop', 'audio'], ['r', 'loop']),
      audio('audio', ['r', 'loop']),
      audio('direct', ['r']),
    ];
    const runtime = new NeuRuntime(modules);
    runtime.reset(0);
    let count = 0;
    runtime.advanceTo(100, true, (signal) => {
      if (signal.kind === 'Audio') count += 1;
    });
    assert.equal(count, 101);
  });

  test('DAG 不产生 CycleWarning', () => {
    const warnings: CycleWarning[] = [];
    const modules = [
      rhythm('r', 100, ['audio']),
      audio('audio', ['r']),
    ];
    const runtime = new NeuRuntime(modules, {
      onCycleWarning: (warning) => warnings.push(warning),
    });
    runtime.reset(0);
    let count = 0;
    runtime.advanceTo(100, true, (signal) => {
      if (signal.kind === 'Audio') count += 1;
    });
    assert.equal(count, 1);
    assert.equal(warnings.length, 0);
  });

  test('Channel R→L 同号通道形成可重复的跨 tick 环', () => {
    const modules = [
      rhythm('r', 100, ['audio']),
      neu('audio', 'Audio', ['delay'], ['r', 'channel-left-3'], {
        assetId: 'asset:audio:main',
      }),
      neu('delay', 'Delay', ['channel-right-3'], ['audio'], { delayMs: 1000 }),
      neu('channel-right-3', 'Channel', [], ['delay'], { side: 'right', port: 3 }),
      neu('channel-left-3', 'Channel', ['audio'], [], { side: 'left', port: 3 }),
    ];
    const runtime = new NeuRuntime(modules);
    runtime.reset(0);
    let count = 0;
    let at = 100;
    while (at <= 6100) {
      runtime.advanceTo(at, true, (signal) => {
        if (signal.kind === 'Audio') count += 1;
      });
      at += 1000;
    }
    assert.ok(count >= 5, `expected repeated audio, got ${count}`);
  });

  test('Audio→Delay→R4/L4 每 1000ms 触发一次', () => {
    const modules = [
      rhythm('r', 0, ['audio']),
      neu('audio', 'Audio', ['delay'], ['r', 'channel-left-4'], {
        assetId: 'asset:audio:main',
      }),
      neu('delay', 'Delay', ['channel-right-4'], ['audio'], { delayMs: '1000' }),
      neu('channel-right-4', 'Channel', [], ['delay'], { side: 'right', port: 4 }),
      neu('channel-left-4', 'Channel', ['audio'], [], { side: 'left', port: 4 }),
    ];
    const runtime = new NeuRuntime(modules);
    runtime.reset(-1);
    const times: number[] = [];
    for (let t = 0; t <= 3500; t += 16.6667) {
      runtime.advanceTo(t, true, (signal) => {
        if (signal.kind === 'Audio') times.push(Math.round(signal.atMs));
      });
    }
    assert.deepEqual(times.slice(0, 4), [0, 1000, 2000, 3000]);
  });

  test('未进入环的 RhythmPoint 只 trace 一次，左通道每秒 trace', () => {
    const modules = [
      rhythm('r', 0, ['audio']),
      neu('audio', 'Audio', ['delay'], ['r', 'channel-left-4'], {
        assetId: 'asset:audio:main',
      }),
      neu('delay', 'Delay', ['channel-right-4'], ['audio'], { delayMs: 1000 }),
      neu('channel-right-4', 'Channel', [], ['delay'], { side: 'right', port: 4 }),
      neu('channel-left-4', 'Channel', ['audio'], [], { side: 'left', port: 4 }),
    ];
    const runtime = new NeuRuntime(modules);
    runtime.reset(-1);
    const traced: string[] = [];
    for (let t = 0; t <= 2500; t += 16.6667) {
      runtime.advanceTo(t, true, () => undefined, (moduleId) => traced.push(moduleId));
    }
    assert.equal(traced.filter((id) => id === 'r').length, 1);
    assert.ok(traced.filter((id) => id === 'channel-left-4').length >= 2);
  });
});
