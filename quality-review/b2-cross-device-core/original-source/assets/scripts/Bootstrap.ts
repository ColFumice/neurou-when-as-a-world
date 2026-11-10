// ============================================================
// 组合根 · Bootstrap（Cocos Creator 3.8.8 组件）
//
// 职责：在运行时组装逻辑层对象图（组合根 / Composition
//       Root），解决 stage-1.md §6 依赖矩阵下 presentation
//       只能 R/I 边访问 director / character / world、无法
//       自行 new 逻辑对象的问题：
//         · new Protagonist（character，主角状态）
//         · new DirectorSession（director，意图分发）
//         · session.bindProtagonist / bindMapCenter 接线
//       组装结果一次性交给 SceneBuilder，由后者把实例
//       只读注入 CameraRig / ProtagonistView / DebugPanel，
//       并把 session 作为 IntentPort 交给 FrameDriver。
//
// 位置与导入规范（Cocos 3.8.8）：
//   本文件位于 assets/scripts/，逻辑源码经目录联接位于
//   assets/scripts/src（→ 工程根 src）与
//   assets/scripts/constants（→ 工程根 constants）。
//   Cocos 3.8 规定 assets 内脚本之间的相对导入**省略扩展
//   名**（由编辑器模块系统解析）；assets 之外的 .ts 不允许
//   直接导入（官方论坛工程师答复：3.1.1 起 .ts 只能在
//   assets 内使用）。
//
// 组合根参与 naming / tsc；依赖矩阵适用于 src 七域与 constants。
// ============================================================

import { _decorator, Component } from 'cc';
import { DirectorSession } from './src/director/IntentPort';
import { Protagonist } from './src/character/Protagonist';
import type { MapCenter } from './src/world/MapCenter';

const { ccclass } = _decorator;

/** 组合根一次性组装结果（不可变句柄，交给 SceneBuilder 接线） */
export interface RuntimeGraph {
  /** 叙事导演运行时（IntentPort 实现） */
  readonly session: DirectorSession;
  /** 主角状态承载类唯一实例 */
  readonly protagonist: Protagonist;
  /** 地图中点（纵深裁剪基准；坐标原点 (0,0)） */
  readonly mapCenter: MapCenter;
}

/**
 * Bootstrap 组合根组件。
 *
 * 用法：无需手动挂载；SceneBuilder.start() 会自动在同一
 * 节点上 addComponent(Bootstrap) 并调用 ensureRuntime()。
 */
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  private graph: RuntimeGraph | null = null;

  /**
   * 惰性组装逻辑层对象图（幂等：多次调用返回同一实例）。
   *
   * @returns 运行时对象图句柄
   */
  ensureRuntime(): RuntimeGraph {
    if (this.graph !== null) {
      return this.graph;
    }

    // 主角出生点：地图中点（MapCenter 为坐标原点 (0,0)）
    const protagonist: Protagonist = new Protagonist({ lateral: 0, depth: 0 });
    const mapCenter: MapCenter = { lateral: 0, depth: 0 };

    const session: DirectorSession = new DirectorSession();
    session.bindProtagonist(protagonist);
    session.bindMapCenter(mapCenter);

    this.graph = { session, protagonist, mapCenter };
    return this.graph;
  }
}
