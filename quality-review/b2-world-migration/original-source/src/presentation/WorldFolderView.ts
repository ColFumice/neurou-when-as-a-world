import type { WorldFolderEntry, WorldFolderReader } from './FolderCatalog';
import type {
  WorldFolderPort, AccountMilestoneReader, WorldStateCaptureResult, WorldStateRestoreResult, WorldForkAvailability,
} from '../director/IntentPort';
import { applyFolderTheme } from './FolderTheme';

// AC-29 灰盒：只读取目录并发出导航回调，不持有世界运行实例。
export class WorldFolderView {
  private root: HTMLElement | null = null;
  private forkPending = false;

  constructor(
    private readonly reader: WorldFolderReader,
    private readonly openWorld: (entry: WorldFolderEntry) => void,
    private readonly openEditors: () => void,
    private readonly port: WorldFolderPort,
    private readonly reload: () => void,
    private readonly milestones?: AccountMilestoneReader,
    private readonly inspectWorldState?: (worldId: string) => WorldStateCaptureResult,
    private readonly checkWorldRestore?: (worldId: string) => WorldStateRestoreResult,
    private readonly forkAvailability?: () => WorldForkAvailability,
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
      #world-folder .folder-actions{display:flex;gap:10px;padding:10px 24px;border-top:1px solid var(--folder-border);flex-wrap:wrap;align-items:center}#world-folder .folder-actions button:disabled{cursor:default;opacity:.5}#world-folder .fork-hint{font-size:13px;color:var(--folder-muted);flex-basis:100%}
      #world-folder .folder-title{overflow-wrap:anywhere}#world-folder .folder-description{overflow-wrap:anywhere;white-space:pre-wrap}
      #world-folder .folder-panel{padding:20px;background:var(--folder-panel);border:1px solid var(--folder-muted);border-radius:4px;margin-bottom:16px}
      #world-folder .folder-panel h3{margin:0 0 12px;font-size:19px}#world-folder label{display:grid;gap:6px;margin-bottom:12px}
      #world-folder input,#world-folder textarea{width:100%;font:inherit;color:inherit;background:var(--folder-bg);border:1px solid var(--folder-border);border-radius:4px;padding:9px}
      #world-folder textarea{resize:vertical;min-height:72px}#world-folder .folder-panel-actions{display:flex;gap:10px}
      #world-folder #world-folder-status{min-height:24px;margin:0 0 12px;color:#f0d3a0;overflow-wrap:anywhere}
      #world-folder .folder-editor{margin-top:16px}#world-folder footer{margin-top:auto}
      #world-folder .folder-foundation-summary{display:flex;gap:12px 28px;flex-wrap:wrap;padding-top:16px;font-size:14px;color:var(--folder-muted)}
      #world-folder .folder-state-panel{margin-top:18px;font-size:14px;padding:16px}
      #world-folder .folder-state-panel h3{font-size:17px}#world-folder .folder-state-panel ul{padding-left:20px;margin:12px 0}
      #world-folder .folder-state-panel li{margin-bottom:8px;overflow-wrap:anywhere}
      #world-folder .folder-state-panel p{overflow-wrap:anywhere}
      @media(max-width:760px){#world-folder .folder-shell{width:calc(100% - 32px);padding:24px 0}#world-folder header{align-items:flex-start}#world-folder h1{font-size:23px}#world-folder main{grid-template-columns:1fr;gap:28px}#world-folder button{min-height:140px;padding:20px}#world-folder .folder-title{font-size:21px}}
      @media(max-height:600px){#world-folder .folder-shell{padding:18px 0}#world-folder main{padding:20px 0}#world-folder button{min-height:135px}}
      </style>
      <div class="folder-shell">
        <header><div><div class="folder-brand">雨若</div><h1>世界文件夹</h1></div><div class="folder-account" id="folder-account"></div></header>
        <div class="folder-foundation-summary"><span id="account-copy-permission">复制权限：尚未读取</span><span id="world-fork-availability" data-availability="NotImplemented">分叉功能尚未实施</span></div>
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
        </div><div><h2>创作</h2><button class="folder-editor" id="open-editor-folder" type="button"><span class="folder-title">世界编辑器文件夹</span><span class="folder-description">打开编辑器目录</span></button>
          <section id="world-state-diagnostics" class="folder-panel folder-state-panel" aria-labelledby="world-state-title" hidden>
            <h3 id="world-state-title">世界状态诊断</h3><p id="world-state-world-title"></p>
            <p id="world-state-capture-kind" role="status"></p><ul id="world-state-diagnostic-list"></ul>
            <p>打开世界以恢复稳定记忆。</p>
            <button class="folder-small" id="world-state-restore-reject" type="button">检查恢复可用性</button>
            <p id="world-state-restore-status" role="status" aria-live="polite"></p>
          </section>
        </div></main>
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
    if (this.forkAvailability && this.forkPending) { this.root.dataset.pending = 'true'; }
    else { delete this.root.dataset.pending; }
    this.refreshMilestones();
    const availability = this.refreshForkAvailability();
    this.root.querySelector<HTMLElement>('#world-state-diagnostics')!.hidden = true;
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
      if (this.forkAvailability) {
        const eligibility = this.readForkEligibility(entry, availability);
        fork.disabled = this.forkPending || !eligibility.available;
        fork.dataset.available = String(eligibility.available);
        fork.title = eligibility.message;
        const hint = document.createElement('span'); hint.className = 'fork-hint'; hint.textContent = eligibility.message;
        actions.appendChild(hint);
      }
      fork.onclick = async () => {
        if (this.forkPending) { return; }
        this.forkPending = true;
        if (this.forkAvailability) { this.refresh(); this.showStatus('正在分叉世界…'); }
        try {
          await Promise.resolve(this.port.submitWorldFolderIntent({ kind: 'WorldFork', worldId: entry.worldId }));
          if (this.forkAvailability && this.root) { this.reload(); this.showStatus('世界已分叉，选择新的世界继续。'); }
        }
        catch (error) {
          if (error instanceof Error && error.message === '分叉尚未开放') {
            this.refreshMilestones();
            const permission = this.root!.querySelector('#account-copy-permission')!.textContent;
            this.showStatus(permission + '；分叉功能尚未实施。');
          } else { this.showStatus(String(error)); }
        } finally {
          this.forkPending = false;
          if (this.forkAvailability) { this.refresh(); }
        }
      };
      const remove = this.actionButton('删除', 'delete-world', entry.worldId);
      remove.onclick = () => this.confirmDelete(entry);
      actions.append(fork, remove);
      if (this.inspectWorldState) {
        const inspect = this.actionButton('状态诊断', 'inspect-world-state', entry.worldId);
        inspect.onclick = () => this.showStateDiagnostics(entry);
        actions.appendChild(inspect);
      }
      card.append(button, actions); worlds.appendChild(card);
    }
    if (!worlds.childElementCount) { worlds.textContent = '还没有世界，创建一个开始。'; }
  }

  showStatus(message: string): void {
    const status = this.root?.querySelector('#world-folder-status');
    if (status) { status.textContent = message; }
  }

  private refreshMilestones(): void {
    const label = this.root!.querySelector<HTMLElement>('#account-copy-permission')!;
    delete label.dataset.firstWorldCleared; delete label.dataset.copyPermission;
    try {
      if (!this.milestones) { throw new Error('账号里程碑读取接口未接线'); }
      const snapshot = this.milestones.getMilestoneSnapshot();
      label.textContent = '复制权限：' + (snapshot.CopyPermission ? '已取得' : '未取得');
      label.dataset.firstWorldCleared = String(snapshot.FirstWorldCleared);
      label.dataset.copyPermission = String(snapshot.CopyPermission);
      label.dataset.readState = 'Ready';
    } catch (error) {
      label.textContent = '复制权限读取失败：' + String(error);
      label.dataset.readState = 'Error';
    }
  }

  private refreshForkAvailability(): WorldForkAvailability | null {
    const label = this.root!.querySelector<HTMLElement>('#world-fork-availability')!;
    try {
      const availability = this.forkAvailability?.() ?? 'NotImplemented';
      label.dataset.availability = availability;
      label.textContent = availability === 'Implemented' ? '完整的普通世界可以分叉' : '分叉功能尚未实施';
      return availability;
    } catch (error) {
      label.dataset.availability = 'Unavailable'; label.textContent = '分叉状态暂时无法读取';
      return null;
    }
  }

  private readForkEligibility(entry: WorldFolderEntry, availability: WorldForkAvailability | null): {
    readonly available: boolean; readonly message: string;
  } {
    if (availability !== 'Implemented') { return { available: false, message: availability === null ? '分叉状态暂时无法读取，请刷新重试。' : '分叉功能尚未实施。' }; }
    try {
      const permission = this.milestones?.getMilestoneSnapshot();
      if (!permission || permission.accountId !== this.reader.getAccountId()) { throw new Error('复制权限身份不匹配'); }
      if (!permission.CopyPermission) { return { available: false, message: '完成首个世界后取得复制权限。' }; }
      const capture = this.inspectWorldState?.(entry.worldId);
      if (capture?.kind !== 'Complete') { return { available: false, message: '先在世界中留下完整的稳定记忆，再回来分叉。' }; }
      if (capture.snapshot.accountId !== this.reader.getAccountId() || capture.snapshot.worldId !== entry.worldId) { throw new Error('世界记忆身份不匹配'); }
      if (capture.snapshot.worldKind !== 'Primary' || capture.snapshot.shoreOrigin !== null) {
        return { available: false, message: '当前仅支持普通世界分叉。' };
      }
      return { available: true, message: '保留这段世界记忆，分叉成一个新的世界。' };
    } catch (error) { return { available: false, message: '世界记忆或复制权限暂时无法读取，请刷新重试。' }; }
  }

  private showStateDiagnostics(entry: WorldFolderEntry): void {
    if (!this.root || !this.inspectWorldState) { return; }
    const panel = this.root.querySelector<HTMLElement>('#world-state-diagnostics')!;
    const status = panel.querySelector<HTMLElement>('#world-state-capture-kind')!;
    const list = panel.querySelector('#world-state-diagnostic-list')!;
    const restoreStatus = panel.querySelector<HTMLElement>('#world-state-restore-status')!;
    const restore = panel.querySelector<HTMLButtonElement>('#world-state-restore-reject')!;
    panel.hidden = false; list.replaceChildren(); restoreStatus.textContent = '';
    delete restoreStatus.dataset.kind; delete status.dataset.kind;
    panel.querySelector('#world-state-world-title')!.textContent = entry.title;
    try {
      const result = this.inspectWorldState(entry.worldId);
      status.dataset.kind = result.kind;
      status.textContent = result.kind === 'Incomplete' ? 'Incomplete · 状态捕获不完整' : 'Complete · 状态捕获完整';
      if (result.kind === 'Incomplete') {
        for (const issue of result.issues) {
          const item = document.createElement('li');
          item.dataset.section = issue.section; item.dataset.reason = issue.reason;
          item.textContent = issue.detail; list.appendChild(item);
        }
      }
    } catch (error) { status.textContent = '状态诊断读取失败：' + String(error); }
    restore.disabled = !this.checkWorldRestore;
    restore.onclick = () => {
      try {
        const result = this.checkWorldRestore!(entry.worldId);
        restoreStatus.dataset.kind = result.kind;
        restoreStatus.textContent = result.kind === 'Rejected'
          ? '此处未激活世界。' + result.issues.map(issue => issue.detail).join('；') + ' 请打开世界以恢复稳定记忆。'
          : '完整恢复已完成';
      } catch (error) {
        delete restoreStatus.dataset.kind;
        restoreStatus.textContent = '恢复可用性检查失败：' + String(error);
      }
    };
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
    confirmation.querySelector<HTMLButtonElement>('#confirm-delete-world')!.onclick = async () => {
      try {
        await Promise.resolve(this.port.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId: entry.worldId }));
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
