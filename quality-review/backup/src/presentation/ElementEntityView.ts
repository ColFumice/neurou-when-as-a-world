// ============================================================
// P 表现层 · ElementEntityView 元素实体表现组件（T5 / AC-10 / AC-11）
// 文件路径：src/presentation/ElementEntityView.ts
// 组件类型：ElementEntityView（HANDOFF-ROUND-16 明示，Cocos 组件）
//
// 职责：
//   读取 ElementEntity 的 visibilityState，并结合当前感知
//   模式，控制实体节点的可见性（Node.active）：
//     · Revealed（明态）：任何模式可见；
//     · Concealed（形态）：仅 Triggered 模式可见，
//       Normal 模式隐藏（AC-10：切换到触发模式后可以看到
//       处于形态的实体）。
//
// 可见性呈现规则（纯只读组合，不写任何逻辑状态）：
//   visible = entity.isRevealed() || mode === 'Triggered'
//
// 边界：
//   ✗ 不保存实体状态权威副本（权威在 trace.ElementEntity；
//     可见性转换由 director.updateElementVisibility 推进）
//   ✗ 不触发 Trigger / Forget（那是 director 依距离做的逻辑）
//   ✗ 不引用 cc 于逻辑层（本组件在 presentation，可引用 cc）
//   ✗ 不做向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：
//   presentation → trace R（ElementEntity 仅 import type，
//                  经 isRevealed 实例方法间接读枚举，避免
//                  R 边值导入 VisibilityState 违规）
//   presentation → director I（IntentPort 仅 import type）
// ============================================================

import { _decorator, Component } from 'cc';
import type { ElementEntity } from '../trace/ElementEntity';
import type { IntentPort } from '../director/IntentPort';
import type { FrameRefreshable } from './FrameDriver';

const { ccclass } = _decorator;

/**
 * ElementEntityView 元素实体表现组件
 * （HANDOFF-ROUND-16 明示类型名）
 *
 * 由 SceneBuilder 在每个元素实体节点上挂载，bindSource
 * 注入 ElementEntity、bindIntentPort 注入意图窄口；
 * FrameDriver 第 ③ 步每帧刷新节点 active。
 */
@ccclass('ElementEntityView')
export class ElementEntityView extends Component implements FrameRefreshable {
  /** 元素实体（R 边：类型只读；运行时由 bindSource 注入） */
  private entity: ElementEntity | null = null;

  /** 意图窄口（I 边：只读 getCurrentPerceptionMode） */
  private intentPort: IntentPort | null = null;

  /**
   * 接线只读实体（方法名沿用 bindSource，与 ProtagonistView /
   * TrailRenderer 同一命名，待追认）。
   */
  bindSource(entity: ElementEntity): void {
    this.entity = entity;
  }

  /**
   * 接线意图窄口（方法名直译，待追认；仅读取当前模式）。
   */
  bindIntentPort(intentPort: IntentPort): void {
    this.intentPort = intentPort;
  }

  /**
   * 第 ③ 步回调：按实体可见性状态 + 当前感知模式设置节点
   * 可见性（AC-10 / AC-11）。
   *
   * Concealed 实体：Normal 隐藏、Triggered 可见；
   * Revealed 实体：始终可见（Trigger 显形后常驻，直到
   * director 依距离发 Forget 回到 Concealed）。
   */
  onFrameRefresh(): void {
    if (this.entity === null) {
      return;
    }
    let visible = this.entity.isRevealed();
    if (!visible && this.intentPort !== null) {
      // 形态实体仅在触发模式下被看见。
      visible = this.intentPort.getCurrentPerceptionMode() === 'Triggered';
    }
    this.node.active = visible;
  }
}
