// ============================================================
// P 表现层 · ChartPausePanel 谱面暂停面板（名库 v2.5）
//
// 依据：
// - HANDOFF-ROUND-18 任务 8：ESC 切换暂停，提供继续 / 退出；
//   暂停期间冻结媒体位置、判定窗口与进度，丢弃谱面输入。
// - 本面板只负责“显示 + 命中按钮”：
//     · 是否暂停由绑定的只读判定提供（R 边）；
//     · 继续 / 退出动作只调用绑定回调，回调由组合根接到
//       意图窄路；本面板不直接持有 director 写入能力。
//
// 边界：不写账本；恢复时输出时钟映射重建 / 按住键失效由
// 逻辑与输入采集保证，本面板只发出请求。
// ============================================================

import {
  _decorator,
  Component,
  Node,
  UITransform,
  Graphics,
  Label,
  Color,
  input,
  EventMouse,
} from 'cc';
import type { FrameRefreshable } from './FrameDriver';

const { ccclass } = _decorator;

/** 按钮尺寸 / 位置（表现占位，节点中心坐标）。 */
const BUTTON_WIDTH = 280;
const BUTTON_HEIGHT = 66;
const CONTINUE_Y = 46;
const EXIT_Y = -44;

/** 命中按钮矩形（面板节点中心坐标）。 */
interface PanelButton {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly action: 'continue' | 'exit';
}

/**
 * ChartPausePanel 谱面暂停面板组件。
 */
@ccclass('ChartPausePanel')
export class ChartPausePanel extends Component implements FrameRefreshable {
  /** 只读暂停判定：由组合根接到意图窄口的谱面状态。 */
  private pausedProvider: (() => boolean) | null = null;
  /** 继续回调：由组合根接到 ToggleChartPause（恢复）意图。 */
  private onContinue: (() => void) | null = null;
  /** 退出回调：由组合根接到 ExitChart 意图。 */
  private onExit: (() => void) | null = null;

  private graphics: Graphics | null = null;
  private titleNode: Node | null = null;
  private continueNode: Node | null = null;
  private exitNode: Node | null = null;
  private buttons: ReadonlyArray<PanelButton> = [];
  private built = false;
  private pausedShown = false;

  /** 接线只读暂停判定与继续 / 退出回调。 */
  bindWiring(pausedProvider: () => boolean, onContinue: () => void, onExit: () => void): void {
    this.pausedProvider = pausedProvider;
    this.onContinue = onContinue;
    this.onExit = onExit;
  }

  onLoad(): void {
    input.on('mouse-down', this.onMouseDown, this);
  }

  onDestroy(): void {
    input.off('mouse-down', this.onMouseDown, this);
  }

  /** 首次创建绘图与标签节点。 */
  private ensureBuilt(): void {
    if (this.built) {
      return;
    }
    this.built = true;

    const drawNode = new Node('PauseDraw');
    drawNode.layer = this.node.layer;
    this.node.addChild(drawNode);
    drawNode.addComponent(UITransform);
    this.graphics = drawNode.addComponent(Graphics);

    this.titleNode = this.buildLabel('PauseTitle', '已暂停（ESC 恢复）', 34);
    this.continueNode = this.buildLabel('PauseContinue', '继续', 26);
    this.exitNode = this.buildLabel('PauseExit', '退出谱面', 26);
    this.setLabelsVisible(false);
  }

  /** 构建一个文本节点。 */
  private buildLabel(name: string, text: string, fontSize: number): Node {
    const node = new Node(name);
    node.layer = this.node.layer;
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(420, 40);
    const label = node.addComponent(Label);
    label.fontSize = fontSize;
    label.color = new Color(235, 240, 250, 255);
    label.string = text;
    return node;
  }

  private setLabelsVisible(visible: boolean): void {
    if (this.titleNode !== null) {
      this.titleNode.active = visible;
    }
    if (this.continueNode !== null) {
      this.continueNode.active = visible;
    }
    if (this.exitNode !== null) {
      this.exitNode.active = visible;
    }
  }

  /** 帧刷新：按暂停状态绘制或清空（不停止 FrameDriver）。 */
  onFrameRefresh(): void {
    this.ensureBuilt();
    const paused = this.pausedProvider !== null && this.pausedProvider();
    this.pausedShown = paused;
    if (this.graphics === null) {
      return;
    }
    if (!paused) {
      this.graphics.clear();
      this.setLabelsVisible(false);
      this.buttons = [];
      return;
    }
    this.drawPanel();
  }

  /** 绘制遮罩、两个按钮，并登记命中矩形。 */
  private drawPanel(): void {
    const transform = this.node.getComponent(UITransform);
    const graphics = this.graphics;
    if (transform === null || graphics === null) {
      return;
    }
    const width = transform.width;
    const height = transform.height;
    graphics.clear();

    // —— 全屏半透明遮罩（冻结画面之上）——
    graphics.fillColor = new Color(8, 10, 16, 168);
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();

    const nextButtons: PanelButton[] = [
      { x: 0, y: CONTINUE_Y, w: BUTTON_WIDTH, h: BUTTON_HEIGHT, action: 'continue' },
      { x: 0, y: EXIT_Y, w: BUTTON_WIDTH, h: BUTTON_HEIGHT, action: 'exit' },
    ];
    for (const button of nextButtons) {
      graphics.fillColor = new Color(58, 96, 168, 220);
      graphics.rect(button.x - button.w / 2, button.y - button.h / 2, button.w, button.h);
      graphics.fill();
      graphics.lineWidth = 2;
      graphics.strokeColor = new Color(150, 185, 255, 220);
      graphics.rect(button.x - button.w / 2, button.y - button.h / 2, button.w, button.h);
      graphics.stroke();
    }
    this.buttons = nextButtons;

    if (this.titleNode !== null) {
      this.titleNode.setPosition(0, CONTINUE_Y + 120, 0);
    }
    if (this.continueNode !== null) {
      this.continueNode.setPosition(0, CONTINUE_Y, 0);
    }
    if (this.exitNode !== null) {
      this.exitNode.setPosition(0, EXIT_Y, 0);
    }
    this.setLabelsVisible(true);
  }

  /** 鼠标按下：仅暂停时对按钮做命中。 */
  private onMouseDown(event: EventMouse): void {
    if (!this.pausedShown) {
      return;
    }
    const transform = this.node.getComponent(UITransform);
    if (transform === null) {
      return;
    }
    // 面板覆盖全屏且居中：屏幕坐标 → 面板中心坐标。
    const localX = event.getLocationX() - transform.width / 2;
    const localY = event.getLocationY() - transform.height / 2;
    for (const button of this.buttons) {
      if (
        localX >= button.x - button.w / 2 &&
        localX <= button.x + button.w / 2 &&
        localY >= button.y - button.h / 2 &&
        localY <= button.y + button.h / 2
      ) {
        if (button.action === 'continue') {
          if (this.onContinue !== null) {
            this.onContinue();
          }
        } else if (this.onExit !== null) {
          this.onExit();
        }
        return;
      }
    }
  }
}
