import { WorldFolderEntryKind } from './WorldFolderEntryKind';

/** P · console：导出意图；只描述目标，不执行文件操作。 */
export interface WorldExportIntent {
  readonly sourceEntryId: string;
  readonly targetKind: WorldFolderEntryKind;
}

export const WorldExportIntent = {
  create(
    sourceEntryId: string,
    targetKind: WorldFolderEntryKind = WorldFolderEntryKind.Folder,
  ): WorldExportIntent {
    return { sourceEntryId, targetKind };
  },
};
