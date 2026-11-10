import type { WorldFolderSnapshot } from '../director/IntentPort';

/** Browser metadata adapter; no gameplay state, milestones or editor drafts are stored here. */
export class WorldLocalStorage {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {}

  readSnapshot(accountId: string): unknown | null {
    const text = this.storage.getItem(this.key(accountId));
    if (text === null) { return null; }
    const parsed: unknown = JSON.parse(text);
    if (parsed === null) { throw new Error('世界目录数据无效'); }
    return parsed;
  }

  saveSnapshot(snapshot: WorldFolderSnapshot, expected: unknown | null): void {
    const current = this.readSnapshot(snapshot.accountId);
    if (JSON.stringify(current) !== JSON.stringify(expected)) {
      throw new Error('世界目录已在其他页面更新，请刷新后重试');
    }
    this.storage.setItem(this.key(snapshot.accountId), JSON.stringify(snapshot));
  }

  private key(accountId: string): string {
    return 'neurou-world-folder-v1:' + encodeURIComponent(accountId);
  }
}

