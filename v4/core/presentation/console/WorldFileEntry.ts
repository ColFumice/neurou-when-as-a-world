import type { WorldFolderEntryKind } from './WorldFolderEntryKind';

/** P · console：世界文件条目视图模型；不携带文件系统路径。 */
export interface WorldFileEntry {
  readonly entryId: string;
  readonly displayName: string;
  readonly kind: WorldFolderEntryKind;
  readonly orphan?: boolean;
}
