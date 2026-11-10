// ============================================================
// P 表现层 · ProtagonistView 主角表现组件（名库 v1.9 /
//                                          VERDICT-098 冻结类型名）
// 文件路径：src/presentation/ProtagonistView.ts（名库硬约束）
//
// 职责（VERDICT-098）：
//   - 读取 Protagonist 玩法状态（横轴 / 纵深坐标），将主角
//     节点位置对齐到当前玩法坐标；
//   - 负责主角节点的位置与外观呈现（节点位置、视觉缩放）；
//   - 世界空间高度以 SCALE_REF_WM 为唯一尺度锚点（AC-06：
//     主角画面高度与 1.6 WorldMeter 尺度一致）。
//
// 边界（VERDICT-098）：
//   ✗ 不保存主角玩法坐标的权威副本（仅 Protagonist 是权威源）
//   ✗ 不推进移动逻辑（移动推进属 character 域 moveAlongAxes）
//   ✗ 不引用逻辑层 cc（presentation 域可引用 cc，VERDICT-094）
//   ✗ 不做向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：
//   presentation → constants A（SCALE_REF_WM）
//   presentation → character R（Protagonist 类型只读）
//   presentation → world R（LateralAxis / DepthAxis 类型只读）
//   presentation → presentation 自身（FrameRefreshable）
//
// Cocos 绑定：引擎导入后 @ccclass 注册为 Cocos 组件，方法
// 签名不变。本节点（this.node）即主角视觉节点；引擎导入后
// 可由 @property 拖拽额外 Sprite / MeshRenderer 等子节点。
// ============================================================

import { _decorator, Component, Node } from 'cc';
import { SCALE_REF_WM } from '../../constants/index';
import type { Protagonist } from '../character/Protagonist';
import type { FrameRefreshable } from './FrameDriver';

const { ccclass, property } = _decorator;

/**
 * ProtagonistView 主角表现组件（VERDICT-098 冻结类型名）
 *
 * 阶段 1 承载：
 *   - AC-02（间接）：本组件更新主角节点位置，CameraRig 跟随
 *     主角节点即得到镜头中心始终是主角；
 *   - AC-06：主角视觉高度 = SCALE_REF_WM（1.6 WorldMeter），
 *     全游戏唯一尺度锚点（stage-1.md §7）。
 */
@ccclass('ProtagonistView')
export class ProtagonistView extends Component implements FrameRefreshable {
  /**
   * 主角实例（R 边：类型只读；运行时由 bindSource 注入）。
   * 不持有玩法坐标的权威副本——本组件仅读取 protagonist.
   * getPosition() 推进节点位置。
   */
  private protagonist: Protagonist | null = null;

  /**
   * 主角视觉节点（@property；引擎导入后由编辑器拖拽赋值。
   * 灰盒占位：若未拖拽，回退使用 this.node 自身）。
   */
  @property({ type: Node })
  viewNode: Node | null = null;

  /**
   * 接线只读数据源（方法名直译，待追认）。
   *
   * @param protagonist 主角实例（仅读取 getPosition，不修改坐标）
   */
  bindSource(protagonist: Protagonist): void {
    this.protagonist = protagonist;
  }

  /**
   * Cocos 生命周期：加载时按 SCALE_REF_WM 应用世界空间高度
   * 锚点（AC-06）。本组件假设主角视觉资产的原始高度为 1
   * WorldMeter（灰盒 1×1 立方体 / 精灵占位），按 SCALE_REF_WM
   * 均匀缩放至 1.6 WorldMeter。
   */
  onLoad(): void {
    this.applyScaleAnchor();
  }

  /**
   * 按 SCALE_REF_WM 应用世界空间高度锚点（AC-06）。
   *
   * 实现口径：主角视觉资产的原始高度假设为 1 WorldMeter
   * （灰盒占位）；缩放因子 = SCALE_REF_WM = 1.6。
   * 真实美术资产接入后，由表现侧在 AC-29（美术可替换）
   * 验证中替换资产并保持 SCALE_REF_WM 为唯一尺度锚点。
   */
  private applyScaleAnchor(): void {
    const target = this.viewNode !== null ? this.viewNode : this.node;
    if (target === null) {
      return;
    }
    target.setScale(SCALE_REF_WM, SCALE_REF_WM, SCALE_REF_WM);
  }

  /**
   * FrameDriver 第 ③ 步回调：读取主角最新坐标，对齐主角节点
   * 位置（INV-3 表现层只读——不修改 Protagonist 内部状态）。
   *
   * 坐标映射口径（名库 v2.0 / VERDICT-104 加 vertical）：
   *   - LateralAxis → Cocos 3D X 轴（横轴）；
   *   - DepthAxis   → Cocos 3D Z 轴（纵深）；
   *   - VerticalAxis → Cocos 3D Y 轴（竖直，跳跃期间 > 0）。
   * CameraRig 不跟随 Y 轴（保持镜头稳定，AC-02 仅跟随 XZ）。
   */
  onFrameRefresh(): void {
    if (this.protagonist === null) {
      return;
    }
    const target = this.viewNode !== null ? this.viewNode : this.node;
    if (target === null) {
      return;
    }
    const position = this.protagonist.getPosition();
    target.setPosition(position.lateral, position.vertical, position.depth);
  }
}
