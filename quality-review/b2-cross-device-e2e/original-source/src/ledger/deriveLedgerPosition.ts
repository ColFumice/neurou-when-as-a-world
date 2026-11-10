// B2.2c / VERDICT-232: append-order, full-dimensional authoritative ledger read.
import { NarrativeDimension, VectorSchemaVersion } from '../../constants';
import type { NarrativeEvent, NarrativeVector } from './NarrativeEvent';

const dimensions: readonly NarrativeDimension[] = Object.values(NarrativeDimension)
  .filter((value): value is NarrativeDimension => typeof value === 'number');

/** Copy a complete, finite, non-negative vector without invoking property getters. */
export function validateNarrativeVector(raw: unknown): NarrativeVector {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) {
    throw new Error('叙事向量必须为完整有序数组');
  }
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== dimensions.length + 1 || descriptors.length?.value !== dimensions.length) {
    throw new Error('叙事向量须完整包含全部冻结维度');
  }
  const values: number[] = [];
  for (const dimension of dimensions) {
    const descriptor = descriptors[String(dimension)];
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
        typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value) || descriptor.value < 0) {
      throw new Error('叙事向量各维须为有限非负实数');
    }
    values[dimension] = descriptor.value;
  }
  return Object.freeze(values) as unknown as NarrativeVector;
}

/** The caller supplies the read view paired with its account/world/character append sink. */
export function deriveLedgerPosition(events: readonly NarrativeEvent[]): NarrativeVector {
  const position = new Array<number>(dimensions.length).fill(0);
  for (const narrativeEvent of events) {
    if (narrativeEvent.VectorSchemaVersion !== VectorSchemaVersion) {
      throw new Error('账本向量版本不受支持');
    }
    const vector = validateNarrativeVector(narrativeEvent.vector);
    for (const dimension of dimensions) {
      const next = position[dimension] + vector[dimension];
      if (!Number.isFinite(next)) { throw new Error('账本坐标累计溢出'); }
      position[dimension] = next;
    }
  }
  return Object.freeze(position) as unknown as NarrativeVector;
}
