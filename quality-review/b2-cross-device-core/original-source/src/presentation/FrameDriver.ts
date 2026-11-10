// ============================================================
// P 表现层 · FrameDriver 帧驱动（名库 v1.9 / VERDICT-094 冻结名）
//
// 职责（每帧严格固定三步顺序）：
//   ① 让 InputCollector 整理本帧输入；
//   ② 把本帧玩家意图与本帧时长交给 director 的意图窄口
//      （IntentPort，presentation → director 唯一窄路）；
//   ③ 通知各表现组件读取最新状态并刷新画面。
//
// 全场景只有一个 FrameDriver（VERDICT-094），由本类的
// 单实例守卫 + 场景唯一挂载共同保证。
//
// 类型检查使用 Creator 生成的真实引擎声明（temp/declarations）。
// presentation 可引用 cc，逻辑域保持引擎隔离。
//
// 表现层文件：不承载任何逻辑决策（INV-1 / INV-6），
// 不做向量计算、网络同步、颜色映射（HANDOFF 禁止事项 2）。
// ============================================================

import { _decorator, Component } from 'cc';
import type { PlayerIntent } from '../director/PlayerIntent';
import type { IntentPort } from '../director/IntentPort';
import type { InputCollector } from './InputCollector';

const { ccclass } = _decorator;

/**
 * FrameRefreshable 可刷新表现组件（直译接口名，待追认）
 *
 * 所有需要“读取最新状态并刷新画面”的表现组件实现本接口；
 * 接口不传入任何状态参数——组件自行从其绑定的只读面读取，
 * 保持表现层不持有逻辑写能力。
 */
export interface FrameRefreshable {
  /** 本帧状态刷新（第 ③ 步回调；灰盒阶段为空实现） */
  onFrameRefresh(): void;
}

/** 模块级单实例守卫：全场景第二个 FrameDriver 直接抛错 */
let frameDriverBound = false;

/**
 * FrameDriver 帧驱动组件
 */
@ccclass('FrameDriver')
export class FrameDriver extends Component {
  private ownsFrameDriverGuard = false;
  /** 本帧输入来源（第 ① 步） */
  private inputCollector: InputCollector | null = null;

  /** director 意图窄口（第 ② 步；类型引用，无写入能力暴露） */
  private intentPort: IntentPort | null = null;

  /** 第 ③ 步待通知的表现组件 */
  private readonly refreshables: FrameRefreshable[] = [];

  /**
   * Cocos 生命周期：加载时校验全场景唯一。
   */
  onLoad(): void {
    if (frameDriverBound) {
      throw new Error('FrameDriver 全场景只允许挂载一个实例');
    }
    frameDriverBound = true;
    this.ownsFrameDriverGuard = true;
  }

  /**
   * 场景接线（引擎导入后改由 @property 拖拽赋值；
   * 方法名为直译，待追认）。
   */
  onDestroy(): void {
    if (this.ownsFrameDriverGuard) { frameDriverBound = false; }
    this.ownsFrameDriverGuard = false;
    this.refreshables.length = 0;
  }

  bindWiring(inputCollector: InputCollector, intentPort: IntentPort): void {
    this.inputCollector = inputCollector;
    this.intentPort = intentPort;
  }

  /**
   * 登记每帧需要刷新画面的表现组件（如 CameraRig）。
   */
  addRefreshable(refreshable: FrameRefreshable): void {
    this.refreshables.push(refreshable);
  }

  /**
   * Cocos 生命周期：每帧回调。
   *
   * @param frameDurationSeconds 本帧时长（秒；Cocos update
   *        原生 deltaTime 参数口径）
   */
  update(frameDurationSeconds: number): void {
    // —— 第 ① 步：InputCollector 整理本帧原始输入为意图 ——
    if (this.inputCollector === null) {
      return;
    }
    const intents: ReadonlyArray<PlayerIntent> =
      this.inputCollector.collectFrameIntents();

    // —— 第 ② 步：意图 + 本帧时长交 director 意图窄口 ——
    if (this.intentPort !== null) {
      this.intentPort.submitFrameIntents(intents, frameDurationSeconds);
    }

    // —— 第 ③ 步：通知表现组件读取最新状态并刷新画面 ——
    for (const refreshable of this.refreshables) {
      refreshable.onFrameRefresh();
    }
  }
}
