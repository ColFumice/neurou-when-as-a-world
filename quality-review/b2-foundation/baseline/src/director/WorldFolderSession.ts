// B2.1 directory metadata only. Gameplay state and WorldFork remain outside this session.
export interface WorldFolderRecord {
  readonly worldId: string;
  readonly title: string;
  readonly description: string;
  readonly createdAt: number;
  readonly deletedAt: number | null;
  readonly template: 'InitialWorld' | 'EmptyWorld';
}

export interface WorldFolderSnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly records: readonly WorldFolderRecord[];
}

export type WorldFolderIntent =
  | { readonly kind: 'CreateWorld'; readonly title: string; readonly description: string }
  | { readonly kind: 'DeleteWorld'; readonly worldId: string }
  | { readonly kind: 'WorldFork'; readonly worldId: string };

export interface WorldFolderPort {
  submitWorldFolderIntent(intent: WorldFolderIntent): void;
}

/** Director owns directory decisions; platform persistence is injected, never imported. */
export class WorldFolderSession implements WorldFolderPort {
  private snapshot: WorldFolderSnapshot;

  constructor(
    private readonly accountId: string,
    stored: unknown | null,
    private readonly persist: (snapshot: WorldFolderSnapshot) => void,
    private readonly createId: () => string,
    private readonly now: () => number,
  ) {
    if (!accountId.trim() || accountId !== accountId.trim() || accountId.length > 64) {
      throw new Error('账号标识须为 1～64 个字符');
    }
    if (stored !== null) {
      this.snapshot = parseSnapshot(stored, accountId);
      return;
    }
    const initial: WorldFolderRecord = Object.freeze({
      worldId: 'InitialWorld', title: '初始世界',
      description: '箱庭 · 深痕 · 解谜链 · 引导线演奏',
      createdAt: validTime(now()), deletedAt: null, template: 'InitialWorld',
    });
    const candidate = freezeSnapshot(accountId, [initial]);
    persist(candidate);
    this.snapshot = candidate;
  }

  getWorlds(): readonly WorldFolderRecord[] {
    return Object.freeze(this.snapshot.records.filter(record => record.deletedAt === null));
  }

  getSnapshot(): WorldFolderSnapshot { return this.snapshot; }

  getWorldRecord(worldId: string): WorldFolderRecord {
    const record = this.snapshot.records.find(item => item.worldId === worldId && item.deletedAt === null);
    if (!record) { throw new Error('世界不存在或已删除，请刷新列表'); }
    return record;
  }

  submitWorldFolderIntent(intent: WorldFolderIntent): void {
    if (intent.kind === 'WorldFork') {
      this.getWorldRecord(intent.worldId);
      throw new Error('分叉尚未开放');
    }
    if (intent.kind === 'DeleteWorld') {
      const record = this.snapshot.records.find(item => item.worldId === intent.worldId);
      if (!record) { throw new Error('世界不存在或已删除，请刷新列表'); }
      if (record.deletedAt !== null) { return; }
      const deletedAt = Math.max(record.createdAt, validTime(this.now()));
      this.commit(this.snapshot.records.map(item => item === record
        ? Object.freeze({ ...item, deletedAt }) : item));
      return;
    }
    if (intent.kind !== 'CreateWorld') { throw new Error('未知世界目录操作'); }
    const title = validText(intent.title.trim(), 1, 80, '世界名称');
    const description = validText(intent.description.trim(), 0, 300, '世界说明');
    const worldId = this.createId();
    if (!/^world-[A-Za-z0-9-]{1,80}$/.test(worldId) ||
        this.snapshot.records.some(record => record.worldId === worldId)) {
      throw new Error('世界标识无效或重复，请重试');
    }
    this.commit([...this.snapshot.records, Object.freeze({
      worldId, title, description, createdAt: validTime(this.now()),
      deletedAt: null, template: 'EmptyWorld' as const,
    })]);
  }

  private commit(records: readonly WorldFolderRecord[]): void {
    const candidate = freezeSnapshot(this.accountId, records);
    this.persist(candidate);
    this.snapshot = candidate;
  }
}

function freezeSnapshot(accountId: string, records: readonly WorldFolderRecord[]): WorldFolderSnapshot {
  return Object.freeze({ schemaVersion: 1 as const, accountId, records: Object.freeze([...records]) });
}

function validTime(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('世界目录时间无效');
  }
  return value;
}

function validText(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== 'string' || value !== value.trim() || value.length < min || value.length > max) {
    throw new Error(label + '长度须为 ' + min + '～' + max + ' 个字符');
  }
  return value;
}

function objectWithKeys(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('世界目录数据格式无效');
  }
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== keys.length || !keys.every(key => Object.prototype.hasOwnProperty.call(data, key))) {
    throw new Error('世界目录字段无效');
  }
  return data;
}

function parseSnapshot(raw: unknown, accountId: string): WorldFolderSnapshot {
  const data = objectWithKeys(raw, ['schemaVersion', 'accountId', 'records']);
  if (data.schemaVersion !== 1 || data.accountId !== accountId || !Array.isArray(data.records)) {
    throw new Error('世界目录版本或账号不匹配');
  }
  const ids = new Set<string>();
  const records = data.records.map((rawRecord: unknown): WorldFolderRecord => {
    const item = objectWithKeys(rawRecord, ['worldId', 'title', 'description', 'createdAt', 'deletedAt', 'template']);
    const worldId = item.worldId;
    if (typeof worldId !== 'string' ||
        !(worldId === 'InitialWorld' || /^world-[A-Za-z0-9-]{1,80}$/.test(worldId)) || ids.has(worldId)) {
      throw new Error('世界标识无效或重复');
    }
    ids.add(worldId);
    const template = worldId === 'InitialWorld' ? 'InitialWorld' : 'EmptyWorld';
    if (item.template !== template) {
      throw new Error('世界模板无效');
    }
    const createdAt = validTime(item.createdAt);
    const deletedAt = item.deletedAt === null ? null : validTime(item.deletedAt);
    if (deletedAt !== null && deletedAt < createdAt) { throw new Error('世界删除时间无效'); }
    return Object.freeze({
      worldId, title: validText(item.title, 1, 80, '世界名称'),
      description: validText(item.description, 0, 300, '世界说明'),
      createdAt, deletedAt, template,
    });
  });
  return freezeSnapshot(accountId, records);
}

