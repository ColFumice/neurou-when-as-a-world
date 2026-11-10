/** P · console：控制台效果配置；不涉及渲染实现。 */
export enum ConsoleEffect {
  /** 随机刻扫描线（模拟 CRT 逐行刷新）。 */
  Scanline = 'Scanline',
  /** 闪烁。 */
  Flicker = 'Flicker',
  /** 故障。 */
  Glitch = 'Glitch',
  /** 鱼眼全屏扭曲。 */
  Fisheye = 'Fisheye',
  /** 无效果。 */
  None = 'None',
}
