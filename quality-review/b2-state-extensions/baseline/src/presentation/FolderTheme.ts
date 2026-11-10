// AC-29：文件夹界面共享的可替换灰盒表现配置，不进入逻辑域。
export interface FolderPresentationTheme {
  readonly background: string;
  readonly panel: string;
  readonly foreground: string;
  readonly muted: string;
  readonly border: string;
  readonly fontFamily: string;
}

export const folderPresentationTheme: FolderPresentationTheme = Object.freeze({
  background: '#191919',
  panel: '#292929',
  foreground: '#eee',
  muted: '#aaa',
  border: '#666',
  fontFamily: 'system-ui,sans-serif',
});

export function applyFolderTheme(root: HTMLElement): void {
  root.style.setProperty('--folder-bg', folderPresentationTheme.background);
  root.style.setProperty('--folder-panel', folderPresentationTheme.panel);
  root.style.setProperty('--folder-ink', folderPresentationTheme.foreground);
  root.style.setProperty('--folder-muted', folderPresentationTheme.muted);
  root.style.setProperty('--folder-border', folderPresentationTheme.border);
  root.style.setProperty('--folder-font', folderPresentationTheme.fontFamily);
}
