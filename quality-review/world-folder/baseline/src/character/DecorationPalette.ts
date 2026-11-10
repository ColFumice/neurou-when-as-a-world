// ============================================================
// 角色外观域 · DecorationPalette 装饰配色
// 名库 v0.5 冻结名：DecorationPalette（外观域）
// 本文件实现“种子 + 背景色 → 装饰颜色集合”的基础草图
// （简单 RGB 偏移，非最终颜色映射公式）
// ============================================================

/**
 * DecorationPalette 装饰配色
 * HANDOFF-ROUND-05 指定：依据世界种子与背景色生成颜色集合。
 *
 * 背景色与装饰颜色均无名库专用冻结结构名，故以匿名 RGB
 * 结构承载（TrailColor 为痕迹拖尾颜色，HairColor 为发色，
 * 语义均不符，禁止挪用）。
 */
export class DecorationPalette {
  /**
   * 依据世界种子与背景色生成装饰颜色集合（基础草图）
   *
   * - worldSeed / backgroundColor / generateColorSet：
   *   HANDOFF-ROUND-11 正式追认冻结；
   * - 集合数量 3 与散列系数仍为草图占位值，非常量冻结结论
   *   （ROUND-11 未列入冻结项）。
   */
  generateColorSet(
    worldSeed: number,
    backgroundColor: { r: number; g: number; b: number },
  ): Array<{ r: number; g: number; b: number }> {
    const colors: Array<{ r: number; g: number; b: number }> = [];
    // 草图占位数量（待常量化），非最终设计
    const sketchCount = 3;

    for (let index = 0; index < sketchCount; index++) {
      const offset = this.sketchOffset(worldSeed, index);
      colors.push({
        r: this.clampChannel(backgroundColor.r - offset),
        g: this.clampChannel(backgroundColor.g + offset),
        b: this.clampChannel(backgroundColor.b + offset * 2),
      });
    }
    return colors;
  }

  /**
   * 草图用确定性通道偏移（简单取模散列，非平衡数值）
   */
  private sketchOffset(worldSeed: number, index: number): number {
    return (Math.abs(worldSeed * 37 + index * 23) % 31) - 15;
  }

  /**
   * RGB 通道裁剪到 [0, 255]（基础数学）
   */
  private clampChannel(value: number): number {
    if (value < 0) {
      return 0;
    }
    if (value > 255) {
      return 255;
    }
    return Math.round(value);
  }
}
