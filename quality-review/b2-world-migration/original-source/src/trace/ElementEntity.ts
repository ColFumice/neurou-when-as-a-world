// ============================================================
// S3 痕接口 · ElementEntity 元素实体（T5 / AC-09 ~ AC-11）
// 名库冻结依据：
//   - 名库 v0.1：ElementType 定稿 Initial / Process / Trace /
//     Highlight / Commented / Residue；实体层只允许
//     Initial / Process / Trace / Residue 四个值；
//   - 名库 v0.1：VisibilityState(Revealed / Concealed)；
//   - HANDOFF-ROUND-16 明示：文件 src/trace/ElementEntity.ts、
//     类型 ElementEntity，包含 elementType / visibilityState / 坐标。
//
// 同文件占位：ElementType 类型。名库 v0.1 冻结 ElementType
// 六值，实体层裁剪为四值；HANDOFF-16 未授权独立文件，
// 按 EXECUTOR 规程随本文件声明，是否拆分为独立
// ElementType.ts 待 PROTOCOL 指定。
//
// 职责：
//   承载元素实体的玩法状态（元素类型 / 可见性 / 平面坐标）；
//   提供 applyVisibility 方法：调用 trace 域纯函数
//   applyTransition 推进可见性（与 Protagonist.move /
//   moveAlongAxes 同一模式：纯函数在同模块，类承载状态）。
//
// 边界：
//   ✗ 不引用 cc（逻辑模块，stage-1.md §14）
//   ✗ 不写账本（可见性为运行时状态）
//   ✗ 不实现向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：
//   trace → world A（LateralAxis / DepthAxis 类型只读）
//   trace → trace 自身（VisibilityState / VisibilityTransition）
// ============================================================

import type { LateralAxis } from '../world/LateralAxis';
import type { DepthAxis } from '../world/DepthAxis';
import { VisibilityState } from './VisibilityState';
import type { VisibilityTransition } from './VisibilityTransition';
import { applyTransition } from './VisibilityTransition';

/**
 * ElementType 元素类型（名库 v0.1 冻结六值；实体层四值）。
 *
 * 实体层只允许 Initial / Process / Trace / Residue
 * （HANDOFF-ROUND-16 / 名库 v0.1）；Highlight / Commented
 * 为名库冻结值但不进入实体层，故不写入本联合。
 * 采用字符串字面量联合（与 PlayerIntent / PerceptionMode
 * 同一纯类型口径，R 边表现层可直接比较）。
 */
export type ElementType = 'Initial' | 'Process' | 'Trace' | 'Residue';

/**
 * 元素实体平面坐标（结构同主角平面位置；元素在阶段 1
 * 不参与垂直轴，只放置于水平面）。
 */
export interface ElementEntityPosition {
  readonly lateral: LateralAxis;
  readonly depth: DepthAxis;
}

/**
 * ElementEntitySeed 元素实体构造入参
 * （名称参照 ProtagonistSeed 模式直译，待 PROTOCOL 追认）。
 */
export interface ElementEntitySeed {
  /** 元素类型（实体层四值之一） */
  readonly elementType: ElementType;
  /** 初始可见性状态（Revealed 明态 / Concealed 形态） */
  readonly visibilityState: VisibilityState;
  /** 横轴坐标（WorldMeter） */
  readonly lateral: LateralAxis;
  /** 纵深轴坐标（WorldMeter） */
  readonly depth: DepthAxis;
}

/**
 * ElementEntity 元素实体（HANDOFF-ROUND-16 明示类型名）
 *
 * 阶段 1 承载：元素类型、可见性状态、平面坐标。
 * 可见性转换由 director（DirectorSession.updateElementVisibility）
 * 依主角距离发起，经本类 applyVisibility 落地。
 */
export class ElementEntity {
  /** 元素类型（实体层四值之一；构造后不变） */
  private elementType: ElementType;

  /** 可见性状态（由 applyVisibility 转换推进） */
  private visibilityState: VisibilityState;

  /** 横轴坐标（WorldMeter） */
  private lateral: LateralAxis;

  /** 纵深轴坐标（WorldMeter） */
  private depth: DepthAxis;

  constructor(seed: ElementEntitySeed) {
    this.elementType = seed.elementType;
    this.visibilityState = seed.visibilityState;
    this.lateral = seed.lateral;
    this.depth = seed.depth;
  }

  /** 读取元素类型（只读） */
  getElementType(): ElementType {
    return this.elementType;
  }

  /** 读取可见性状态（只读；供 director 判定与表现层呈现） */
  getVisibilityState(): VisibilityState {
    return this.visibilityState;
  }

  /**
   * 是否处于明态（Revealed）。
   *
   * 供表现层在 R 边（presentation → trace 仅 import type，
   * 不可值导入 VisibilityState 枚举）经实例方法间接读取
   * （同 Protagonist.getTrailLength 间接消费模式），避免
   * 在表现层硬编码枚举数值。
   * 方法名为直译，待 PROTOCOL 追认。
   */
  isRevealed(): boolean {
    return this.visibilityState === VisibilityState.Revealed;
  }

  /** 读取平面坐标（只读） */
  getPosition(): ElementEntityPosition {
    return { lateral: this.lateral, depth: this.depth };
  }

  /**
   * 应用一次可见性转换（AC-11）。
   *
   * 内部调用 trace 域纯函数 applyTransition 得到新实体，
   * 仅写回 visibilityState（元素类型 / 坐标不变）。
   *
   * @param transition 转换请求（Trigger / Recall / CacheWarm / Forget）
   */
  applyVisibility(transition: VisibilityTransition): void {
    const next = applyTransition(this, transition);
    this.visibilityState = next.getVisibilityState();
  }
}
