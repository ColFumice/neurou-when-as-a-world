// 世界与编辑器目录的只读 presentation 数据；组合根注入，零引擎依赖。
export type WorldFolderEntry = {
  readonly worldId: 'InitialWorld';
  readonly title: string;
  readonly description: string;
};

export interface WorldFolderReader {
  getAccountId(): string;
  getWorlds(): readonly WorldFolderEntry[];
}

export interface EditorFolderEntry {
  readonly entryId: string;
  readonly title: string;
  readonly availability: 'Folder' | 'Implemented' | 'Placeholder';
  readonly children: readonly EditorFolderEntry[];
}

export interface EditorCatalog {
  getRoot(): EditorFolderEntry;
}

export const InitialWorld: WorldFolderEntry = Object.freeze({
  worldId: 'InitialWorld',
  title: '初始世界',
  description: '箱庭 · 深痕 · 解谜链 · 引导线演奏',
});

export function createWorldFolderReader(accountId: string): WorldFolderReader {
  const worlds: readonly WorldFolderEntry[] = Object.freeze([InitialWorld]);
  return Object.freeze({
    getAccountId: (): string => accountId,
    getWorlds: (): readonly WorldFolderEntry[] => worlds,
  });
}

function createEditorFolderEntry(
  entryId: string,
  title: string,
  availability: EditorFolderEntry['availability'],
  children: readonly EditorFolderEntry[] = [],
): EditorFolderEntry {
  return Object.freeze({ entryId, title, availability, children: Object.freeze([...children]) });
}

const editorRoot = createEditorFolderEntry('EditorRoot', '编辑器', 'Folder', [
  createEditorFolderEntry('MusicEditor', '音乐编辑器', 'Folder', [
    createEditorFolderEntry('RgbWavetableEditor', 'RGB波表编辑器', 'Placeholder'),
    createEditorFolderEntry('GridEditor', '网格编辑器', 'Placeholder'),
    createEditorFolderEntry('MidiTrackEditor', 'MIDI以及音轨编辑器', 'Implemented'),
  ]),
  createEditorFolderEntry('MapEditor', '地图编辑器', 'Placeholder', [
    createEditorFolderEntry('NarrativeEventEditor', '事件编辑器', 'Placeholder'),
    createEditorFolderEntry('StoryEditor', '剧情编辑器', 'Placeholder', [
      createEditorFolderEntry('PasserbyEditor', '路人编辑器', 'Placeholder'),
      createEditorFolderEntry('SubtitleEditor', '字幕编辑器', 'Placeholder'),
    ]),
  ]),
  createEditorFolderEntry('ChartEditor', '谱面编辑器', 'Folder', [
    createEditorFolderEntry('GuidanceEditor', '引导线编辑器', 'Implemented', [
      createEditorFolderEntry('VideoTimingEditor', '视频卡点器', 'Placeholder'),
      createEditorFolderEntry('PositionEditor', '位置编辑器', 'Placeholder'),
    ]),
    createEditorFolderEntry('SpecialNarrativeEventEditor', '特殊事件编辑器', 'Placeholder'),
  ]),
]);

export const editorCatalog: EditorCatalog = Object.freeze({
  getRoot: (): EditorFolderEntry => editorRoot,
});
