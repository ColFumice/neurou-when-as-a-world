// ============================================================
// P 表现层 · PerceptionFilter 感知滤镜组件（T5 / AC-10）
// 文件路径：src/presentation/PerceptionFilter.ts
// 组件类型：PerceptionFilter（HANDOFF-ROUND-16 明示，
//           Cocos 组件）
//
// 职责（AC-10）：
//   - Normal 普通模式：画面为低饱和；
//   - Triggered 触发模式：画面恢复正常（ Concealed 实体的
//     显隐由 ElementEntityView 按模式呈现，不在本组件）。
//
// 低饱和实现（HANDOFF-ROUND-17 任务五 / VERDICT-110 复验，
// AC-10 分项 2：场景主体确实呈低饱和，而非只变背景色）：
//   - 场景主体：SceneBuilder 经 bindDesaturationTargets 注入
//     "材质 + 原始颜色"目标；Normal 模式下把每份主体材质
//     mainColor 按强度 DESATURATION_STRENGTH 向亮度灰度靠拢
//     （标准亮度加权和），Triggered 模式恢复原始颜色。
//   - 背景清屏色沿用原灰盒占位（clearColor 双色切换）。
//   - 世界观允许的少量色彩：以 DESATURATION_STRENGTH 显式
//     配置保留比例（阶段 1 统一保留 15% 饱和度，待冻结登记）；
//     六元素饱和度层级待美术阶段细分。
//   - 这是灰盒颜色处理而非感绪→颜色的颜色映射（HANDOFF 禁
//     颜色映射指 EmotionToTrailColor 体系）；
//     真实后处理 / LUT 接入后替换本组件内部，组件签名不变。
//
// 依赖矩阵（stage-1.md §6）：
//   presentation → director I（IntentPort，仅 import type）
//   presentation 可引用 cc
//
// 边界：
//   ✗ 不保存感知模式权威副本（模式权威在 DirectorSession）
//   ✗ 不写账本、不做向量计算 / 网络同步 / 颜色映射 / 雨模式
// ============================================================

import { _decorator, Component, Camera, Color, Material } from 'cc';
import type { IntentPort } from '../director/IntentPort';
import type { FrameRefreshable } from './FrameDriver';

const { ccclass } = _decorator;

/** Normal 模式占位背景色：低饱和灰（灰盒视觉信号） */
const NORMAL_MODE_CLEAR_COLOR = new Color(150, 152, 158, 255);

/** Triggered 模式占位背景色：天空蓝（同 SceneBuilder 初始清屏色） */
const TRIGGERED_MODE_CLEAR_COLOR = new Color(135, 175, 220, 255);

// ------------------------------------------------------------
// 低饱和配置（表现层配置，阶段 1 占位，待冻结登记；
// HANDOFF-ROUND-17 明示 constants 本轮仅新增
// RHYTHM_STRIKE_WINDOW_MS，故占位在本消费文件内部）。
// ------------------------------------------------------------

/** 低饱和强度（0~1，占位）：1 = 全灰，0 = 原色。阶段 1 取
 *  0.85——场景主体向亮度灰度靠拢 85%，显式保留 15% 原色
 *  饱和度（世界观允许的少量色彩，待美术阶段细分六元素层级）。 */
const DESATURATION_STRENGTH = 0.85;

/**
 * 低饱和目标（文件内私有结构，不导出新名称）。
 * material：场景主体的材质（其 mainColor 被本组件改写）；
 * originalColor：该材质的原始颜色（Triggered 模式恢复用，
 * 由 SceneBuilder 创建材质时注入，组件不读取真实引擎的
 * Material.getProperty——阶段 1 类型桩未声明该方法）。
 */
interface DesaturationTarget {
  readonly material: Material;
  readonly originalColor: Color;
}

/**
 * PerceptionFilter 感知滤镜组件（HANDOFF-ROUND-16 明示类型名）
 *
 * 由 SceneBuilder 挂在承载 3D 主相机的节点（或独立节点），
 * bindCamera 注入相机、bindIntentPort 注入意图窄口；
 * FrameDriver 第 ③ 步每帧回调，按当前感知模式切换占位滤镜。
 */
@ccclass('PerceptionFilter')
export class PerceptionFilter extends Component implements FrameRefreshable {
  /** 3D 主相机（灰盒：对其 clearColor 应用占位模式色） */
  private camera: Camera | null = null;

  /** 意图窄口（I 边：只读 getCurrentPerceptionMode） */
  private intentPort: IntentPort | null = null;

  /** 上次已应用的模式（避免每帧重复创建 / 赋值） */
  private lastAppliedMode: string | null = null;

  /** 低饱和目标集（场景主体材质 + 原始颜色，bindDesaturationTargets 注入） */
  private readonly desaturationTargets: DesaturationTarget[] = [];

  /**
   * 接线 3D 主相机（方法名直译，待追认）。
   */
  bindCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * 接线意图窄口（方法名直译，待追认；仅读取当前模式）。
   */
  bindIntentPort(intentPort: IntentPort): void {
    this.intentPort = intentPort;
  }

  /**
   * 接线低饱和目标（方法名直译，待追认）。
   * SceneBuilder 装配时传入场景主体（地面 / 路段 / 元素实体等
   * 灰盒方块）的材质与其原始颜色；仅接收引用，不改写原始色。
   *
   * @param targets 低饱和目标集合
   */
  bindDesaturationTargets(targets: ReadonlyArray<DesaturationTarget>): void {
    for (const target of targets) {
      this.desaturationTargets.push(target);
    }
  }

  /**
   * 第 ③ 步回调：按当前感知模式应用滤镜（AC-10）。
   * 模式未变化时不重复设置；主体材质低饱和 + 背景清屏色
   * 双通道同步切换。
   */
  onFrameRefresh(): void {
    if (this.camera === null || this.intentPort === null) {
      return;
    }
    const mode = this.intentPort.getCurrentPerceptionMode();
    if (mode === this.lastAppliedMode) {
      return;
    }
    this.lastAppliedMode = mode;

    if (mode === 'Triggered') {
      // 触发模式：恢复正常——主体材质恢复原始颜色 + 天空蓝背景。
      this.applyDesaturation(false);
      this.camera.clearColor = TRIGGERED_MODE_CLEAR_COLOR;
    } else {
      // 普通模式（Normal；'Rain' 阶段 1 不产生）：主体材质低
      // 饱和 + 低饱和灰背景。
      this.applyDesaturation(true);
      this.camera.clearColor = NORMAL_MODE_CLEAR_COLOR;
    }
  }

  /**
   * 应用 / 恢复场景主体低饱和（AC-10 分项 2）。
   *
   * toDesaturated = true：每份目标材质 mainColor 改写为
   * "亮度灰度与原色按 DESATURATION_STRENGTH 插值"的结果；
   * false：恢复注入时的原始颜色。纯标量颜色处理，不含
   * EmotionToTrailColor 体系的颜色映射。
   */
  private applyDesaturation(toDesaturated: boolean): void {
    for (const target of this.desaturationTargets) {
      if (toDesaturated) {
        const original = target.originalColor;
        // 标准亮度加权和（ITU-R BT.601 luma 系数），纯标量。
        const luma =
          0.299 * original.r + 0.587 * original.g + 0.114 * original.b;
        const mix = (channel: number): number =>
          Math.round(
            channel + (luma - channel) * DESATURATION_STRENGTH,
          );
        target.material.setProperty(
          'mainColor',
          new Color(
            mix(original.r),
            mix(original.g),
            mix(original.b),
            original.a,
          ),
        );
      } else {
        target.material.setProperty('mainColor', target.originalColor);
      }
    }
  }
}
