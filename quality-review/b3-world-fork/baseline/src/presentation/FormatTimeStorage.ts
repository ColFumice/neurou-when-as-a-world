import type { FormatTimeSnapshot, WorldCoreStateSnapshot } from '../director/IntentPort';
import type { WorldCoreStateStorage } from './WorldCoreStateStorage';

/** A section view over the one world document; never a second storage key. */
export class FormatTimeStorage {
  constructor(private readonly core: WorldCoreStateStorage) {}

  /** Missing historical data stays null. This read never initializes a value. */
  readFormatTime(accountId: string, worldId: string): FormatTimeSnapshot | null {
    return this.core.readValidatedCoreState(accountId, worldId)?.sections.FormatTime ?? null;
  }

  /** Explicit new-world creation only; an existing document cannot be initialized. */
  initializeFormatTime(snapshot: WorldCoreStateSnapshot, newWorldCreation: true): WorldCoreStateSnapshot {
    if (newWorldCreation !== true) { throw new Error('格式化时间只能由明确的新世界创建协议初始化'); }
    const candidate = this.core.validateCoreState(snapshot);
    if (candidate.revision !== 0 || candidate.sections.FormatTime === null) {
      throw new Error('世界创建协议必须提供初始版本与权威创建时刻');
    }
    return this.core.saveCoreState(candidate, null);
  }
}
