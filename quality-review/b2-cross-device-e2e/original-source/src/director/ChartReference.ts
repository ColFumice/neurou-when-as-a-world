// B2.2c / VERDICT-236~237: immutable reference classification, never a completion writer.
import { VectorSchemaVersion } from '../../constants';
import { InputSource } from '../ledger/NarrativeEvent';
import type { NarrativeEvent } from '../ledger/NarrativeEvent';
import { validateNarrativeVector } from '../ledger/deriveLedgerPosition';

export type ChartReferenceClassification = 'Entry' | 'PremiereCompleted' | 'Unclassified';

function fields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)) {
    throw new Error('谱面引用字段格式无效');
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error('谱面引用字段无效'); }
  const values: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = descriptors[name];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error('谱面引用字段不可安全读取');
    }
    values[name] = descriptor.value;
  }
  return values;
}

function classify(event: NarrativeEvent, validatedLegacyRegularChartId?: string): {
  chartId: string; classification: ChartReferenceClassification;
} {
  const value = fields(event, ['eventId', 'vector', 'VectorSchemaVersion', 'AppendedAt', 'InputSource', 'ChapterTag', 'ChartRef']);
  const vector = validateNarrativeVector(value.vector);
  const time = fields(value.AppendedAt, ['epochMs']);
  fields(value.ChapterTag, []);
  const hasState = !!value.ChartRef && Object.prototype.hasOwnProperty.call(value.ChartRef, 'state');
  const ref = fields(value.ChartRef, hasState ? ['chartId', 'state'] : ['chartId']);
  if (value.VectorSchemaVersion !== VectorSchemaVersion ||
      (value.InputSource !== InputSource.Player && value.InputSource !== InputSource.Autopilot) ||
      typeof value.eventId !== 'string' || !value.eventId.trim() ||
      typeof time.epochMs !== 'number' || !Number.isSafeInteger(time.epochMs) || time.epochMs < 0 ||
      typeof ref.chartId !== 'string' || !ref.chartId.trim() || ref.chartId !== ref.chartId.trim()) {
    throw new Error('谱面引用事件格式无效');
  }
  const chartId = ref.chartId;
  if (hasState) {
    if (ref.state !== 'Entry' && ref.state !== 'PremiereCompleted') { throw new Error('谱面引用状态无效'); }
    if (ref.state === 'PremiereCompleted' && chartId === 'CHART_NOT_BOUND') { throw new Error('未绑定谱面不能完成首演'); }
    return { chartId, classification: ref.state };
  }
  const legacy = value.InputSource === InputSource.Player && vector.every(component => component === 0);
  if (legacy && value.eventId === 'T6_ENDPOINT_PLACEHOLDER') { return { chartId, classification: 'Entry' }; }
  if (legacy && value.eventId === 'T7_COMPLETION_PLACEHOLDER' && chartId !== 'CHART_NOT_BOUND' &&
      validatedLegacyRegularChartId === chartId) { return { chartId, classification: 'PremiereCompleted' }; }
  return { chartId, classification: 'Unclassified' };
}

/** Only exact old producers and an explicitly verified Regular binding receive compatibility. */
export function classifyChartReference(event: NarrativeEvent, validatedLegacyRegularChartId?: string): ChartReferenceClassification {
  return classify(event, validatedLegacyRegularChartId).classification;
}

/** Only a legal completion reference for the verified target chart is a premiere fact. */
export function hasChartPremiereCompleted(events: readonly NarrativeEvent[], chartId: string,
  validatedLegacyRegularChartId?: string): boolean {
  return events.some(event => {
    const reference = classify(event, validatedLegacyRegularChartId);
    return reference.chartId === chartId && reference.classification === 'PremiereCompleted';
  });
}
