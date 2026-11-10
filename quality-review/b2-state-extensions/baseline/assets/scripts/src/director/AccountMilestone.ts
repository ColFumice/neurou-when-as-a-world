// B2.2a: local account projection only. Real world-clear writes belong to B2.2c.
export interface AccountMilestoneProjection {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly FirstWorldCleared: boolean;
}

/** CopyPermission is derived at the read boundary; it is never a stored field. */
export interface AccountMilestoneSnapshot {
  readonly accountId: string;
  readonly FirstWorldCleared: boolean;
  readonly CopyPermission: boolean;
}

export interface AccountMilestoneReader {
  getMilestoneSnapshot(): AccountMilestoneSnapshot;
}

/** A missing local projection means false, while an invalid projection must fail. */
export function createAccountMilestoneReader(
  accountId: string,
  stored: unknown | null,
): AccountMilestoneReader {
  validAccountId(accountId);
  const FirstWorldCleared = stored === null ? false : parseProjection(stored, accountId).FirstWorldCleared;
  const snapshot: AccountMilestoneSnapshot = Object.freeze({
    accountId, FirstWorldCleared, CopyPermission: FirstWorldCleared,
  });
  return Object.freeze({ getMilestoneSnapshot: (): AccountMilestoneSnapshot => snapshot });
}

function validAccountId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64 || value !== value.trim()) {
    throw new Error('账号标识须为不带首尾空白的 1～64 个字符');
  }
  // Storage keys use encodeURIComponent; malformed UTF-16 must not alias a key.
  try { encodeURIComponent(value); } catch { throw new Error('账号标识编码无效'); }
}

function parseProjection(raw: unknown, accountId: string): AccountMilestoneProjection {
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
  // Read descriptor values once: an in-process Proxy cannot change a value after validation.
  const schemaVersion: unknown = descriptors.schemaVersion.value;
  const storedAccountId: unknown = descriptors.accountId.value;
  const FirstWorldCleared: unknown = descriptors.FirstWorldCleared.value;
  if (schemaVersion !== 1) { throw new Error('首次世界通关投影版本不受支持'); }
  validAccountId(storedAccountId);
  if (storedAccountId !== accountId) { throw new Error('首次世界通关投影账号不匹配'); }
  if (typeof FirstWorldCleared !== 'boolean') { throw new Error('首次世界通关事实必须为布尔值'); }
  return Object.freeze({ schemaVersion: 1, accountId, FirstWorldCleared });
}
