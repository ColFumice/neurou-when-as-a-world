/** P · projecttree：暗角覆盖层样式。 */

export class VignetteEffect {
  static style(strength = 0.62): Record<string, string | number> {
    return {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,${strength}) 100%)`,
    };
  }
}
