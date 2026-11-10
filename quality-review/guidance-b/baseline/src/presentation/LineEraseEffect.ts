// P 表现层 · 引导线擦除与节点表现（VERDICT-128 / 133 / 134）。
// 只读取逻辑快照；不计算路径进度、网格键或判定，不写账本。
import {
  _decorator, Component, Node, UITransform, Graphics, Color, Sprite, SpriteFrame,
} from 'cc';
import type { FrameRefreshable } from './FrameDriver';
import type { ChartPremiereReader } from '../chart/ChartPremiere';
import type { GuidanceLineSnapshot } from '../chart/GuidanceLineRuntime';

const { ccclass } = _decorator;

/** 表现侧占位：放大淡出时长，使用谱面媒体时间，暂停不推进。 */
const NODE_FADE_MS = 240;
const NODE_SIZE_RATIO = 0.032;
const POINT_RADIUS_RATIO = 0.008;
const HEAD_SIZE_RATIO = 0.075;
const NODE_EXPAND_RATIO = 0.65;

@ccclass('LineEraseEffect')
export class LineEraseEffect extends Component implements FrameRefreshable {
  private premiere: ChartPremiereReader | null = null;
  private graphics: Graphics | null = null;
  private headSprite: Sprite | null = null;
  private headLogo: SpriteFrame | null = null;
  private headPosition: { readonly u: number; readonly v: number } | null = null;

  bindPremiere(reader: ChartPremiereReader): void {
    this.premiere = reader;
    this.clearVisuals();
  }

  /** LOGO 由组合根提供；组件不拥有或销毁该共享资源。 */
  bindHeadLogo(logo: SpriteFrame): void {
    this.headLogo = logo;
    if (this.headSprite !== null) {
      this.headSprite.spriteFrame = logo;
    }
  }

  /** 读取谱面首点用于 Head 原位动画，不从移动后的剩余线倒推起点。 */
  bindHeadPosition(position: { readonly u: number; readonly v: number } | null): void {
    this.headPosition = position === null ? null : { ...position };
    this.clearVisuals();
  }

  /** 与打击垫使用同一有效区域大小，仅做归一化坐标到 UI 的映射。 */
  bindContentSize(width: number, height: number): void {
    this.node.getComponent(UITransform)?.setContentSize(width, height);
  }

  private ensureBuilt(): void {
    if (this.graphics !== null) {
      return;
    }
    this.graphics = this.node.addComponent(Graphics);
    const headNode = new Node('GuidanceHeadLogo');
    headNode.layer = this.node.layer;
    this.node.addChild(headNode);
    headNode.addComponent(UITransform);
    this.headSprite = headNode.addComponent(Sprite);
    this.headSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.headSprite.spriteFrame = this.headLogo;
    headNode.active = false;
  }

  clearVisuals(): void {
    this.graphics?.clear();
    if (this.headSprite !== null) {
      this.headSprite.node.active = false;
      this.headSprite.node.setScale(1, 1, 1);
    }
  }

  onDisable(): void {
    this.clearVisuals();
  }

  onDestroy(): void {
    this.premiere = null;
    this.graphics = null;
    this.headSprite = null;
    this.headLogo = null;
    this.headPosition = null;
  }

  onFrameRefresh(): void {
    if (this.premiere === null) {
      this.clearVisuals();
      return;
    }
    const state = this.premiere.getState();
    const snapshot = this.premiere.getGuidanceSnapshot();
    if (state === 'Ready' || state === 'Exited' || snapshot === null ||
        snapshot.state === 'Pending' || snapshot.state === 'TimedOut' || snapshot.state === 'Exited') {
      this.clearVisuals();
      return;
    }
    this.ensureBuilt();
    this.clearVisuals();
    this.drawSnapshot(snapshot);
  }

  private drawSnapshot(snapshot: GuidanceLineSnapshot): void {
    const transform = this.node.getComponent(UITransform);
    const graphics = this.graphics;
    const premiere = this.premiere;
    if (transform === null || graphics === null || premiere === null ||
        transform.width <= 0 || transform.height <= 0) {
      return;
    }
    const width = transform.width;
    const height = transform.height;
    const mapX = (u: number): number => (u - 0.5) * width;
    const mapY = (v: number): number => (v - 0.5) * height;
    const alpha = Math.round((1 - premiere.getGuideTransparency() / 100) * 255);
    if (alpha <= 0) {
      return;
    }
    const nowMs = premiere.getCurrentTimeMs();
    this.drawHead(snapshot, nowMs, alpha, height, mapX, mapY);
    if (snapshot.state === 'Waiting') {
      return;
    }

    // remainingPoints 已由 chart 按当前逻辑进度裁剪，本层逐帧直接绘制。
    if (snapshot.remainingPoints.length >= 2) {
      graphics.strokeColor = new Color(255, 255, 255, alpha);
      graphics.lineWidth = Math.max(2, height * 0.003);
      graphics.moveTo(mapX(snapshot.remainingPoints[0].u), mapY(snapshot.remainingPoints[0].v));
      for (let i = 1; i < snapshot.remainingPoints.length; i++) {
        const point = snapshot.remainingPoints[i];
        graphics.lineTo(mapX(point.u), mapY(point.v));
      }
      graphics.stroke();
    }

    for (const item of snapshot.nodes) {
      const ageMs = item.resolvedAtMs === null ? 0 : Math.max(0, nowMs - item.resolvedAtMs);
      if (item.tier !== null && ageMs >= NODE_FADE_MS) {
        continue;
      }
      const fadeProgress = item.tier === null ? 0 : ageMs / NODE_FADE_MS;
      const size = height * NODE_SIZE_RATIO * (1 + fadeProgress * NODE_EXPAND_RATIO);
      const nodeAlpha = Math.round(alpha * (1 - fadeProgress));
      graphics.strokeColor = new Color(255, 255, 255, nodeAlpha);
      graphics.lineWidth = Math.max(2, height * 0.003);
      graphics.rect(mapX(item.position.u) - size / 2, mapY(item.position.v) - size / 2, size, size);
      graphics.stroke();
    }

    if (snapshot.judgmentPoint !== null && snapshot.state === 'Running') {
      const position = snapshot.judgmentPoint.position;
      graphics.fillColor = new Color(255, 255, 255, alpha);
      graphics.circle(mapX(position.u), mapY(position.v), height * POINT_RADIUS_RATIO);
      graphics.fill();
    }
  }

  private drawHead(
    snapshot: GuidanceLineSnapshot,
    nowMs: number,
    alpha: number,
    height: number,
    mapX: (u: number) => number,
    mapY: (v: number) => number,
  ): void {
    const sprite = this.headSprite;
    const position = this.headPosition;
    if (sprite === null || this.headLogo === null || position === null) {
      return;
    }
    const ageMs = snapshot.startedAtMs === null ? 0 : Math.max(0, nowMs - snapshot.startedAtMs);
    if (snapshot.startedAtMs !== null && ageMs >= NODE_FADE_MS) {
      return;
    }
    const progress = snapshot.startedAtMs === null ? 0 : ageMs / NODE_FADE_MS;
    const size = height * HEAD_SIZE_RATIO;
    sprite.node.getComponent(UITransform)?.setContentSize(size, size);
    sprite.node.setPosition(mapX(position.u), mapY(position.v), 0);
    const scale = 1 + progress * NODE_EXPAND_RATIO;
    sprite.node.setScale(scale, scale, 1);
    sprite.color = new Color(255, 255, 255, Math.round(alpha * (1 - progress)));
    sprite.node.active = true;
  }
}
