import { WorldFolderEntryKind } from './WorldFolderEntryKind';

/** P · console：自动导入意图；只描述来源，不执行文件操作。 */
export interface WorldImportAuto {
  readonly sourcePath: string;
  readonly detectedKind: WorldFolderEntryKind;
}

function kindFromPath(sourcePath: string): WorldFolderEntryKind | null {
  const trimmed = sourcePath.trim();
  if (trimmed.length === 0) return null;

  const normalized = trimmed.replace(/\\/g, '/');
  if (normalized.endsWith('/')) return WorldFolderEntryKind.Folder;

  const base = normalized.split('/').filter(Boolean).pop() ?? '';
  if (base.length === 0) return WorldFolderEntryKind.Folder;

  const dot = base.lastIndexOf('.');
  if (dot < 0) return WorldFolderEntryKind.Folder;

  const ext = base.slice(dot).toLowerCase();
  if (ext === '.exe' || ext === '.world') return WorldFolderEntryKind.WorldExe;
  if (ext === '.ini' || ext === '.json' || ext === '.cfg' || ext === '.toml') {
    return WorldFolderEntryKind.Settings;
  }
  return WorldFolderEntryKind.Other;
}

export const WorldImportAuto = {
  detectFromPath(sourcePath: string): WorldImportAuto | null {
    const detectedKind = kindFromPath(sourcePath);
    if (detectedKind === null) return null;
    return { sourcePath, detectedKind };
  },
};
