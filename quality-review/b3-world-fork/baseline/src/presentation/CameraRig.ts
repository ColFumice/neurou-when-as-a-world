// ============================================================
// P 表现层 · CameraRig 镜头装置（名库 v1.9 / VERDICT-094 冻结名）
//
// 职责（验收口径）：
//   AC-02 镜头中心始终对准主角（跟随目标）；
//   AC-03 按视距调整可视范围；
//   AC-04 沿路线旋转（灰盒占位，旋转逻辑待场景接线）。
//
// 关键归属（VERDICT-094 / HANDOFF）：
//   ViewDistance（视距）是表现层显示状态，由 CameraRig
//   自己保存；调整视距不经过叙事导演，不进入 PlayerIntent，
//   也不进入任何逻辑模块——滚轮 / 捏合由 InputCollector
//   直接调用 adjustViewDistance。视距上下限为视觉参数，
//   按 HANDOFF 要求不放入 constants，先以本文件内占位常量
//   承载，数值待美术 / 表现侧冻结。
//
// 灰盒边界：本文件不做向量计算、不写美术细节；位置仅记录
// 跟随目标的两轴坐标（结构同 world 轴坐标），AC-06 的
// ScaleRef（SCALE_REF_WM = 1.6）由 ProtagonistView 在
// 渲染节点高度处消费，不在镜头装置内消费。
//
// Cocos 绑定（HANDOFF-ROUND-13 / VERDICT-094 偏差 1 解锁）：
//   本工程已通过 types/cc.d.ts ambient 类型桩模拟 Cocos
//   Creator 3.8.8 引擎类型；引擎导入后由真实 cc 类型覆盖桩，
//   方法签名不变。本文件现已引用 `import { _decorator,
//   Component, Node, Vec3 } from 'cc'`，并补齐 @ccclass /
//   extends Component。
// ============================================================

import { _decorator, Component } from 'cc';
import type { FrameRefreshable } from './FrameDriver';
import type { LateralAxis } from '../world/LateralAxis';
import type { DepthAxis } from '../world/DepthAxis';
import type { Protagonist } from '../character/Protagonist';

const { ccclass } = _decorator;

// —— 视觉参数（仅表现层；禁止移入 constants）——
// 以下三个数值为灰盒占位，名库 / HANDOFF 均未冻结，
// 待表现侧冻结后在本文件内更新，单位仅作显示口径。
const DEFAULT_VIEW_DISTANCE = 10;
const MIN_VIEW_DISTANCE = 6;
const MAX_VIEW_DISTANCE = 16;

/** 跟随目标的两轴坐标（结构同 world.PlanePosition，不新增名称） */
interface FollowTarget {
  readonly lateral: LateralAxis;
  readonly depth: DepthAxis;
}

/**
 * CameraRig 镜头装置组件
 */
@ccclass('CameraRig')
export class CameraRig extends Component implements FrameRefreshable {
  /**
   * ViewDistance 视距（AC-03）：CameraRig 自有显示状态。
   * 仅影响可视范围，不回写主角任何坐标。
   */
  private viewDistance: number = DEFAULT_VIEW_DISTANCE;

  /**
   * 当前跟随目标（主角）；未接线前以中点原点占位。
   * 优先使用 protagonist 实例动态读取，回退使用 followTarget
   * 静态注入（供未来 cutscene / 镜头切换等场景）。
   */
  private protagonist: Protagonist | null = null;
  private followTarget: FollowTarget = { lateral: 0, depth: 0 };

  /** Cocos 生命周期 */
  onLoad(): void {
    // 灰盒：引擎导入后在此初始化相机节点与初始视距。
  }

  /**
   * 接线主角实例（AC-02 拉模式）。
   * 主角实例由 R 边注入，仅读取 getPosition，不修改主角坐标。
   */
  bindProtagonist(protagonist: Protagonist): void {
    this.protagonist = protagonist;
  }

  /**
   * 调整视距（AC-03）。
   *
   * 唯一调用方为 InputCollector（滚轮 / 捏合），路径不经过
   * director；裁剪到本文件占位上下限内。
   *
   * @param delta 视距变化量（放大为正、缩小为负）
   */
  adjustViewDistance(delta: number): void {
    const next = this.viewDistance + delta;
    if (next < MIN_VIEW_DISTANCE) {
      this.viewDistance = MIN_VIEW_DISTANCE;
    } else if (next > MAX_VIEW_DISTANCE) {
      this.viewDistance = MAX_VIEW_DISTANCE;
    } else {
      this.viewDistance = next;
    }
    // AC-03 保证：此处只改本组件显示状态，
    // 不修改 followTarget 的纵深坐标或距中点距离。
  }

  /**
   * 读取当前视距（显示状态只读访问；方法名为直译，待追认）。
   */
  getViewDistance(): number {
    return this.viewDistance;
  }

  /**
   * 设置跟随目标（AC-02；接线方法名直译，待追认）。
   * 灰盒阶段优先使用 protagonist 实例动态读取，本静态注入
   * 作为回退路径（供 cutscene / 镜头切换使用）。
   */
  setFollowTarget(target: FollowTarget): void {
    this.followTarget = target;
  }

  /**
   * 当前路线转角（度）。AC-04：至少一段路线会让镜头随路线
   * 旋转；由场景接线（SceneBuilder）依据主角是否位于旋转
   * 路段每帧调用 rotateAlongRoute 更新。0 = 不旋转。
   */
  private routeAngleDegrees = 0;

  /**
   * 沿路线旋转镜头（AC-04）。
   *
   * 灰盒口径：转角施加到 CameraRig 节点的 Y 轴欧拉角；
   * 实际 Camera 组件挂在本节点的子节点（保持俯视偏移），
   * 父节点旋转即“镜头随路线旋转”。
   *
   * @param routeAngleDegrees 路线转角（度，显示口径）
   */
  rotateAlongRoute(routeAngleDegrees: number): void {
    this.routeAngleDegrees = routeAngleDegrees;
  }

  /**
   * 第 ③ 步刷新回调：镜头中心始终对准主角（AC-02），
   * 并按当前路线转角旋转（AC-04）。
   *
   * 拉模式：若已注入 protagonist 实例，读取其当前位置作为
   * 镜头中心；否则回退到 setFollowTarget 注入的静态目标。
   * AC-03 保证：本回调只读取主角坐标，不写入主角状态。
   */
  onFrameRefresh(): void {
    const target = this.resolveFollowTarget();
    if (this.node !== null) {
      // AC-02：镜头装置节点 XZ 平面对齐主角位置（相机本体
      // 为子节点，保留俯视高度 / 前后偏移）。
      this.node.setPosition(target.lateral, 0, target.depth);
      // AC-04：随路线转角绕 Y 轴旋转镜头。
      this.node.setRotationFromEuler(0, this.routeAngleDegrees, 0);
    }
  }

  /** 解析当前镜头跟随目标（优先 protagonist 实例；回退静态注入） */
  private resolveFollowTarget(): FollowTarget {
    if (this.protagonist !== null) {
      const position = this.protagonist.getPosition();
      return { lateral: position.lateral, depth: position.depth };
    }
    return this.followTarget;
  }
}
