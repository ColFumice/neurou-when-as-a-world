import type { AccountMilestoneProjection } from '../director/IntentPort';

/** Local browser adapter only; no authentication or world-clear authority. */
export class AccountMilestoneStorage {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {}

  readProjection(accountId: string): unknown | null {
    const text = this.storage.getItem(this.key(accountId));
    if (text === null) { return null; }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error('首次世界通关投影 JSON 损坏'); }
    return parseProjection(raw, accountId);
  }

  /**
   * Adapter contract for future trusted orchestration and isolated contract tests.
   * B2.2a has no production caller that produces a world-clear fact.
   */
  saveProjection(projection: AccountMilestoneProjection, expected: unknown | null): void {
    const candidate = parseProjection(projection);
    const previous = expected === null ? null : parseProjection(expected, candidate.accountId);
    const current = this.readProjection(candidate.accountId) as AccountMilestoneProjection | null;
    // Check actual persisted fact too: a stale false reader cannot erase a newer true.
    if ((current?.FirstWorldCleared || previous?.FirstWorldCleared) && !candidate.FirstWorldCleared) {
      throw new Error('首次世界通关事实不可由 true 回退为 false');
    }
    if (JSON.stringify(current) !== JSON.stringify(previous)) {
      throw new Error('首次世界通关投影已在其他页面更新，请刷新后重试');
    }
    // No CopyPermission or other derived values cross the persistence boundary.
    this.storage.setItem(this.key(candidate.accountId), JSON.stringify(candidate));
  }

  private key(accountId: string): string {
    validAccountId(accountId);
    return 'neurou-account-first-world-cleared-v1:' + encodeURIComponent(accountId);
  }
}

// Structural validation is deliberately local: presentation cannot value-import director.
// Director repeats domain validation when it constructs the read-only projection reader.
function parseProjection(raw: unknown, accountId?: string): AccountMilestoneProjection {
  if (accountId !== undefined) { validAccountId(accountId); }
  if (raw === null || typeof raw !== 'object') {
    throw new Error('首次世界通关投影格式无效');
  }
  const fields = ['schemaVersion', 'accountId', 'FirstWorldCleared'];
  let descriptors: PropertyDescriptorMap;
  try {
    const prototype: unknown = Object.getPrototypeOf(raw);
    if (Array.isArray(raw) || (prototype !== Object.prototype && prototype !== null)) {
      throw new Error('首次世界通关投影格式无效');
    }
    descriptors = Object.getOwnPropertyDescriptors(raw);
    if (Reflect.ownKeys(descriptors).length !== fields.length || !fields.every(field => {
      const descriptor = descriptors[field];
      return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value');
    })) { throw new Error('首次世界通关投影字段无效'); }
  } catch { throw new Error('首次世界通关投影字段无效或无法安全读取'); }
  const schemaVersion: unknown = descriptors.schemaVersion.value;
  const storedAccountId: unknown = descriptors.accountId.value;
  const FirstWorldCleared: unknown = descriptors.FirstWorldCleared.value;
  if (schemaVersion !== 1) { throw new Error('首次世界通关投影版本不受支持'); }
  validAccountId(storedAccountId);
  if (accountId !== undefined && storedAccountId !== accountId) {
    throw new Error('首次世界通关投影账号不匹配');
  }
  if (typeof FirstWorldCleared !== 'boolean') { throw new Error('首次世界通关事实必须为布尔值'); }
  return Object.freeze({ schemaVersion: 1, accountId: storedAccountId, FirstWorldCleared });
}

function validAccountId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64 || value !== value.trim()) {
    throw new Error('账号标识须为不带首尾空白的 1～64 个字符');
  }
  try { encodeURIComponent(value); } catch { throw new Error('账号标识编码无效'); }
}
