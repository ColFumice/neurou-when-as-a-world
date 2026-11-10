import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DivergenceAxis } from '../core/ledger/types';
import type { NarrativeDimension, NarrativeEvent } from '../core/ledger/types';
import {
  classifyDivergenceAxis,
  deriveLedgerPosition,
  deriveRouteSignature,
  validateNarrativeVector,
} from '../core/ledger/vector';

function makeVector(values: number[] = []): NarrativeDimension {
  const vector = new Array<number>(20).fill(0);
  for (let index = 0; index < values.length; index += 1) {
    vector[index] = values[index];
  }
  return vector as unknown as NarrativeDimension;
}

function makeEvent(eventId: string, values: number[] = []): NarrativeEvent {
  return {
    eventId,
    vector: makeVector(values),
    vectorSchemaVersion: 1,
    appendedAt: { epochMs: 1000 },
    chartRef: null,
  };
}

describe('AC4-13 20 维向量', () => {
  test('validateNarrativeVector 拒绝非法向量', () => {
    assert.throws(() => validateNarrativeVector(makeVector().slice(0, 19)), RangeError);
    assert.throws(() => validateNarrativeVector(makeVector([0, -1])), RangeError);
    assert.throws(() => validateNarrativeVector(makeVector([NaN])), RangeError);
    assert.throws(() => validateNarrativeVector(makeVector([Infinity])), RangeError);
    assert.throws(() => validateNarrativeVector(makeVector(), 2), RangeError);
    assert.doesNotThrow(() => validateNarrativeVector(makeVector()));
    assert.doesNotThrow(() => validateNarrativeVector(makeVector([0.5, 1.25])));
  });

  test('deriveLedgerPosition 空/单/双事件', () => {
    const empty = deriveLedgerPosition([]);
    assert.deepEqual(empty, new Array<number>(20).fill(0));

    const singleVector = makeVector([1, 2, 3]);
    const single = deriveLedgerPosition([makeEvent('a', [1, 2, 3])]);
    assert.deepEqual(single, singleVector);

    const sum = deriveLedgerPosition([makeEvent('a', [1, 2, 3]), makeEvent('b', [4, 5, 6])]);
    assert.deepEqual(sum, makeVector([5, 7, 9]));
  });

  test('classifyDivergenceAxis 六情感与全零', () => {
    assert.equal(classifyDivergenceAxis(makeVector([5])), DivergenceAxis.Red);
    assert.equal(classifyDivergenceAxis(makeVector([0, 6])), DivergenceAxis.Green);
    assert.equal(classifyDivergenceAxis(makeVector([5, 5])), DivergenceAxis.Red);
    assert.equal(classifyDivergenceAxis(makeVector()), DivergenceAxis.Grey);
  });

  test('deriveRouteSignature 空/单/双事件', () => {
    const empty = deriveRouteSignature([]);
    assert.equal(empty.eventCount, 0);
    assert.equal(empty.routeId, '');
    assert.equal(empty.divergence, DivergenceAxis.Grey);
    assert.deepEqual(empty.position, new Array<number>(20).fill(0));

    const single = deriveRouteSignature([makeEvent('a', [1])]);
    assert.equal(single.routeId, 'a');
    assert.equal(single.eventCount, 1);
    assert.deepEqual(single.position, makeVector([1]));

    const two = deriveRouteSignature([makeEvent('a', [1]), makeEvent('b', [2])]);
    assert.equal(two.routeId, 'a>b');
    assert.equal(two.eventCount, 2);
    assert.deepEqual(two.position, makeVector([3]));
  });
});
