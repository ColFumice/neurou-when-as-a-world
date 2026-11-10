import { VectorSchemaVersion } from '../constants/index';
import { DivergenceAxis } from './types';
import type {
  LedgerPosition,
  NarrativeDimension,
  NarrativeEvent,
  RouteCoverage,
  RouteSignature,
} from './types';

/** 20 维长度。 */
const VECTOR_LENGTH = 20;

/**
 * 校验 20 维向量；非法时抛 RangeError（assertion function，调用方无需再检查返回值）。
 *
 * 规则：VectorSchemaVersion=1 / 长度=20 / 每维有限数 / 每维非负。
 */
export function validateNarrativeVector(
  vector: readonly number[],
  vectorSchemaVersion: number = VectorSchemaVersion,
): asserts vector is NarrativeDimension {
  if (vectorSchemaVersion !== VectorSchemaVersion) {
    throw new RangeError(`unsupported vectorSchemaVersion: ${String(vectorSchemaVersion)}`);
  }
  if (vector.length !== VECTOR_LENGTH) {
    throw new RangeError(`narrative vector must have ${VECTOR_LENGTH} dimensions, got ${vector.length}`);
  }
  for (let index = 0; index < vector.length; index += 1) {
    const value = vector[index];
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`narrative vector[${index}] must be a finite non-negative number`);
    }
  }
}

/**
 * 由事件序列派生累计位置。
 * 每个事件的向量先经 validateNarrativeVector 校验。
 */
export function deriveLedgerPosition(events: readonly NarrativeEvent[]): LedgerPosition {
  const sum = new Array<number>(VECTOR_LENGTH).fill(0);
  for (const event of events) {
    validateNarrativeVector(event.vector, event.vectorSchemaVersion);
    for (let index = 0; index < VECTOR_LENGTH; index += 1) {
      sum[index] = (sum[index] ?? 0) + (event.vector[index] ?? 0);
    }
  }
  return sum as unknown as LedgerPosition;
}

/**
 * 六情感分类：
 * - 取前 6 维最大值；
 * - 并列按 Red → Green → Blue → Black → White → Grey 取首；
 * - 全零/零向量返回 Grey。
 */
export function classifyDivergenceAxis(position: LedgerPosition): DivergenceAxis {
  const axes = [
    DivergenceAxis.Red,
    DivergenceAxis.Green,
    DivergenceAxis.Blue,
    DivergenceAxis.Black,
    DivergenceAxis.White,
    DivergenceAxis.Grey,
  ] as const;

  let bestValue = Number.NEGATIVE_INFINITY;
  let bestAxis: DivergenceAxis = DivergenceAxis.Grey;
  for (let index = 0; index < axes.length; index += 1) {
    const value = position[index];
    if (value > bestValue) {
      bestValue = value;
      bestAxis = axes[index];
    }
  }
  return bestValue <= 0 ? DivergenceAxis.Grey : bestAxis;
}

/**
 * 由事件序列派生路线签名。
 * routeId 由事件 ID 顺序拼接；空序列为 ""。
 */
export function deriveRouteSignature(events: readonly NarrativeEvent[]): RouteSignature {
  const position = deriveLedgerPosition(events);
  const divergence = classifyDivergenceAxis(position);
  const coverage: RouteCoverage = {
    eventCount: events.length,
    position,
    divergence,
  };
  return {
    routeId: events.map((event) => event.eventId).join('>'),
    ...coverage,
  };
}