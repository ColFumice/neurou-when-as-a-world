import type { EditorCatalog, EditorFolderEntry } from './FolderCatalog';
import { applyFolderTheme } from './FolderTheme';

// AC-29 灰盒：目录结构和可用性均由只读 catalog 提供。
export class EditorFolderView {
  private root: HTMLElement | null = null;

  constructor(
    private readonly catalog: EditorCatalog,
    private readonly openEditor: (entry: EditorFolderEntry) => void,
    private readonly back: () => void,
  ) {}

  mount(): void {
    if (typeof document === 'undefined' || this.root) { return; }
    const root = document.createElement('section');
    root.id = 'editor-folder';
    applyFolderTheme(root);
    root.setAttribute('aria-label', '世界编辑器文件夹');
    root.innerHTML = `
      <style>
      #editor-folder{position:fixed;inset:0;z-index:100;background:var(--folder-bg);color:var(--folder-ink);font:15px/1.5 var(--folder-font);overflow:auto}
      #editor-folder *{box-sizing:border-box}#editor-folder .folder-shell{width:min(100% - 48px,1080px);height:100%;min-height:360px;margin:auto;display:flex;flex-direction:column;padding:24px 0}
      #editor-folder header{display:flex;align-items:center;gap:20px;padding-bottom:16px;border-bottom:1px solid var(--folder-border);flex:none}#editor-folder h1{font-size:24px;line-height:1.3;margin:0}
      #editor-folder .folder-note{color:var(--folder-muted);font-size:13px;margin-top:6px}#editor-folder button{font:inherit;cursor:pointer;color:var(--folder-ink);background:var(--folder-panel);border:1px solid var(--folder-border);border-radius:4px;padding:8px 14px}
      #editor-folder button:hover{background:#353535;border-color:var(--folder-muted)}#editor-folder button:focus-visible,#editor-folder summary:focus-visible{outline:2px solid var(--folder-ink);outline-offset:2px}
      #editor-folder main{flex:1;min-height:0;overflow:auto;margin:16px 0;padding-right:8px}#editor-folder details{margin:0}#editor-folder summary{cursor:pointer;min-height:30px;padding:2px 8px;line-height:26px;border-radius:3px}
      #editor-folder summary:hover{background:var(--folder-panel)}#editor-folder .folder-children{margin-left:20px;border-left:1px solid var(--folder-border);padding-left:12px}
      #editor-folder .folder-item{display:flex;align-items:center;gap:12px;min-height:30px;padding:2px 8px;text-align:left;width:100%;border:0;background:transparent;line-height:26px}
      #editor-folder summary .folder-item{display:inline-flex;width:auto;padding:0 4px;vertical-align:middle}#editor-folder .folder-badge{font-size:12px;color:var(--folder-muted);margin-left:12px}
      #editor-folder .folder-item .folder-badge{margin-left:auto}#editor-folder .folder-implemented{font-weight:600}#editor-folder .folder-implemented .folder-badge{color:var(--folder-ink)}
      #editor-folder footer{border-top:1px solid var(--folder-border);padding-top:12px;flex:none}#folder-status{color:var(--folder-ink);min-height:24px}
      @media(max-width:760px){#editor-folder .folder-shell{width:calc(100% - 24px);padding:16px 0}#editor-folder header{gap:12px}#editor-folder h1{font-size:20px}#editor-folder .folder-children{margin-left:10px;padding-left:8px}#editor-folder .folder-badge{margin-left:8px}#editor-folder .folder-item{gap:6px;font-size:14px}}
      @media(max-height:600px){#editor-folder .folder-shell{padding:12px 0}#editor-folder header{padding-bottom:10px}#editor-folder main{margin:10px 0}}
      </style>
      <div class="folder-shell"><header><button id="folder-back" type="button">返回世界文件夹</button><div><h1>世界编辑器文件夹</h1><div class="folder-note">点击目录展开或收起；已实现的编辑器可直接打开。</div></div></header><main id="editor-directory" aria-label="编辑器目录树"></main><footer><div id="folder-status" role="status" aria-live="polite">请选择编辑器。</div></footer></div>`;
    this.root = root;
    root.querySelector('#editor-directory')!.appendChild(this.renderEntry(this.catalog.getRoot()));
    root.querySelector<HTMLButtonElement>('#folder-back')!.onclick = () => this.back();
    document.body.appendChild(root);
  }

  private renderEntry(entry: EditorFolderEntry): HTMLElement {
    if (!entry.children.length) { return this.entryButton(entry); }
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    if (entry.availability === 'Folder') {
      summary.dataset.entryId = entry.entryId;
      summary.textContent = entry.title;
      const badge = document.createElement('span');
      badge.className = 'folder-badge';
      badge.textContent = '文件夹';
      summary.appendChild(badge);
    } else {
      const button = this.entryButton(entry);
      button.onclick = (click) => {
        click.preventDefault();
        click.stopPropagation();
        this.activate(entry);
        if (entry.availability === 'Placeholder') { details.open = !details.open; }
      };
      summary.appendChild(button);
      summary.onclick = () => {
        if (entry.availability === 'Placeholder') { this.activate(entry); }
      };
    }
    const children = document.createElement('div');
    children.className = 'folder-children';
    for (const child of entry.children) { children.appendChild(this.renderEntry(child)); }
    details.append(summary, children);
    return details;
  }

  private entryButton(entry: EditorFolderEntry): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'folder-item' + (entry.availability === 'Implemented' ? ' folder-implemented' : '');
    button.dataset.entryId = entry.entryId;
    const title = document.createElement('span');
    title.textContent = entry.title;
    const badge = document.createElement('span');
    badge.className = 'folder-badge';
    badge.textContent = entry.availability === 'Implemented' ? '已实现 · 打开' : '暂未实现';
    button.append(title, badge);
    button.onclick = () => this.activate(entry);
    return button;
  }

  private activate(entry: EditorFolderEntry): void {
    if (entry.availability === 'Implemented') {
      this.openEditor(entry);
    } else if (entry.availability === 'Placeholder') {
      this.root!.querySelector('#folder-status')!.textContent = entry.title + '：暂未实现';
    }
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
  }
}
