import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NeuRuntime } from '../../core/editor/runtime/NeuRuntime';
import type { NeuModule } from '../../core/editor/runtime/types';
import { audio, neu, rhythm } from './helpers';

function run(modules: readonly NeuModule[], times: readonly number[]): number {
  const runtime = new NeuRuntime(modules);
  runtime.reset(0);
  let count = 0;
  for (const time of times) {
    runtime.advanceTo(time, true, (signal) => {
      if (signal.kind === 'Audio') count += 1;
    });
  }
  return count;
}

describe('R4b AC4-20 NEU truth table', () => {
  test('AND：两输入都为真才输出', () => {
    const both = [
      rhythm('a', 100, ['and']),
      rhythm('b', 100, ['and']),
      neu('and', 'AND', ['out'], ['a', 'b']),
      audio('out', ['and']),
    ];
    const onlyA = [
      rhythm('a', 100, ['and']),
      neu('and', 'AND', ['out'], ['a', 'b']),
      audio('out', ['and']),
    ];
    assert.equal(run(both, [100]), 1);
    assert.equal(run(onlyA, [100]), 0);
  });

  test('OR：任一输入为真即输出', () => {
    const onlyA = [
      rhythm('a', 100, ['or']),
      neu('or', 'OR', ['out'], ['a', 'b']),
      audio('out', ['or']),
    ];
    const none = [
      neu('or', 'OR', ['out'], ['a', 'b']),
      audio('out', ['or']),
    ];
    assert.equal(run(onlyA, [100]), 1);
    assert.equal(run(none, [100]), 0);
  });

  test('NOT：本 tick 无输入时触发下游', () => {
    const modules = [
      rhythm('a', 100, ['not']),
      rhythm('b', 200, []),
      neu('not', 'NOT', ['out'], ['a']),
      audio('out', ['not']),
    ];
    const runtime = new NeuRuntime(modules);
    runtime.reset(0);
    let count = 0;
    runtime.advanceTo(100, true, (signal) => {
      if (signal.kind === 'Audio') count += 1;
    });
    runtime.advanceTo(200, true, (signal) => {
      if (signal.kind === 'Audio') count += 1;
    });
    assert.equal(count, 1);
  });

  test('Channel：脉冲原样透传', () => {
    const modules = [
      rhythm('a', 100, ['channel']),
      neu('channel', 'Channel', ['out'], ['a']),
      audio('out', ['channel']),
    ];
    assert.equal(run(modules, [100]), 1);
  });
});
