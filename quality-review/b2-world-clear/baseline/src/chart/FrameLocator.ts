// ============================================================
// C 谱面域 · FrameLocator 帧定位与 UV→RGBA 转换（名库 v2.5）
//
// 依据：
// - HANDOFF-ROUND-18 任务 3：提取帧定位与像素采样适配，
//     保留时间码、实际帧媒体时间及 UV→像素转换规范；
// - ColorMusic UV→RGBA 索引算法（C-032）：只做算法适配，
//     不整段照搬，不引入其依赖。
//
// 用途边界（严格）：
//   帧采样仅用于制作辅助、诊断或装饰；没有消费者时不启动
//   持续采样。不得从像素颜色生成 Note、得分或账本数据。
//   本文件只提供纯转换数学；真正读取 RGBA 缓冲（readPixels /
//   Canvas）在 presentation。
//
// 关键行序语义（必须随采样注明）：
//   - u 左→右，v 下→上；
//   - 原生网格行 0 = 顶部，故顶部行号使用 (1-v)；
//   - readPixels 缓冲行 0 = 纹理底部（OpenGL），
//     显示顶行 = 缓冲最后一行；
//   - RGBA 字节偏移 = (row*width + x)*4。
//
// 禁止：零 cc 依赖；不读取任何在线像素；不发声。
// ============================================================

/** 显示像素坐标（yTop 自显示顶部起算）。 */
export interface DisplayPixel {
  readonly x: number;
  readonly yTop: number;
}

/** 将值裁剪到 [0,1]（保留参考算法的 clamp 语义）。 */
function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

/**
 * 由谱面时间码派生帧序号（恒定帧率、起始时间为 0）。
 *
 * frameIndex = floor(timeMs × fps / 1000)。
 * 仅在恒定帧率且媒体起始为 0 时成立；存在起始偏移须先扣除，
 * 可变帧率应使用实际 PTS / mediaTime，不能使用本函数。
 * 音频 sample frame 与视频帧必须区分，本函数只描述视频帧。
 *
 * @param timeMs 谱面时间码（毫秒，非负）
 * @param framesPerSecond 恒定帧率（>0）
 */
export function resolveFrameIndex(
  timeMs: number,
  framesPerSecond: number,
): number {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new Error(`FrameLocator: timeMs 非法 (${timeMs})`);
  }
  if (!Number.isFinite(framesPerSecond) || framesPerSecond <= 0) {
    throw new Error(`FrameLocator: framesPerSecond 必须为正 (${framesPerSecond})`);
  }
  return Math.floor((timeMs * framesPerSecond) / 1000);
}

/**
 * UV → 显示像素坐标（保留 C-032 的 clamp 与 (1-v) 顶行语义）。
 *
 * @param width 帧宽（像素，正整数）
 * @param height 帧高（像素，正整数）
 */
export function resolveDisplayPixel(
  u: number,
  v: number,
  width: number,
  height: number,
): DisplayPixel {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('FrameLocator: width / height 必须为正整数');
  }
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    throw new Error('FrameLocator: UV 必须为有限值');
  }
  const cu = clamp01(u);
  const cv = clamp01(v);
  const x = Math.min(width - 1, Math.floor(cu * width));
  // 原生网格行 0 在顶部：自顶部起算的行号用 (1-v)。
  const yTop = Math.min(height - 1, Math.floor((1 - cv) * height));
  return { x, yTop };
}

/**
 * UV → RGBA 字节偏移（readPixels 缓冲，行 0 在底部）。
 *
 * 缓冲行 = (height-1) - 显示顶行；offset = (row*width + x)*4。
 *
 * @returns RGBA 首字节（R）在像素缓冲中的下标
 */
export function resolveRgbaByteOffset(
  u: number,
  v: number,
  width: number,
  height: number,
): number {
  const pixel = resolveDisplayPixel(u, v, width, height);
  const bufferRow = height - 1 - pixel.yTop;
  return (bufferRow * width + pixel.x) * 4;
}
