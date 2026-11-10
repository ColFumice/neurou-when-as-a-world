import type { LedgerPosition, NarrativeEvent } from './types';
import { deriveLedgerPosition, validateNarrativeVector } from './vector';

/**
 * io 约定（由 app/adapters 实现）：
 * - readLines() 返回不含换行符的行，必须剔除末尾空行；
 * - appendLine(line) 追加 line + "\n"；
 * - hash(text) 返回 SHA-256 十六进制，text 为 joinLines() 的规范文本；
 * - writeHead() 原子写。
 */

const LEDGER_SCHEMA_VERSION = 1 as const;
const VECTOR_LENGTH = 20;

/** 账本 head 摘要；周期性摘要，不是全量快照。 */
export interface LedgerCheckpoint {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION;
  readonly eventCount: number;
  readonly lastEventId: string | null;
  readonly positionSum: LedgerPosition;
  readonly checksum: string;
}

/** append-only 账本存储；不暴露 update / delete。 */
export class LedgerStore {
  constructor(
    private readonly io: {
      readHead(): Promise<LedgerCheckpoint | null>;
      readLines(): Promise<readonly string[]>;
      appendLine(line: string): Promise<void>;
      writeHead(checkpoint: LedgerCheckpoint): Promise<void>;
      hash(text: string): Promise<string> | string;
    },
  ) {}

  /**
   * @internal
   * R2 内部写方法；公开写入口是 appendNarrativeEvent。
   * 不提供 update / delete。
   */
  async append(event: NarrativeEvent): Promise<LedgerCheckpoint> {
    validateNarrativeVector(event.vector, event.vectorSchemaVersion);
    if (event.eventId.length === 0) {
      throw new Error('NarrativeEvent.eventId must not be empty');
    }
    if (!Number.isFinite(event.appendedAt.epochMs)) {
      throw new Error('NarrativeEvent.appendedAt.epochMs must be finite');
    }

    const head = await this.io.readHead();
    const lines = await this.io.readLines();

    if (head === null) {
      if (lines.length !== 0) {
        throw new Error('ledger head is missing but ledger lines exist');
      }
    } else {
      if (!isLedgerCheckpoint(head)) {
        throw new Error('ledger head is malformed');
      }
      if (head.eventCount !== lines.length) {
        throw new Error('ledger head and last line disagree');
      }
      validateNarrativeVector(head.positionSum);
      const existingChecksum = await this.io.hash(joinLines(lines));
      if (existingChecksum !== head.checksum) {
        throw new Error('ledger checksum mismatch');
      }
    }

    const existingEvents = parseLedgerLines(lines);
    const previousPosition = deriveLedgerPosition(existingEvents);
    if (head !== null && !samePosition(previousPosition, head.positionSum)) {
      throw new Error('ledger positionSum mismatch');
    }
    const previousLastId = existingEvents.length === 0
      ? null
      : existingEvents[existingEvents.length - 1].eventId;
    if (head !== null && previousLastId !== head.lastEventId) {
      throw new Error('ledger lastEventId mismatch');
    }

    const line = JSON.stringify(event);
    await this.io.appendLine(line);
    const nextLines = [...lines, line];
    const checkpoint: LedgerCheckpoint = {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      eventCount: nextLines.length,
      lastEventId: event.eventId,
      positionSum: addPositions(previousPosition, event.vector),
      checksum: await this.io.hash(joinLines(nextLines)),
    };
    await this.io.writeHead(checkpoint);
    return checkpoint;
  }
}

/** 只读账本读取器；head 与末行不一致时返回 ok=false，不截断、不重建。 */
export class LedgerReader {
  constructor(
    private readonly io: {
      readHead(): Promise<LedgerCheckpoint | null>;
      readLines(): Promise<readonly string[]>;
      hash(text: string): Promise<string> | string;
    },
  ) {}

  async readAll(): Promise<
    | {
        readonly ok: true;
        readonly events: readonly NarrativeEvent[];
        readonly checkpoint: LedgerCheckpoint;
      }
    | { readonly ok: false; readonly diagnostic: string }
  > {
    try {
      const head = await this.io.readHead();
      const lines = await this.io.readLines();

      if (head === null) {
        if (lines.length !== 0) {
          return { ok: false, diagnostic: 'ledger head is missing but ledger lines exist' };
        }
        return {
          ok: true,
          events: [],
          checkpoint: {
            schemaVersion: LEDGER_SCHEMA_VERSION,
            eventCount: 0,
            lastEventId: null,
            positionSum: zeros(),
            checksum: await this.io.hash(''),
          },
        };
      }

      if (!isLedgerCheckpoint(head)) {
        return { ok: false, diagnostic: 'ledger head is malformed' };
      }
      if (head.eventCount !== lines.length) {
        return { ok: false, diagnostic: 'ledger head and last line disagree' };
      }

      const events = parseLedgerLines(lines);
      validateNarrativeVector(head.positionSum);
      const checksum = await this.io.hash(joinLines(lines));
      if (checksum !== head.checksum) {
        return { ok: false, diagnostic: 'ledger checksum mismatch' };
      }
      if (!samePosition(deriveLedgerPosition(events), head.positionSum)) {
        return { ok: false, diagnostic: 'ledger positionSum mismatch' };
      }
      const lastEventId = events.length === 0 ? null : events[events.length - 1].eventId;
      if (lastEventId !== head.lastEventId) {
        return { ok: false, diagnostic: 'ledger lastEventId mismatch' };
      }

      return { ok: true, events, checkpoint: head };
    } catch (error) {
      return {
        ok: false,
        diagnostic: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * 唯一公开写入口。
 * R2 由测试直接调用；R4 由 director 接入。
 */
export async function appendNarrativeEvent(
  store: LedgerStore,
  event: NarrativeEvent,
): Promise<LedgerCheckpoint> {
  return store.append(event);
}

function zeros(): LedgerPosition {
  return new Array<number>(VECTOR_LENGTH).fill(0) as unknown as LedgerPosition;
}

function addPositions(a: LedgerPosition, b: LedgerPosition): LedgerPosition {
  const out = new Array<number>(VECTOR_LENGTH);
  for (let index = 0; index < VECTOR_LENGTH; index += 1) {
    out[index] = a[index] + b[index];
  }
  return out as unknown as LedgerPosition;
}

function samePosition(a: LedgerPosition, b: LedgerPosition): boolean {
  for (let index = 0; index < VECTOR_LENGTH; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

function joinLines(lines: readonly string[]): string {
  return lines.length === 0 ? '' : lines.join('\n') + '\n';
}

function isNarrativeEvent(value: unknown): value is NarrativeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<NarrativeEvent>;
  const appendedAt = event.appendedAt as { epochMs?: unknown } | undefined;
  return (
    typeof event.eventId === 'string'
    && event.eventId.length > 0
    && Array.isArray(event.vector)
    && typeof event.vectorSchemaVersion === 'number'
    && typeof appendedAt === 'object'
    && appendedAt !== null
    && typeof appendedAt.epochMs === 'number'
    && Number.isFinite(appendedAt.epochMs)
    && (event.chartRef === null || typeof event.chartRef === 'string')
  );
}

function parseLedgerLines(lines: readonly string[]): NarrativeEvent[] {
  return lines.map((line, index) => {
    try {
      const value: unknown = JSON.parse(line);
      if (!isNarrativeEvent(value)) {
        throw new Error('not a NarrativeEvent');
      }
      validateNarrativeVector(value.vector, value.vectorSchemaVersion);
      return value;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`ledger line ${index + 1} invalid: ${detail}`);
    }
  });
}

function isLedgerCheckpoint(value: unknown): value is LedgerCheckpoint {
  if (typeof value !== 'object' || value === null) return false;
  const checkpoint = value as Partial<LedgerCheckpoint>;
  return (
    checkpoint.schemaVersion === LEDGER_SCHEMA_VERSION
    && typeof checkpoint.eventCount === 'number'
    && Number.isSafeInteger(checkpoint.eventCount)
    && checkpoint.eventCount >= 0
    && (checkpoint.lastEventId === null || typeof checkpoint.lastEventId === 'string')
    && Array.isArray(checkpoint.positionSum)
    && checkpoint.positionSum.length === VECTOR_LENGTH
    && typeof checkpoint.checksum === 'string'
  );
}
