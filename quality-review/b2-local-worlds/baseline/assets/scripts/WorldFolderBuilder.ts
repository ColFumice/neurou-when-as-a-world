import { _decorator, Component, Node, UITransform, Canvas, Camera, director, Director, isValid } from 'cc';
import { AccountStartupSession } from './src/director/AccountStartupSession';
import { WorldFolderView } from './src/presentation/WorldFolderView';
import { EditorFolderView } from './src/presentation/EditorFolderView';
import { AccountStartupStorage, FolderStartupView } from './src/presentation/FolderStartupView';
import { applyFolderTheme } from './src/presentation/FolderTheme';
import { createWorldFolderReader, editorCatalog } from './src/presentation/FolderCatalog';
import type { EditorFolderEntry, WorldFolderEntry } from './src/presentation/FolderCatalog';
import { GuidanceEditorBuilder } from './GuidanceEditorBuilder';
import { MusicEditorBuilder } from './MusicEditorBuilder';

const { ccclass } = _decorator;

/** Composition root for entry routing. No gameplay objects exist before world selection. */
@ccclass('WorldFolderBuilder')
export class WorldFolderBuilder extends Component {
  private readonly storage = new AccountStartupStorage();
  private readonly startup = new AccountStartupSession(snapshot => this.storage.saveCompletion(snapshot));
  private readonly startupView = new FolderStartupView();
  private folderView: WorldFolderView | null = null;
  private catalogView: EditorFolderView | null = null;
  private runtimeNode: Node | null = null;
  private worldFactory: ((node: Node) => void) | null = null;
  private exitControl: HTMLButtonElement | null = null;
  private retiring = false;
  private folderPending = false;

  bindWorldFactory(factory: (node: Node) => void): void { this.worldFactory = factory; }

  start(): void {
    this.startupView.showLogin(accountId => {
      try {
        // Storage failure must not be treated as an uncompleted or completed milestone.
        const completed = this.storage.readCompletion(accountId);
        this.startup.submitStartupIntent({ kind: 'Login', accountId, PrologueCompleted: completed });
        if (completed) { this.showWorldFolder(); return; }
        this.startupView.showPrologue(accountId, this.startup.getPrologueText(), () => {
          try {
            this.startup.submitStartupIntent({ kind: 'CompletePrologue' });
            this.showWorldFolder();
          } catch (error) { this.startupView.showError('序章完成状态未能保存：' + String(error)); }
        });
      } catch (error) { this.startupView.showError('无法登录本地账号：' + String(error)); }
    });
  }

  private clearViews(): void {
    this.startupView.destroy(); this.folderView?.destroy(); this.catalogView?.destroy();
    this.folderView = null; this.catalogView = null;
  }

  private showWorldFolder(): void {
    this.clearViews();
    const accountId = this.startup.getStartupSnapshot().accountId;
    if (accountId === null) { return; }
    this.folderView = new WorldFolderView(createWorldFolderReader(accountId),
      entry => this.openWorld(entry), () => this.showEditorFolder());
    this.folderView.mount();
  }

  private showEditorFolder(): void {
    this.clearViews();
    this.catalogView = new EditorFolderView(editorCatalog, entry => this.openEditor(entry), () => this.showWorldFolder());
    this.catalogView.mount();
  }

  private createRuntime(name: string): Node {
    const node = new Node(name); node.layer = this.node.layer;
    const parentTransform = this.node.getComponent(UITransform) ?? this.node.parent?.getComponent(UITransform);
    node.addComponent(UITransform).setContentSize(parentTransform?.width ?? 1920, parentTransform?.height ?? 1080);
    const uiRoot = this.node.getComponent(Canvas) ? this.node : this.node.parent ?? this.node;
    uiRoot.addChild(node); this.runtimeNode = node; return node;
  }

  private openWorld(entry: WorldFolderEntry): void {
    if (this.retiring || this.runtimeNode || entry.worldId !== 'InitialWorld' || !this.worldFactory) { return; }
    this.clearViews(); this.worldFactory(this.createRuntime('InitialWorld'));
    this.showExitControl('退出世界 · 返回世界文件夹');
  }

  private openEditor(entry: EditorFolderEntry): void {
    if (this.retiring || this.runtimeNode || entry.availability !== 'Implemented' ||
        !['GuidanceEditor', 'MidiTrackEditor'].includes(entry.entryId)) { return; }
    this.clearViews();
    const runtime = this.createRuntime(entry.entryId);
    if (entry.entryId === 'MidiTrackEditor') { runtime.addComponent(MusicEditorBuilder); }
    else { runtime.addComponent(GuidanceEditorBuilder); }
    this.showExitControl('退出编辑器 · 返回世界文件夹');
  }

  private showExitControl(title: string): void {
    this.exitControl = document.createElement('button'); this.exitControl.id = 'folder-runtime-exit';
    this.exitControl.textContent = title;
    this.exitControl.style.cssText = 'position:fixed;right:18px;bottom:14px;z-index:300;padding:9px 16px;border:1px solid var(--folder-border);background:var(--folder-panel);color:var(--folder-ink);font:14px var(--folder-font);cursor:pointer;border-radius:4px';
    applyFolderTheme(this.exitControl);
    this.exitControl.onclick = () => this.exitRuntime(); document.body.appendChild(this.exitControl);
  }

  private exitRuntime(): void {
    if (!this.runtimeNode || this.retiring) { return; }
    this.retiring = true; this.exitControl?.remove(); this.exitControl = null;
    const runtime = this.runtimeNode; this.runtimeNode = null;
    // Deactivation stops FrameDriver/input synchronously; destruction removes media/DOM.
    runtime.active = false; runtime.destroy(); this.folderPending = true;
    director.once(Director.EVENT_AFTER_DRAW, this.finishRetirement, this);
  }

  private finishRetirement(): void {
    // Creator performs deferred destruction after update and before draw.
    this.retiring = false;
    const camera = this.node.getComponent(Canvas)?.cameraComponent ??
      this.node.parent?.getComponent(Canvas)?.cameraComponent ??
      this.node.getComponent(Camera) ?? this.node.parent?.getComponent(Camera);
    if (camera) { camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; }
    if (this.folderPending && isValid(this, true)) { this.folderPending = false; this.showWorldFolder(); }
  }

  onDestroy(): void {
    director.off(Director.EVENT_AFTER_DRAW, this.finishRetirement, this);
    this.clearViews(); this.exitControl?.remove(); this.exitControl = null;
    if (this.runtimeNode && isValid(this.runtimeNode, true)) {
      this.runtimeNode.active = false; this.runtimeNode.destroy(); this.runtimeNode = null;
    }
  }
}
