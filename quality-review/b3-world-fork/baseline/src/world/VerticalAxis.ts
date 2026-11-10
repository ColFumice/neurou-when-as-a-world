// ============================================================
// S2 地图域 · VerticalAxis 垂直轴坐标（名库 v2.0 冻结名）
// 依据：名库 v2.0 段 "Y 轴" 行：
//   VerticalAxis（src/world/VerticalAxis.ts，单位 WorldMeter，
//   正方向向上）；Protagonist 新增 vertical 和 verticalSpeed。
// 依据：HANDOFF-ROUND-15 / VERDICT-104 任务四：
//   - 落地判定：vertical 为零时位于地面，跳跃期间大于零，
//     不允许落到地面以下；落地时坐标归零、垂直速度归零；
//   - 落地状态由逻辑状态判定，不得从动画 / 节点位置 /
//     碰撞显示效果反推；
//   - 跳跃期间继续允许 lateral / depth 移动；
//   - calculateCenterDistance 不加入 vertical
//     （主角原地跳跃不改变距中点距离）；
//   - 本次不扩展高台 / 坡地 / 落崖或立体碰撞。
//
// 职责：声明垂直轴坐标的单位类型；纯类型，不含逻辑。
// ============================================================

import type { WorldMeter } from './WorldMeter';

/**
 * VerticalAxis 垂直轴
 *
 * 主角跳跃所在轴；坐标值以地面为零点，正方向向上，
 * 单位 WorldMeter（INV-9 全游戏唯一距离单位）。
 *
 * 语义（VERDICT-104）：
 *   - vertical = 0：主角位于地面；
 *   - vertical > 0：主角位于空中（跳跃期间）；
 *   - vertical < 0 不允许（落地时坐标归零）。
 *
 * 不参与 calculateCenterDistance（主角原地跳跃不改变
 * 距中点距离；MapCenter 仍为平面 { lateral, depth }）。
 */
export type VerticalAxis = WorldMeter;
