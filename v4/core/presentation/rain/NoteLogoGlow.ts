type RainLevel = 'Light' | 'Moderate' | 'Heavy';

/**
 * P · presentation / NoteLogoGlow
 * intensity → 可直接用于 filter: drop-shadow(...) 的纯字符串。
 */
export class NoteLogoGlow {
  static forIntensity(intensity: RainLevel): string {
    if (intensity === 'Heavy') {
      return 'drop-shadow(0 0 14px rgba(176, 232, 255, 0.82))';
    }
    if (intensity === 'Moderate') {
      return 'drop-shadow(0 0 8px rgba(184, 235, 255, 0.62))';
    }
    return 'drop-shadow(0 0 4px rgba(196, 240, 255, 0.42))';
  }
}
