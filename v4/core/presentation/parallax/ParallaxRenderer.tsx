import * as PIXI from 'pixi.js';
import type { WorldInstance } from '../../world/types';
import type { VisualFrame } from '../../world/frame';
import type { TimelineStateMachine } from '../../timeline/types';
import { ParallaxCamera } from './ParallaxCamera';

interface RenderFrame {
  readonly world: WorldInstance;
  readonly visualFrame: VisualFrame;
  readonly timeline: TimelineStateMachine;
}

interface LayerSpec {
  readonly label: string;
  readonly color: number;
  readonly widthRatio: number;
  readonly heightRatio: number;
  readonly alpha: number;
  readonly pattern: 'grid' | 'diagonal' | 'horizontal';
}

const LAYER_SPECS: readonly LayerSpec[] = [
  {
    label: 'L1 / BACKGROUND',
    color: 0x101c2c,
    widthRatio: 1.5,
    heightRatio: 1.5,
    alpha: 1,
    pattern: 'grid',
  },
  {
    label: 'L2 / MIDGROUND',
    color: 0x1d4a5e,
    widthRatio: 0.7,
    heightRatio: 0.7,
    alpha: 0.85,
    pattern: 'diagonal',
  },
  {
    label: 'L3 / FOREGROUND',
    color: 0x4c8fae,
    widthRatio: 0.4,
    heightRatio: 0.4,
    alpha: 0.7,
    pattern: 'horizontal',
  },
];

/** P · parallax：PixiJS 8 三层视差渲染器。只读 W/M 数据。 */
export class ParallaxRenderer {
  private app: PIXI.Application | null = null;
  private readonly camera = new ParallaxCamera();
  private readonly layers: PIXI.Container[] = [];

  async mount(canvas: HTMLCanvasElement): Promise<void> {
    const app = new PIXI.Application();
    await app.init({
      canvas,
      width: canvas.clientWidth || 960,
      height: canvas.clientHeight || 540,
      background: 0x05070a,
      antialias: true,
    });
    this.app = app;
  }

  unmount(): void {
    this.app?.stop();
  }

  render(frame: RenderFrame): void {
    if (!this.app) return;
    this.ensureLayers(frame.world);

    for (let index = 0; index < frame.world.layers.length; index += 1) {
      const layer = frame.world.layers[index];
      const container = this.layers[index];
      if (!container) continue;

      const configured = frame.visualFrame.parallaxFactors
        .find((item) => item.layerIndex === layer.index);
      const factor = configured?.factor ?? layer.parallaxFactor;
      const effectiveLayer = { ...layer, parallaxFactor: factor };
      const uv = index === 0
        ? this.camera.computeBackgroundUV(frame.timeline.progress, effectiveLayer)
        : index === 1
          ? this.camera.computeMidgroundUV(frame.timeline.progress, effectiveLayer)
          : this.camera.computeForegroundUV(frame.timeline.progress, effectiveLayer);

      container.x = this.app.screen.width / 2 - uv.offsetX;
      container.y = this.app.screen.height / 2 - uv.offsetY;
    }
  }

  destroy(): void {
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.layers.length = 0;
  }

  private ensureLayers(world: WorldInstance): void {
    if (!this.app) return;
    while (this.layers.length < world.layers.length) {
      const index = this.layers.length;
      const spec = LAYER_SPECS[index % LAYER_SPECS.length];
      const width = this.app.screen.width * spec.widthRatio;
      const height = this.app.screen.height * spec.heightRatio;

      const graphics = new PIXI.Graphics();
      graphics.rect(-width / 2, -height / 2, width, height).fill({
        color: spec.color,
        alpha: 1,
      });
      this.drawPattern(graphics, spec, width, height);

      const label = new PIXI.Text({
        text: spec.label,
        style: {
          fill: 0xd8ecff,
          fontFamily: 'Consolas, monospace',
          fontSize: 13,
          fontWeight: '600',
        },
      });
      label.x = index === 0
        ? -this.app.screen.width / 2 + 12
        : -width / 2 + 12;
      label.y = index === 0
        ? -this.app.screen.height / 2 + 10
        : -height / 2 + 10;

      const container = new PIXI.Container();
      container.addChild(graphics);
      container.addChild(label);
      container.alpha = spec.alpha;
      this.app.stage.addChild(container);
      this.layers.push(container);
    }
  }

  private drawPattern(
    graphics: PIXI.Graphics,
    spec: LayerSpec,
    width: number,
    height: number,
  ): void {
    const left = -width / 2;
    const top = -height / 2;

    if (spec.pattern === 'grid') {
      for (let x = left; x <= width / 2; x += 40) {
        graphics.moveTo(x, top).lineTo(x, height / 2);
      }
      for (let y = top; y <= height / 2; y += 40) {
        graphics.moveTo(left, y).lineTo(width / 2, y);
      }
      graphics.stroke({ color: 0x315a78, width: 1, alpha: 0.45 });
      return;
    }

    if (spec.pattern === 'diagonal') {
      for (let x = left - height; x <= width / 2 + height; x += 34) {
        graphics.moveTo(x, top).lineTo(x + height, height / 2);
      }
      graphics.stroke({ color: 0x7fd7e8, width: 1, alpha: 0.38 });
      return;
    }

    for (let y = top; y <= height / 2; y += 18) {
      graphics.moveTo(left, y).lineTo(width / 2, y);
    }
    graphics.stroke({ color: 0xd8f4ff, width: 1, alpha: 0.42 });
  }
}
