// ============================================================
// S6 角色域 · Protagonist 主角状态承载类（T2 场景搭建 / 跳跃）
// 名库 v2.0 冻结名：Protagonist（VERDICT-096）、VerticalAxis
//                        （v2.0 段 "Y 轴" 行）、vertical /
//                        verticalSpeed（v2.0 段 "Y 轴" 行：
//                        Protagonist 新增 vertical 和 verticalSpeed）
// 文件路径：src/character/Protagonist.ts（名库硬约束）
//
// 职责（VERDICT-096）：
//   承载主角玩法状态——
//     · 横轴坐标（LateralAxis）
//     · 纵深坐标（DepthAxis）
//     · 移动状态（速度 MoveSpeed）
//     · 垂直坐标（VerticalAxis，名库 v2.0 / VERDICT-104）
//     · 垂直速度（verticalSpeed，名库 v2.0 / VERDICT-104）
//   提供 move 方法：以 MapCenter 为纵深裁剪基准，调用
//   character 域纯函数 moveAlongAxes 推进坐标。
//   提供 getTrailLength 方法：T3 拖尾派生读取，调用
//   character 域纯函数 calculateTrailLength 推导逻辑拖尾
//   长度（AC-07；表现侧 TrailRenderer 间接消费）。
//   提供 jump / tickVertical / isGrounded / getVertical 方法：
//   跳跃状态推进（VERDICT-104 / VERDICT-105，AC-30）。
//
// 跳跃边界（VERDICT-104 / VERDICT-105 / HANDOFF-ROUND-15）：
//   - 起跳：地面（vertical = 0）+ Jump 意图 → verticalSpeed
//     = JUMP_INITIAL_SPEED_WM_PER_SECONDS；空中请求被忽略；
//   - 每帧：verticalSpeed -= GRAVITY_WM_PER_SECONDS_SQUARED × dt；
//     vertical += verticalSpeed × dt；
//   - 落地：vertical <= 0 时 vertical 归零、verticalSpeed 归零；
//   - 落地状态由逻辑状态判定，不得从动画 / 节点位置 / 碰撞
//     显示效果反推；
//   - 跳跃期间继续允许 lateral / depth 移动（move 不受影响）；
//   - calculateCenterDistance 不加入 vertical（原地跳跃不改变
//     距中点距离）；
//   - 跳跃不写账本、不产生 Trace、不授予任何权限。
//
// 边界（VERDICT-096）：
//   ✗ 不承载镜头、节点、动画、显示尺寸
//   ✗ 不引用 cc（逻辑模块，stage-1.md §14 / VERDICT-094）
//   ✗ 不写账本（账本追加专属 director / INV-2）
//   ✗ 不实现向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：
//   character → constants A
//   character → world A（LateralAxis / DepthAxis / MapCenter /
//                        VerticalAxis）
//   character → character 自身（同模块 MoveSpeed）
//
// 追认冻结名（HANDOFF-ROUND-12 PROTOCOL 全部批准）：
//   moveAlongAxes / MoveInput / MovementResult
// 追认直译名（HANDOFF-ROUND-15，待 PROTOCOL 追认）：
//   jump / tickVertical / isGrounded / getVertical
// ============================================================

import {
  MAX_MOVE_SPEED_WM_PER_SECONDS,
  JUMP_INITIAL_SPEED_WM_PER_SECONDS,
  GRAVITY_WM_PER_SECONDS_SQUARED,
} from '../../constants/index';
import type { LateralAxis } from '../world/LateralAxis';
import type { DepthAxis } from '../world/DepthAxis';
import type { MapCenter } from '../world/MapCenter';
import type { CenterDistance } from '../world/MapCenter';
import type { VerticalAxis } from '../world/VerticalAxis';
import type { MoveSpeed, MoveInput } from './MoveSpeed';
import { moveAlongAxes } from './MoveSpeed';
import { calculateCenterDistance } from '../world/MapCenter';
import { calculateTrailLength } from './TrailLength';
import type { TrailLength } from './TrailLength';

/**
 * 紧贴地面判定容差（WorldMeter；名库 v2.1 / VERDICT-108
 * "紧贴地面"段：限定为逻辑落地判定的数值容差，本批不冻结
 * 容差名称与数值，允许在 Protagonist.ts 内部定义占位常量）。
 *
 * 语义：主角正在下降或已静止（verticalSpeed <= 0）且
 * vertical 在该容差内时，视为已落地，可归地并起跳；
 * 上升阶段（verticalSpeed > 0）不得因此重复起跳。
 * 占位 0.05 WM，待数值平衡 / PROTOCOL 冻结后调整。
 * 仅用于逻辑落地判定，禁止从画面或节点位置反推。
 */
const GROUND_TOLERANCE_WM = 0.05;

/**
 * 主角初始位置（构造入参；以 MapCenter 为原点）
 *
 * 主角类型不承载镜头 / 显示尺寸，故构造入参仅含两轴坐标。
 * 主角初始速度恒取 MAX_MOVE_SPEED_WM_PER_SECONDS（占位
 * 平衡值，待后续数值平衡在 constants/index.ts 调整）。
 */
export interface ProtagonistSeed {
  /** 初始横轴坐标（WorldMeter，以 MapCenter 为原点） */
  readonly lateral: LateralAxis;
  /** 初始纵深轴坐标（WorldMeter，以 MapCenter 为原点） */
  readonly depth: DepthAxis;
}

/**
 * 主角当前位置（只读视图，供表现层读取；不暴露写入能力）
 *
 * 结构同 world.MapCenter，但语义为主角位置；不挪用
 * MapCenter 类型名（地图中点是地图状态，主角位置是
 * 主角状态，分属不同语义）。
 *
 * 含 vertical（VerticalAxis，名库 v2.0 / VERDICT-104）：
 * 表现层（ProtagonistView / TrailRenderer）经此只读访问
 * 主角垂直坐标以更新节点 Y 轴 / 隐藏拖尾。
 * vertical 不参与 calculateCenterDistance（原地跳跃不改变
 * 距中点距离）。
 */
export interface ProtagonistPosition {
  readonly lateral: LateralAxis;
  readonly depth: DepthAxis;
  readonly vertical: VerticalAxis;
}

/**
 * Protagonist 主角状态承载类（VERDICT-096 冻结类型名）
 *
 * 阶段 1 承载：
 *   - 横轴坐标 lateral
 *   - 纵深坐标 depth
 *   - 移动速度 speed（占位 = MAX_MOVE_SPEED_WM_PER_SECONDS）
 *
 * 不承载：镜头、节点、动画、显示尺寸；不引用 cc；
 * 不写账本（账本追加专属 director / INV-2）。
 *
 * 调用约定：
 *   由 director（DirectorSession）持有 Protagonist 引用，
 *   Move 意图到达时调用 move 方法，并传入当前 MapCenter
 *   作为纵深裁剪基准（VERDICT-100 第 4 条 / 名库 v1.9
 *   纵深语义：必须计入中点偏移）。
 */
export class Protagonist {
  /** 横轴坐标（以 MapCenter 为原点；单位 WorldMeter） */
  private lateral: LateralAxis;

  /** 纵深坐标（以 MapCenter 为原点；单位 WorldMeter） */
  private depth: DepthAxis;

  /**
   * 垂直坐标（VerticalAxis，名库 v2.0 / VERDICT-104）。
   * 以地面为零点，正方向向上；初始 0（地面）。
   * 跳跃期间 > 0；落地时归零。不允许 < 0。
   * 不参与 calculateCenterDistance（原地跳跃不改变距中点距离）。
   */
  private vertical: VerticalAxis = 0;

  /**
   * 垂直速度（WorldMeter/秒，名库 v2.0 / VERDICT-104）。
   * 允许正（上升）、零（静止 / 落地）、负（下降）。
   * 起跳时设为 JUMP_INITIAL_SPEED_WM_PER_SECONDS；
   * 每帧按 GRAVITY 衰减；落地时归零。
   */
  private verticalSpeed: number = 0;

  /**
   * 移动速度（WorldMeter/秒）。
   * 灰盒占位取 MAX_MOVE_SPEED_WM_PER_SECONDS（上限即默认值），
   * 待数值平衡阶段在 constants 内调整；
   * 不得在逻辑代码中硬编码不同速度值。
   */
  private readonly speed: MoveSpeed = MAX_MOVE_SPEED_WM_PER_SECONDS;

  constructor(seed: ProtagonistSeed) {
    this.lateral = seed.lateral;
    this.depth = seed.depth;
    // vertical / verticalSpeed 已由字段初始值 = 0（地面 / 静止）。
  }

  /**
   * 读取主角当前位置（只读视图；含 vertical）。
   * 表现层（ProtagonistView / CameraRig / DebugPanel / TrailRenderer）
   * 经此只读访问主角坐标，不获得写入能力（INV-3 表现层只读）。
   *
   * vertical 不参与 calculateCenterDistance（原地跳跃不改变
   * 距中点距离）；CameraRig 仅读 lateral / depth（不跟随 Y 轴）。
   */
  getPosition(): ProtagonistPosition {
    return {
      lateral: this.lateral,
      depth: this.depth,
      vertical: this.vertical,
    };
  }

  /**
   * 读取主角移动速度（占位 = MAX_MOVE_SPEED_WM_PER_SECONDS）。
   */
  getSpeed(): MoveSpeed {
    return this.speed;
  }

  /**
   * 计算主角当前逻辑拖尾长度（AC-07 派生读取；T3 拖尾）。
   *
   * 实现口径（架构偏差，待 PROTOCOL 裁定；同 getCenterDistance
   * 同模式）：
   *   矩阵规定 presentation → character 为 R 边（只允许
   *   import type），而 calculateTrailLength 是 character 域
   *   free function（值导入）；若由 TrailRenderer 直接消费
   *   character.calculateTrailLength，会触发 E2 违规。故将
   *   calculateTrailLength 的值导入挂在 Protagonist 上
   *   （character → character 自身为 A 边，允许值导入），
   *   TrailRenderer 经 protagonist 实例的方法分派间接消费
   *   ——既不另建拖尾长度公式（HANDOFF 禁止事项），也不
   *   违反 R 边。
   *
   * 返回值不含上限裁剪——上限属表现侧视觉参数，由
   * TrailRenderer 在显示前应用（HANDOFF-14 明令）。
   *
   * @returns 逻辑拖尾长度（WorldMeter，≥ 0；速度为 0 时为 0）
   */
  getTrailLength(): TrailLength {
    return calculateTrailLength(this.speed);
  }

  /**
   * 计算主角当前位置距 MapCenter 的距离（AC-05 派生读取）。
   *
   * 实现口径（架构偏差，待 PROTOCOL 裁定）：
   *   矩阵规定 presentation → world 为 R 边（只允许 import type），
   *   而 calculateCenterDistance 是 world 域 free function（值导入）；
   *   若由 DebugPanel 直接消费 world.calculateCenterDistance，会触发
   *   E2 违规。故将 calculateCenterDistance 的值导入挂在 Protagonist
   *   上（character → world 为 A 边，允许值导入），DebugPanel 经
   *   protagonist 实例的方法分派间接消费——既不另建距离公式
   *   （HANDOFF 禁止事项），也不违反 R 边。
   *
   * @param center 地图中点（由调用方注入；非主角状态）
   * @returns 主角距中点距离（WorldMeter，横轴与纵深轴同时计入）
   */
  getCenterDistance(center: MapCenter): CenterDistance {
    return calculateCenterDistance(
      { lateral: this.lateral, depth: this.depth },
      center,
    );
  }

  /**
   * 沿两轴推进主角坐标（AC-01）。
   *
   * 调用方为 director（DirectorSession），传入 MapCenter 作为
   * 纵深裁剪基准（VERDICT-100 第 4 条 / 名库 v1.9 纵深语义：
   * 必须计入中点偏移；纵深可移动范围 = 两侧各 ±半个
   * DEPTH_RANGE_WM，围绕 center.depth 裁剪）。
   *
   * 横轴不设范围裁剪（地图横向远大于纵深，AC-01）；
   * 纵深轴由 moveAlongAxes 内部按 center.depth 裁剪。
   *
   * @param input 本帧两轴方向分量（[-1, 1]，由 InputCollector
   *             采集经 PlayerIntent.Move 传入）
   * @param frameDurationSeconds 本帧时长（秒）
   * @param center 地图中点（纵深裁剪基准；非主角状态）
   */
  move(
    input: MoveInput,
    frameDurationSeconds: number,
    center: MapCenter,
  ): void {
    const result = moveAlongAxes(
      { lateral: this.lateral, depth: this.depth },
      input,
      this.speed,
      frameDurationSeconds,
      center,
    );
    this.lateral = result.lateral;
    this.depth = result.depth;
    // 跳跃期间继续允许 lateral / depth 移动（VERDICT-104 第 5 条）：
    // move 不读 vertical / verticalSpeed，垂直物理由 tickVertical 推进。
  }

  /**
   * 读取主角垂直坐标（只读视图；名库 v2.0 / VERDICT-104）。
   * 表现层 ProtagonistView 经此设节点 Y 轴；TrailRenderer 经此
   * 判断是否隐藏拖尾。
   *
   * 方法名 getVertical 为直译，待 PROTOCOL 追认。
   */
  getVertical(): VerticalAxis {
    return this.vertical;
  }

  /**
   * 判定主角是否位于地面（名库 v2.1 / VERDICT-108 落地判定）。
   *
   * 落地条件（两者同时满足）：
   *   - vertical <= GROUND_TOLERANCE_WM（位于地面或紧贴地面容差内）；
   *   - verticalSpeed <= 0（正在下降或已静止）。
   * 上升阶段（verticalSpeed > 0）即使 vertical 在容差内也不视为
   * 落地，避免起跳首帧重复起跳。
   *
   * 落地状态由逻辑状态判定，不得从动画 / 节点位置 /
   * 碰撞显示效果反推（HANDOFF-ROUND-15 任务四第 4 条 /
   * 名库 v2.1 "紧贴地面"段）。
   *
   * 方法名 isGrounded 为直译，待 PROTOCOL 追认。
   */
  isGrounded(): boolean {
    return this.vertical <= GROUND_TOLERANCE_WM && this.verticalSpeed <= 0;
  }

  /**
   * 起跳（VERDICT-105 / AC-30）。
   *
   * 仅当主角位于地面（vertical = 0）时起跳：
   *   verticalSpeed = JUMP_INITIAL_SPEED_WM_PER_SECONDS；
   * 空中请求被忽略（不重复起跳，不缓存）。
   *
   * 跳跃不写账本、不产生 Trace、不授予任何权限。
   *
   * 方法名 jump 为直译，待 PROTOCOL 追认。
   */
  jump(): void {
    if (this.vertical > 0) {
      // 空中起跳请求被忽略（AC-30：空中不能再次起跳）。
      return;
    }
    this.verticalSpeed = JUMP_INITIAL_SPEED_WM_PER_SECONDS;
  }

  /**
   * 每帧推进垂直物理（VERDICT-105 / AC-30）。
   *
   * 由 DirectorSession.submitFrameIntents 在每帧意图处理
   * 完成后调用一次（无论本帧是否有意图），保证垂直物理
   * 每帧固定推进：
   *   verticalSpeed -= GRAVITY × dt；
   *   vertical += verticalSpeed × dt；
   *   落地（vertical <= 0）时 vertical 归零、verticalSpeed 归零。
   *
   * 已落地且无上升速度时直接归零保持地面状态，物理不推进
   * （避免 vertical 被 clamp 到 0 时 verticalSpeed 累积负值
   *   导致下一帧起跳异常）。
   *
   * 方法名 tickVertical 为直译，待 PROTOCOL 追认。
   *
   * @param frameDurationSeconds 本帧时长（秒）
   */
  tickVertical(frameDurationSeconds: number): void {
    // 已落地（地面静止）或紧贴地面且正在下降：直接归地，
    // 物理不推进（容差归地，避免角色悬停在容差高度 /
    // verticalSpeed 累积负值影响下一次起跳）。
    // 上升阶段（verticalSpeed > 0）不进入此分支。
    if (this.vertical <= GROUND_TOLERANCE_WM && this.verticalSpeed <= 0) {
      this.vertical = 0;
      this.verticalSpeed = 0;
      return;
    }
    this.verticalSpeed -=
      GRAVITY_WM_PER_SECONDS_SQUARED * frameDurationSeconds;
    this.vertical += this.verticalSpeed * frameDurationSeconds;
    if (this.vertical <= 0) {
      // 落地：坐标归零、垂直速度归零（VERDICT-104）。
      this.vertical = 0;
      this.verticalSpeed = 0;
    }
  }
}
