import { _decorator, Component, Node, UITransform, resources, SpriteFrame, isValid } from 'cc';
import { MusicEditorSession } from './src/musicEditor/MusicEditorSession';
import { createDefaultMusicProject } from './src/musicEditor/MusicProjectData';
import { MusicEditorView } from './src/presentation/MusicEditorView';
import { GuidanceEditorView } from './src/presentation/GuidanceEditorView';
import { GuidanceEditorSession, parseChartSourceData } from './src/editor/GuidanceEditorSession';
import type { ChartSourceData } from './src/editor/GuidanceEditorSession';
import { createDefaultKeyboardPadLayout } from './src/chart/KeyboardPadLayout';
import { applyFolderTheme } from './src/presentation/FolderTheme';

const { ccclass } = _decorator;

/** 音乐与引导线交接的组合根；独立会话，不创建 gameplay 或账本。 */
@ccclass('MusicEditorBuilder')
export class MusicEditorBuilder extends Component {
  private readonly layout = createDefaultKeyboardPadLayout();
  private session: MusicEditorSession | null = null;
  private guidanceSession: GuidanceEditorSession | null = null;
  private workspace: Node | null = null;
  private returnControl: HTMLButtonElement | null = null;

  start(): void {
    this.session = new MusicEditorSession(this.layout);
    this.session.submitMusicEditorIntent({ kind: 'LoadProject', project: createDefaultMusicProject(this.layout) });
    this.mountMusic();
  }

  private createWorkspace(name: string): Node {
    const workspace = new Node(name); workspace.layer = this.node.layer;
    const transform = this.node.getComponent(UITransform);
    workspace.addComponent(UITransform).setContentSize(transform?.width ?? 1920, transform?.height ?? 1080);
    this.node.addChild(workspace); this.workspace = workspace; return workspace;
  }

  private retireWorkspace(): void {
    if (this.workspace) { this.workspace.active = false; this.workspace.destroy(); this.workspace = null; }
    this.returnControl?.remove(); this.returnControl = null;
  }

  private mountMusic(): void {
    if (!this.session || !isValid(this, true) || !this.node.activeInHierarchy) { return; }
    this.guidanceSession = null;
    this.createWorkspace('MusicWorkspace').addComponent(MusicEditorView)
      .bindMusic(this.session, this.session, source => this.openGuidance(source), createDefaultMusicProject(this.layout));
  }

  private openGuidance(raw: ChartSourceData): void {
    const source = parseChartSourceData(raw, this.layout);
    const session = new GuidanceEditorSession(this.layout);
    session.submitEditorIntent({ kind: 'LoadSource', source });
    session.exportChart(); // 先验证真实消费者，失败时保留音乐工作区及草稿。
    this.retireWorkspace(); this.guidanceSession = session;
    this.scheduleOnce(() => {
      if (!isValid(this, true) || !this.node.activeInHierarchy || this.guidanceSession !== session) { return; }
      const workspace = this.createWorkspace('MusicGuidanceWorkspace');
      const view = workspace.addComponent(GuidanceEditorView); view.bindEditor(session, session, source);
      // 原有 Mock 按钮在本次绑定中重新导入的是生产源，适配文案与实际数据保持一致。
      const reload = document.querySelector<HTMLButtonElement>('#guidance-editor #load-mock');
      if (reload) { reload.textContent = '重新加载 MIDI 输出'; }
      resources.load('guidance/head-logo/spriteFrame', SpriteFrame, (error, logo) => {
        if (!error && logo && isValid(view, true) && workspace.activeInHierarchy) { view.bindHeadLogo(logo); }
      });
      const back = document.createElement('button'); back.id = 'music-return';
      back.textContent = '返回音乐项目';
      back.style.cssText = 'position:fixed;left:24px;bottom:120px;z-index:300;padding:9px 16px;border:1px solid var(--folder-border);background:var(--folder-panel);color:var(--folder-ink);font:14px var(--folder-font);cursor:pointer';
      applyFolderTheme(back);
      back.onclick = () => { this.retireWorkspace(); this.scheduleOnce(() => this.mountMusic(), 0); };
      document.body.appendChild(back); this.returnControl = back;
    }, 0);
  }

  onDisable(): void { this.returnControl?.remove(); this.returnControl = null; }
  onDestroy(): void { this.unscheduleAllCallbacks(); this.retireWorkspace(); this.session = null; this.guidanceSession = null; }
}
