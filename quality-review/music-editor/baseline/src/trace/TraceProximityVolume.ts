// ============================================================
// S3 痕接口 · TraceProximityVolume 痕接近音量（T6 / AC-12）
// 名库 v2.3 冻结名：TraceProximityVolume（trace 模块）
//
// 文件职责：
//   根据主角到痕的距离计算背景音乐的音量（越近越大），
//   供表现层设置占位 BGM 的音量（AC-12：越靠近痕音量越大）。
//
// 边界（名库 v2.3 / HANDOFF-ROUND-17 明示）：
//   ✗ 只调节音量——不改变节拍、播放速度或判定窗口
//     （RHYTHM_STRIKE_WINDOW_MS 判定口径不受音量影响）
//   ✗ 不引用 cc（逻辑模块）；不播放音频（播放归表现层）
//   ✗ 不写账本、不实现向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：trace 为矩阵内模块；本文件
//   零外部依赖（衰减参数为本文件内部占位，不进 constants）。
// ============================================================

/**
 * TraceProximityVolume 痕接近音量（名库 v2.3 冻结类型名）
 *
 * 线性衰减灰盒口径：距痕 maxAudibleDistanceWm 及以远音量为 0，
 * 距痕为 0 时音量为 1，中间线性过渡（越近越大）。
 * 衰减上界为本文件内部占位参数（HANDOFF-ROUND-17 未冻结数值，
 * 不进入 constants，待 PROTOCOL 冻结后仅在本文件更新）。
 */
export class TraceProximityVolume {
  /**
   * 最远可闻距离（WorldMeter，占位 8；超过该距离音量为 0）。
   * 占位值来源：HANDOFF-ROUND-17 未冻结衰减参数，由实现方
   * 占位；待 PROTOCOL 冻结登记。
   */
  private readonly maxAudibleDistanceWm = 8;

  /**
   * 按主角到痕的距离计算背景音乐音量（AC-12）。
   *
   * 只调节音量：返回 [0, 1] 区间的标量，供表现层直接设置
   * 播放音量；不改变节拍、播放速度或判定窗口。
   * 方法名 calculateVolume 为"计算音量"直译，待 PROTOCOL 追认。
   *
   * @param distanceWm 主角到痕的平面距离（WorldMeter）
   * @returns 音量标量（0 = 静音，1 = 最响；越近越大）
   */
  calculateVolume(distanceWm: number): number {
    if (distanceWm >= this.maxAudibleDistanceWm) {
      return 0;
    }
    if (distanceWm <= 0) {
      return 1;
    }
    const ratio = 1 - distanceWm / this.maxAudibleDistanceWm;
    if (ratio < 0) {
      return 0;
    }
    if (ratio > 1) {
      return 1;
    }
    return ratio;
  }
}
