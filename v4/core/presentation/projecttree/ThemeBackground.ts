import type { ProjectTheme } from '../../studio/projectTree';

/** P · projecttree：程序化主题背景占位；不 import DOM/Pixi。 */

interface ThemeBackgroundSpec {
  readonly width: number;
  readonly height: number;
  readonly gridSpacing: number;
  readonly noiseSeed: number;
  readonly kenBurnsPeriodMs: number;
  readonly base: string;
  readonly accent: string;
}

interface ThemeCanvasContext {
  fillStyle: unknown;
  fillRect(x: number, y: number, width: number, height: number): void;
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): { addColorStop(offset: number, color: string): void };
}

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function nextRandom(state: { value: number }): number {
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0;
  return state.value / 0x1_0000_0000;
}

function rgba(theme: ProjectTheme, alpha: number): string {
  return `rgba(${theme.r}, ${theme.g}, ${theme.b}, ${alpha})`;
}

export class ThemeBackground {
  private customImage: unknown = null;

  constructor(customImage?: unknown) {
    this.customImage = customImage ?? null;
  }

  static createSpec(theme: ProjectTheme, seed: string): ThemeBackgroundSpec {
    const hash = hashSeed(`${seed}:${theme.r}:${theme.g}:${theme.b}`);
    return {
      width: 1920,
      height: 1080,
      gridSpacing: 48 + (hash % 5) * 8,
      noiseSeed: hash,
      kenBurnsPeriodMs: 20_000,
      base: `rgb(${Math.round(theme.r * 0.14)}, ${Math.round(theme.g * 0.14)}, ${Math.round(theme.b * 0.14)})`,
      accent: rgba(theme, 0.42),
    };
  }

  setCustomImage(image: unknown): void {
    this.customImage = image;
  }

  getCustomImage(): unknown {
    return this.customImage;
  }

  hasCustomImage(): boolean {
    return this.customImage !== null;
  }

  render(
    context: ThemeCanvasContext,
    theme: ProjectTheme,
    seed: string,
  ): ThemeBackgroundSpec {
    const spec = ThemeBackground.createSpec(theme, seed);
    const gradient = context.createLinearGradient(0, 0, spec.width, spec.height);
    gradient.addColorStop(0, spec.base);
    gradient.addColorStop(0.52, spec.accent);
    gradient.addColorStop(1, '#05070a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, spec.width, spec.height);

    context.fillStyle = rgba(theme, 0.08);
    for (let x = 0; x < spec.width; x += spec.gridSpacing) {
      context.fillRect(x, 0, 1, spec.height);
    }
    for (let y = 0; y < spec.height; y += spec.gridSpacing) {
      context.fillRect(0, y, spec.width, 1);
    }

    const random = { value: spec.noiseSeed };
    context.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let index = 0; index < 900; index += 1) {
      const x = Math.floor(nextRandom(random) * spec.width);
      const y = Math.floor(nextRandom(random) * spec.height);
      context.fillRect(x, y, 1, 1);
    }

    return spec;
  }
}
