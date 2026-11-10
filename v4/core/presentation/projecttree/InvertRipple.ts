/**
 * P · projecttree：反色扩张滤镜圆。
 * 参考 ripple 模式：平滑扩张的圆形、软边、先快后慢的扩张曲线。
 * 用白色径向渐变 + mix-blend-mode:difference 实现圆内反色；
 * 不使用 backdrop-filter（WebView2 在 WebGL canvas 上可能卡死）。
 */

export class InvertRipple {
  static ease(progress: number): number {
    return Math.log(1 + 4 * progress) / Math.log(5);
  }

  static style(
    x: number,
    y: number,
    progress: number,
    width = 960,
    height = 540,
  ): Record<string, string | number> {
    const clamped = Math.min(1, Math.max(0, progress));
    const eased = InvertRipple.ease(clamped);
    const r0 = 80;
    const radius = r0 + (Math.sqrt(width * width + height * height) - r0) * eased;
    const soft = 8 + Math.min(radius, 600) * 0.02;
    const inner = Math.max(0, radius - soft);

    return {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      mixBlendMode: 'difference',
      background: `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.98) 0px, rgba(255,255,255,0.98) ${inner}px, rgba(255,255,255,0) ${radius}px)`,
      opacity: Math.max(0.05, 1 - clamped * 0.88),
    };
  }

  /** 波纹结束后的短暂曝光脉冲。 */
  static exposure(progress: number): Record<string, string | number> {
    const clamped = Math.min(1, Math.max(0, progress));
    return {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: 'radial-gradient(circle, rgba(255,255,255,0.16), rgba(255,255,255,0) 62%)',
      opacity: Math.max(0, 1 - clamped),
      mixBlendMode: 'screen',
    };
  }
}
