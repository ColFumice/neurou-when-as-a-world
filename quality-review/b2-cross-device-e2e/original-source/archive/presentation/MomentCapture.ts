// ============================================================
// 事件空间视图域 · MomentCapture 截图与后处理
// 名库冻结名：MomentCapture、MomentImage、ProcessedMomentImage
//
// 命名状态：source 与 appliedGaussianBlurSigma /
// appliedBrightnessGain / appliedDownscaleRatio 三字段
// 已经 HANDOFF-ROUND-11 正式追认冻结，不再重命名。
//
// 参数状态：三参数占位值 0 / 1 / 1 经 ROUND-11 确认为
// 安全占位值（允许画面零改变），非最终后处理参数。
//
// 本文件只定义“高斯模糊 → 亮度提升 → 降分辨率”的清晰
// 逻辑流程与参数占位，不包含任何图形渲染 / 像素操作代码；
// 不做颜色映射解释
// ============================================================

import {
  GAUSSIAN_BLUR_SIGMA,
  BRIGHTNESS_GAIN,
  DOWNSCALE_RATIO,
} from '../../constants';

/**
 * MomentImage 截图原始数据（正式冻结）
 *
 * 像素缓冲、尺寸等字段名库尚未冻结，暂为空接口占位；
 * 本流程不读取像素。
 */
export interface MomentImage {
  // 截图原始数据结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * ProcessedMomentImage 后处理截图（正式冻结）
 *
 * 当前只承载原图引用与三步处理实际采用的参数记录，
 * 不包含任何渲染后的像素数据；字段经 ROUND-11 追认冻结
 * （见文件头部命名状态）。
 */
export interface ProcessedMomentImage {
  /** 处理前的原始截图引用 */
  source: MomentImage;
  /** 实际采用的高斯模糊强度 */
  appliedGaussianBlurSigma: number;
  /** 实际采用的亮度增益 */
  appliedBrightnessGain: number;
  /** 实际采用的降分辨率比例 */
  appliedDownscaleRatio: number;
}

/**
 * 中间产物：模糊后 / 提亮后的逻辑占位载体。
 * 仅用于表达流程分步，不持有像素数据。
 */
interface ProcessingStage {
  source: MomentImage;
  /** 截至本步已应用的参数记录 */
  applied: Partial<ProcessedMomentImage>;
}

/**
 * MomentCapture 瞬间截图
 */
export class MomentCapture {
  /**
   * 截图后处理（HANDOFF 指定方法签名与三步顺序）
   *
   * 流程严格固定为：
   *   1. 高斯模糊（参数 GAUSSIAN_BLUR_SIGMA）
   *   2. 亮度提升（参数 BRIGHTNESS_GAIN）
   *   3. 降分辨率（参数 DOWNSCALE_RATIO）
   * 三步顺序属于行为契约，禁止为性能或效果擅自调换。
   */
  applyPostProcess(screenshot: MomentImage): ProcessedMomentImage {
    const blurred = this.applyGaussianBlur(screenshot);
    const brightened = this.liftBrightness(blurred);
    const downscaled = this.reduceResolution(brightened);
    return downscaled;
  }

  /**
   * 步骤 1：高斯模糊（逻辑占位，无渲染代码）
   */
  private applyGaussianBlur(screenshot: MomentImage): ProcessingStage {
    // 渲染实现待后续授权；当前仅登记本步参数
    return {
      source: screenshot,
      applied: { appliedGaussianBlurSigma: GAUSSIAN_BLUR_SIGMA },
    };
  }

  /**
   * 步骤 2：亮度提升（逻辑占位，无渲染代码）
   */
  private liftBrightness(stage: ProcessingStage): ProcessingStage {
    return {
      source: stage.source,
      applied: {
        ...stage.applied,
        appliedBrightnessGain: BRIGHTNESS_GAIN,
      },
    };
  }

  /**
   * 步骤 3：降分辨率（逻辑占位，无渲染代码），收敛为返回对象
   */
  private reduceResolution(stage: ProcessingStage): ProcessedMomentImage {
    return {
      source: stage.source,
      appliedGaussianBlurSigma: stage.applied.appliedGaussianBlurSigma ?? 0,
      appliedBrightnessGain: stage.applied.appliedBrightnessGain ?? 1,
      appliedDownscaleRatio: DOWNSCALE_RATIO,
    };
  }
}
