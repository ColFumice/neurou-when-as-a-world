import type { WorldStateSnapshot } from '../director/IntentPort';

/** B2.2b platform boundary. Diagnostic captures are never saved as complete state. */
export class WorldStateStorage {
  private writer: { validate(raw: unknown): WorldStateSnapshot; save(snapshot: WorldStateSnapshot, expected: unknown | null): WorldStateSnapshot } | null = null;
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {}

  /** Missing is null; corrupt JSON/null is rejected without clearing the key. */
  readSnapshot(accountId: string, worldId: string): unknown | null {
    const text = this.storage.getItem(this.key(accountId, worldId));
    if (text === null) { return null; }
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('世界状态存储格式无效；原始数据已保留');
    }
    // This unknown candidate must still pass director identity/header validation;
    // successful JSON parsing never asserts a valid WorldStateSnapshot.
    return parsed;
  }

  /** The composition root supplies the seven-section codec and the existing leased writer. */
  bindCompleteWriter(writer: { validate(raw: unknown): WorldStateSnapshot;
    save(snapshot: WorldStateSnapshot, expected: unknown | null): WorldStateSnapshot }): void { this.writer = writer; }

  saveSnapshot(snapshot: WorldStateSnapshot, expected: unknown | null = null): WorldStateSnapshot {
    if (!this.writer) { throw new Error('世界完整状态保存未装配七项校验和世界租约；原有存储保持原状'); }
    const validated = this.writer.validate(snapshot);
    return this.writer.save(validated, expected);
  }

  private key(accountId: string, worldId: string): string {
    for (const [label, value] of [['账号', accountId], ['世界', worldId]]) {
      const maxLength = label === '账号' ? 64 : 128;
      if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > maxLength) {
        throw new Error(label + '标识须为 1～' + maxLength + ' 个字符');
      }
      try { encodeURIComponent(value); }
      catch (_error: unknown) { throw new Error(label + '标识包含无效字符，无法用于隔离存储'); }
    }
    return 'neurou-world-state-v1:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(worldId);
  }
}
