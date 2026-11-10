type RainLevel = 'Light' | 'Moderate' | 'Heavy';

/**
 * P · presentation / RainVisualConfig
 * 只输出可序列化的视觉参数与 CSS variables；不依赖 React / Pixi / DOM。
 */
export class RainVisualConfig {
  readonly intensity: RainLevel;
  readonly density: number;
  readonly streakSpeed: number;
  readonly opacity: number;
  readonly blur: number;
  readonly tint: string;
  readonly glowStrength: number;

  private constructor(
    intensity: RainLevel,
    density: number,
    streakSpeed: number,
    opacity: number,
    blur: number,
    tint: string,
    glowStrength: number,
  ) {
    this.intensity = intensity;
    this.density = density;
    this.streakSpeed = streakSpeed;
    this.opacity = opacity;
    this.blur = blur;
    this.tint = tint;
    this.glowStrength = glowStrength;
  }

  static forIntensity(intensity: RainLevel): RainVisualConfig {
    if (intensity === 'Heavy') {
      return new RainVisualConfig(
        intensity,
        1,
        1,
        0.72,
        4.5,
        'rgba(168, 214, 232, 0.34)',
        0.72,
      );
    }
    if (intensity === 'Moderate') {
      return new RainVisualConfig(
        intensity,
        0.62,
        0.7,
        0.52,
        2.4,
        'rgba(180, 222, 238, 0.25)',
        0.46,
      );
    }
    return new RainVisualConfig(
      intensity,
      0.32,
      0.42,
      0.3,
      1.2,
      'rgba(192, 230, 242, 0.16)',
      0.24,
    );
  }

  /** CSS variables；由 R4e.2b 的 RainLayer 消费。 */
  get cssVariables(): Readonly<Record<string, string>> {
    return {
      '--rain-density': String(this.density),
      '--rain-streak-speed': String(this.streakSpeed),
      '--rain-opacity': String(this.opacity),
      '--rain-blur': `${this.blur}px`,
      '--rain-tint': this.tint,
      '--rain-glow-strength': String(this.glowStrength),
    };
  }
}
