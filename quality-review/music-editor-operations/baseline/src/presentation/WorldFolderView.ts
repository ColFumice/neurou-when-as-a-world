import type { WorldFolderEntry, WorldFolderReader } from './FolderCatalog';
import { applyFolderTheme } from './FolderTheme';

// AC-29 灰盒：只读取目录并发出导航回调，不持有世界运行实例。
export class WorldFolderView {
  private root: HTMLElement | null = null;

  constructor(
    private readonly reader: WorldFolderReader,
    private readonly openWorld: (entry: WorldFolderEntry) => void,
    private readonly openEditors: () => void,
  ) {}

  mount(): void {
    if (typeof document === 'undefined' || this.root) { return; }
    const root = document.createElement('section');
    root.id = 'world-folder';
    applyFolderTheme(root);
    root.setAttribute('aria-label', '世界文件夹');
    root.innerHTML = `
      <style>
      #world-folder{position:fixed;inset:0;z-index:100;background:var(--folder-bg);color:var(--folder-ink);font:16px/1.5 var(--folder-font);overflow:auto}
      #world-folder *{box-sizing:border-box}
      #world-folder .folder-shell{width:min(100% - 48px,1080px);min-height:100%;margin:auto;display:flex;flex-direction:column;padding:36px 0}
      #world-folder header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--folder-border);padding-bottom:20px}
      #world-folder h1{font-size:26px;line-height:1.3;margin:4px 0}#world-folder h2{font-size:18px;font-weight:500;margin:0 0 18px}
      #world-folder .folder-brand,#world-folder .folder-account,#world-folder .folder-description,#world-folder footer{color:var(--folder-muted)}
      #world-folder .folder-account{overflow-wrap:anywhere;text-align:right;max-width:50%}
      #world-folder main{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:24px;margin:auto 0;padding:32px 0}
      #world-folder button{font:inherit;cursor:pointer;color:var(--folder-ink);background:var(--folder-panel);border:1px solid var(--folder-border);border-radius:4px;padding:24px;text-align:left;width:100%;min-height:180px}
      #world-folder button:hover{background:#353535;border-color:var(--folder-muted)}#world-folder button:focus-visible{outline:2px solid var(--folder-ink);outline-offset:4px}
      #world-folder .folder-title{display:block;font-size:24px;font-weight:500;margin-bottom:14px}
      #world-folder .folder-description{display:block;font-size:15px}
      #world-folder .folder-worlds{display:grid;gap:16px}#world-folder footer{border-top:1px solid var(--folder-border);padding-top:20px;font-size:14px}
      @media(max-width:760px){#world-folder .folder-shell{width:calc(100% - 32px);padding:24px 0}#world-folder header{align-items:flex-start}#world-folder h1{font-size:23px}#world-folder main{grid-template-columns:1fr;gap:28px}#world-folder button{min-height:140px;padding:20px}#world-folder .folder-title{font-size:21px}}
      @media(max-height:600px){#world-folder .folder-shell{padding:18px 0}#world-folder main{padding:20px 0}#world-folder button{min-height:135px}}
      </style>
      <div class="folder-shell">
        <header><div><div class="folder-brand">雨若</div><h1>世界文件夹</h1></div><div class="folder-account" id="folder-account"></div></header>
        <main><div><h2>我的世界</h2><div class="folder-worlds" id="folder-worlds"></div></div><div><h2>创作</h2><button id="open-editor-folder" type="button"><span class="folder-title">世界编辑器文件夹</span><span class="folder-description">打开编辑器目录</span></button></div></main>
        <footer>选择世界继续，或打开世界编辑器文件夹。</footer>
      </div>`;
    this.root = root;
    root.querySelector('#folder-account')!.textContent = '当前账号：' + this.reader.getAccountId();
    const worlds = root.querySelector('#folder-worlds')!;
    for (const entry of this.reader.getWorlds()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'open-initial-world';
      button.dataset.worldId = entry.worldId;
      const title = document.createElement('span');
      title.className = 'folder-title';
      title.textContent = entry.title;
      const description = document.createElement('span');
      description.className = 'folder-description';
      description.textContent = entry.description;
      button.append(title, description);
      button.onclick = () => this.openWorld(entry);
      worlds.appendChild(button);
    }
    root.querySelector<HTMLButtonElement>('#open-editor-folder')!.onclick = () => this.openEditors();
    document.body.appendChild(root);
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
  }
}
