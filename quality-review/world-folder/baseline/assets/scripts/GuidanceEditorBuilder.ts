import { _decorator, Component, resources, JsonAsset, SpriteFrame } from 'cc';
import { GuidanceEditorSession } from './src/editor/GuidanceEditorSession';
import type { ChartSourceData } from './src/editor/GuidanceEditorSession';
import { createDefaultKeyboardPadLayout } from './src/chart/KeyboardPadLayout';
import { GuidanceEditorView } from './src/presentation/GuidanceEditorView';
const { ccclass } = _decorator;

/** 独立组合根，不创建世界 director 或账本。 */
@ccclass('GuidanceEditorBuilder')
export class GuidanceEditorBuilder extends Component {
  private session: GuidanceEditorSession | null = null;
  start(): void {
    this.session = new GuidanceEditorSession(createDefaultKeyboardPadLayout());
    resources.load('editor/mock_midi', JsonAsset, (error, asset) => {
      if (error || !asset) { console.error('编辑器 mock 资源加载失败',error);return; }
      const view = this.node.addComponent(GuidanceEditorView); view.bindEditor(this.session!,this.session!,asset.json as ChartSourceData);
      resources.load('guidance/head-logo/spriteFrame', SpriteFrame, (logoError, logo) => {
        if (logoError || !logo) { console.error('编辑器 Head LOGO 加载失败', logoError); return; }
        view.bindHeadLogo(logo);
      });
    });
  }
}
