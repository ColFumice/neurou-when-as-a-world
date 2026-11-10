import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NeuRuntime } from '../../core/editor/runtime/NeuRuntime';
import {
  RandomPreviewMode,
  RandomSeed,
} from '../../core/eventgraph/RandomMode';
import { audio, neu, rhythm } from './helpers';

function randomGraph(draws: number) {
  const sources = Array.from({ length: draws }, (_, index) => (
    rhythm(`r${index}`, 1000, ['random'])
  ));
  return [
    ...sources,
    neu('random', 'Random', ['out'], sources.map((item) => item.moduleId), {
      probability: 0.5,
    }),
    audio('out', ['random']),
  ];
}

function runSeeded(seed: number, draws = 20): number {
  const runtime = new NeuRuntime(randomGraph(draws), {
    mode: RandomPreviewMode.Seeded,
    seed: new RandomSeed(seed),
  });
  runtime.reset(0);
  let count = 0;
  runtime.advanceTo(1000, true, (signal) => {
    if (signal.kind === 'Audio') count += 1;
  });
  return count;
}

function runLive(values: readonly number[]): number {
  let index = 0;
  const runtime = new NeuRuntime(randomGraph(values.length), {
    mode: RandomPreviewMode.Live,
    seed: new RandomSeed(0),
    randomValue: () => values[index++] ?? 0,
  });
  runtime.reset(0);
  let count = 0;
  runtime.advanceTo(1000, true, (signal) => {
    if (signal.kind === 'Audio') count += 1;
  });
  return count;
}

describe('R4b AC4-21/22/41 随机分流', () => {
  test('Seeded：同 seed 同结果', () => {
    assert.equal(runSeeded(123), runSeeded(123));
  });

  test('Seeded：不同 seed 产生不同序列（多样本）', () => {
    const results = new Set([runSeeded(1), runSeeded(2), runSeeded(3), runSeeded(4)]);
    assert.ok(results.size > 1, `expected different seeded results, got ${[...results]}`);
  });

  test('Live：provider 序列不同 → 结果不同', () => {
    const low = Array.from({ length: 20 }, () => 0.1);
    const high = Array.from({ length: 20 }, () => 0.9);
    assert.equal(runLive(low), 20);
    assert.equal(runLive(high), 0);
  });
});
