import type { WorldFolderEntry, WorldFolderReader } from './FolderCatalog';
import type { WorldFolderPort } from '../director/IntentPort';
import { applyFolderTheme } from './FolderTheme';

// AC-29 灰盒：只读取目录并发出导航回调，不持有世界运行实例。
export class WorldFolderView {
  private root: HTMLElement | null = null;

  constructor(
    private readonly reader: WorldFolderReader,
    private readonly openWorld: (entry: WorldFolderEntry) => void,
    private readonly openEditors: () => void,
    private readonly port: WorldFolderPort,
    private readonly reload: () => void,
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
      #world-folder [hidden]{display:none!important}
      #world-folder main{margin:24px 0 32px;padding:0}#world-folder h2{margin:0}
      #world-folder .folder-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}#world-folder .folder-toolbar h2{margin-right:auto}
      #world-folder button.folder-small{padding:8px 14px;min-height:0;width:auto}
      #world-folder .folder-world-card{background:var(--folder-panel);border:1px solid var(--folder-border);border-radius:4px;overflow:hidden}
      #world-folder button.folder-open{display:block;min-height:116px;border:0;border-radius:0;padding:20px 24px}
      #world-folder .folder-actions{display:flex;gap:10px;padding:10px 24px;border-top:1px solid var(--folder-border)}
      #world-folder .folder-title{overflow-wrap:anywhere}#world-folder .folder-description{overflow-wrap:anywhere;white-space:pre-wrap}
      #world-folder .folder-panel{padding:20px;background:var(--folder-panel);border:1px solid var(--folder-muted);border-radius:4px;margin-bottom:16px}
      #world-folder .folder-panel h3{margin:0 0 12px;font-size:19px}#world-folder label{display:grid;gap:6px;margin-bottom:12px}
      #world-folder input,#world-folder textarea{width:100%;font:inherit;color:inherit;background:var(--folder-bg);border:1px solid var(--folder-border);border-radius:4px;padding:9px}
      #world-folder textarea{resize:vertical;min-height:72px}#world-folder .folder-panel-actions{display:flex;gap:10px}
      #world-folder #world-folder-status{min-height:24px;margin:0 0 12px;color:#f0d3a0;overflow-wrap:anywhere}
      #world-folder .folder-editor{margin-top:16px}#world-folder footer{margin-top:auto}
      @media(max-width:760px){#world-folder .folder-shell{width:calc(100% - 32px);padding:24px 0}#world-folder header{align-items:flex-start}#world-folder h1{font-size:23px}#world-folder main{grid-template-columns:1fr;gap:28px}#world-folder button{min-height:140px;padding:20px}#world-folder .folder-title{font-size:21px}}
      @media(max-height:600px){#world-folder .folder-shell{padding:18px 0}#world-folder main{padding:20px 0}#world-folder button{min-height:135px}}
      </style>
      <div class="folder-shell">
        <header><div><div class="folder-brand">雨若</div><h1>世界文件夹</h1></div><div class="folder-account" id="folder-account"></div></header>
        <main><div>
          <div class="folder-toolbar"><h2>我的世界</h2><button class="folder-small" id="refresh-worlds" type="button">刷新</button><button class="folder-small" id="create-world" type="button">新建世界</button></div>
          <p id="world-folder-status" role="status" aria-live="polite"></p>
          <form id="world-create-form" class="folder-panel" hidden>
            <h3>新建世界</h3>
            <label for="world-title">名称<input id="world-title" maxlength="80" required autocomplete="off"></label>
            <label for="world-description">说明<textarea id="world-description" maxlength="300"></textarea></label>
            <div class="folder-panel-actions"><button class="folder-small" id="confirm-create-world" type="submit">创建</button><button class="folder-small" id="cancel-create-world" type="button">取消</button></div>
          </form>
          <section id="world-delete-confirm" class="folder-panel" role="alertdialog" aria-labelledby="world-delete-title" hidden>
            <h3 id="world-delete-title">删除世界</h3><p id="world-delete-message"></p>
            <p>从列表移除，保留已产生的账户通关记录。</p>
            <div class="folder-panel-actions"><button class="folder-small" id="confirm-delete-world" type="button">确认删除</button><button class="folder-small" id="cancel-delete-world" type="button">取消</button></div>
          </section>
          <div class="folder-worlds" id="folder-worlds"></div>
        </div><div><h2>创作</h2><button class="folder-editor" id="open-editor-folder" type="button"><span class="folder-title">世界编辑器文件夹</span><span class="folder-description">打开编辑器目录</span></button></div></main>
        <footer>选择世界继续，或新建一个世界。世界编辑器文件夹独立于世界。</footer>
      </div>`;
    this.root = root;
    root.querySelector('#folder-account')!.textContent = '当前账号：' + this.reader.getAccountId();
    const form = root.querySelector<HTMLFormElement>('#world-create-form')!;
    const confirmation = root.querySelector<HTMLElement>('#world-delete-confirm')!;
    root.querySelector<HTMLButtonElement>('#create-world')!.onclick = () => {
      confirmation.hidden = true; form.hidden = false;
      root.querySelector<HTMLInputElement>('#world-title')!.focus();
    };
    root.querySelector<HTMLButtonElement>('#cancel-create-world')!.onclick = () => { form.hidden = true; };
    form.onsubmit = event => {
      event.preventDefault();
      try {
        this.port.submitWorldFolderIntent({ kind: 'CreateWorld',
          title: root.querySelector<HTMLInputElement>('#world-title')!.value,
          description: root.querySelector<HTMLTextAreaElement>('#world-description')!.value });
        form.reset(); form.hidden = true; this.refresh(); this.showStatus('世界已创建');
      } catch (error) { this.showStatus(String(error)); }
    };
    root.querySelector<HTMLButtonElement>('#cancel-delete-world')!.onclick = () => { confirmation.hidden = true; };
    root.querySelector<HTMLButtonElement>('#refresh-worlds')!.onclick = () => this.reload();
    root.querySelector<HTMLButtonElement>('#open-editor-folder')!.onclick = () => this.openEditors();
    this.refresh();
    document.body.appendChild(root);
  }

  refresh(): void {
    if (!this.root) { return; }
    const worlds = this.root.querySelector('#folder-worlds')!;
    worlds.replaceChildren();
    for (const entry of this.reader.getWorlds()) {
      const card = document.createElement('article');
      card.className = 'folder-world-card'; card.dataset.worldId = entry.worldId;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'folder-open';
      if (entry.worldId === 'InitialWorld') { button.id = 'open-initial-world'; }
      button.dataset.action = 'open-world';
      button.dataset.worldId = entry.worldId;
      const title = document.createElement('span');
      title.className = 'folder-title';
      title.textContent = entry.title;
      const description = document.createElement('span');
      description.className = 'folder-description';
      description.textContent = entry.description;
      button.append(title, description);
      button.onclick = () => this.openWorld(entry);
      const actions = document.createElement('div'); actions.className = 'folder-actions';
      const fork = this.actionButton('分叉', 'fork-world', entry.worldId);
      fork.onclick = () => {
        try { this.port.submitWorldFolderIntent({ kind: 'WorldFork', worldId: entry.worldId }); }
        catch (error) { this.showStatus(String(error)); }
      };
      const remove = this.actionButton('删除', 'delete-world', entry.worldId);
      remove.onclick = () => this.confirmDelete(entry);
      actions.append(fork, remove); card.append(button, actions); worlds.appendChild(card);
    }
    if (!worlds.childElementCount) { worlds.textContent = '还没有世界，创建一个开始。'; }
  }

  showStatus(message: string): void {
    const status = this.root?.querySelector('#world-folder-status');
    if (status) { status.textContent = message; }
  }

  private actionButton(title: string, action: string, worldId: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'folder-small'; button.textContent = title;
    button.dataset.action = action; button.dataset.worldId = worldId;
    return button;
  }

  private confirmDelete(entry: WorldFolderEntry): void {
    if (!this.root) { return; }
    this.root.querySelector<HTMLFormElement>('#world-create-form')!.hidden = true;
    const confirmation = this.root.querySelector<HTMLElement>('#world-delete-confirm')!;
    confirmation.querySelector('#world-delete-message')!.textContent = '删除“' + entry.title + '”？';
    confirmation.hidden = false;
    confirmation.querySelector<HTMLButtonElement>('#confirm-delete-world')!.onclick = () => {
      try {
        this.port.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: entry.worldId });
        confirmation.hidden = true; this.refresh(); this.showStatus('世界已从列表移除');
      } catch (error) { this.showStatus(String(error)); }
    };
    confirmation.querySelector<HTMLButtonElement>('#cancel-delete-world')!.focus();
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
  }
}
