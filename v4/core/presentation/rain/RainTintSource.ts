/**
 * P · presentation / RainTintSource
 * themeColor → 雨色 tint 的 CSS 值；不负责实际合成（R4e.2b）。
 */
export class RainTintSource {
  static readonly mixBlendMode = 'soft-light';

  static forThemeColor(themeColor: string): string {
    const color = /^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : '#607684';
    return `color-mix(in srgb, ${color} 38%, transparent)`;
  }
}
