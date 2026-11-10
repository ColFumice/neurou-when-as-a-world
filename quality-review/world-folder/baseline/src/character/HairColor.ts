// ============================================================
// 角色外观域 · HairColor 发色
// 名库 v0.5 冻结名：HairColor（外观域）
// 本文件实现 RGB 基础结构与“种子 + 背景色 → 发色集合”的
// 基础草图（简单 RGB 偏移，非最终颜色映射公式）
// ============================================================

/**
 * HairColor 发色（RGB 结构）
 * HANDOFF-ROUND-05 授权以简单 RGB 偏移算法生成颜色集合草图。
 */
export class HairColor {
  constructor(
    readonly r: number,
    readonly g: number,
    readonly b: number,
  ) {}

  /**
   * 依据世界种子与背景色生成发色集合（基础草图）
   *
   * - worldSeed / backgroundColor / generateColorSet：
   *   HANDOFF-ROUND-11 正式追认冻结（背景色以匿名 RGB
   *   结构承载，TrailColor 语义不符禁止挪用）；
   * - 集合数量 3 与散列系数仍为草图占位值，非数值平衡
   *   结论，待后续常量化（ROUND-11 未列入冻结项）。
   *
   * 本方法只做确定性散列 + 固定偏移的草图，不包含
   * EmotionToTrailColor 等正式颜色映射公式（明令禁止）。
   */
  static generateColorSet(
    worldSeed: number,
    backgroundColor: { r: number; g: number; b: number },
  ): HairColor[] {
    const colors: HairColor[] = [];
    // 草图占位数量（待常量化），非最终设计
    const sketchCount = 3;

    for (let index = 0; index < sketchCount; index++) {
      const offset = HairColor.sketchOffset(worldSeed, index);
      colors.push(
        new HairColor(
          HairColor.clampChannel(backgroundColor.r + offset),
          HairColor.clampChannel(backgroundColor.g + offset * 2),
          HairColor.clampChannel(backgroundColor.b - offset),
        ),
      );
    }
    return colors;
  }

  /**
   * 草图用确定性通道偏移（简单取模散列，非平衡数值）
   */
  private static sketchOffset(worldSeed: number, index: number): number {
    return (Math.abs(worldSeed * 31 + index * 17) % 41) - 20;
  }

  /**
   * RGB 通道裁剪到 [0, 255]（基础数学）
   */
  private static clampChannel(value: number): number {
    if (value < 0) {
      return 0;
    }
    if (value > 255) {
      return 255;
    }
    return Math.round(value);
  }
}
