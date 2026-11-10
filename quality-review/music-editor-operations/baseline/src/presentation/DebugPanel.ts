// ============================================================
// P 表现层 · DebugPanel 调试面板（名库 v1.9 / VERDICT-097 冻结
//                                            类型名）
// 文件路径：src/presentation/DebugPanel.ts（名库硬约束）
//
// 职责（VERDICT-097）：
//   - 读取主角坐标（Protagonist 实例；R 边 import type）
//   - 读取地图中点（MapCenter 实例；R 边 import type）
//   - 消费 calculateCenterDistance 派生距离（架构偏差 1：
//     矩阵规定 presentation → world 为 R 边，free function
//     calculateCenterDistance 值导入会触发 E2；故函数值导入
//     挂在 Protagonist.getCenterDistance 上，character→world A
//     边允许值导入；DebugPanel 经 protagonist 实例方法分派
//     间接消费，不另建距离公式 / 不修改主角坐标 / 不改地图
//     中点 / 不改账本）
//   - 显示距中点距离 + WorldMeter 单位（AC-05，横轴与纵深轴
//     同时计入）
//
// 边界（VERDICT-097）：
//   ✗ 不得另建距离公式（仅消费 calculateCenterDistance）
//   ✗ 不得修改主角坐标、地图中点、账本
//   ✗ 不做向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：
//   presentation → constants A（SCALE_REF_WM 等只读）
//   presentation → character R（Protagonist 类型只读）
//   presentation → world R（MapCenter / CenterDistance / WorldMeter）
//   presentation → presentation 自身（FrameRefreshable 接口）
//
// Cocos 绑定：
//   引擎导入后由 @ccclass 注册为 Cocos 组件，方法签名不变；
//   灰盒阶段 Label 由 @property 拖拽赋值，Protagonist / MapCenter
//   经 bindSource 方法注入（非 Component 类型不能用 @property）。
// ============================================================

import { _decorator, Component, Label } from 'cc';
import type { WorldMeter } from '../world/WorldMeter';
import type { MapCenter } from '../world/MapCenter';
import type { CenterDistance } from '../world/MapCenter';
import type { Protagonist } from '../character/Protagonist';
import type { FrameRefreshable } from './FrameDriver';

const { ccclass, property } = _decorator;

/**
 * DebugPanel 调试面板组件（VERDICT-097 冻结类型名）
 *
 * 阶段 1 承载 AC-05：调试面板显示主角距中点距离，单位
 * WorldMeter，同时计入横轴和纵深轴。
 */
@ccclass('DebugPanel')
export class DebugPanel extends Component implements FrameRefreshable {
  /**
   * 文本组件（@property 由编辑器拖拽赋值；引擎导入前为 null）。
   * 灰盒占位期间由 bindSource 旁路注入测试桩 Label 替代品。
   */
  @property({ type: Label })
  label: Label | null = null;

  /** 主角实例（R 边：类型只读；运行时由 bindSource 注入） */
  private protagonist: Protagonist | null = null;

  /** 地图中点实例（R 边：类型只读；运行时由 bindSource 注入） */
  private mapCenter: MapCenter | null = null;

  /**
   * 接线只读数据源（方法名直译，待追认）。
   *
   * @param protagonist 主角实例（仅读取 getPosition /
   *                   getCenterDistance；不修改主角坐标）
   * @param mapCenter 地图中点（仅作为距离计算的基准注入）
   */
  bindSource(protagonist: Protagonist, mapCenter: MapCenter): void {
    this.protagonist = protagonist;
    this.mapCenter = mapCenter;
  }

  /**
   * FrameDriver 第 ③ 步回调：读取主角距中点距离并刷新显示。
   *
   * 距离消费经 protagonist.getCenterDistance(mapCenter)（架构
   * 偏差 1；详见文件头注释）；横轴与纵深轴同时计入，无第二
   * 距离公式。
   */
  onFrameRefresh(): void {
    if (this.protagonist === null || this.mapCenter === null) {
      return;
    }
    const distance: CenterDistance = this.protagonist.getCenterDistance(this.mapCenter);
    this.renderDistance(distance);
  }

  /**
   * 渲染距离文本（AC-05）。
   *
   * @param distance 距中点距离（WorldMeter；横轴 + 纵深轴同时计入）
   */
  private renderDistance(distance: WorldMeter): void {
    if (this.label === null) {
      return;
    }
    // 显示口径：距离值 + 单位 WorldMeter（INV-9：全游戏唯一
    // 距离单位）。toFixed(2) 仅显示精度，非数值平衡决策。
    this.label.string = distance.toFixed(2) + ' WM';
  }
}
