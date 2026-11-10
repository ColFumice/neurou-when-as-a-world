// ============================================================
// P 表现层 · ChartPadView 谱面打击垫视图（名库 v2.5）
//
// 依据：
// - HANDOFF-ROUND-18 任务 1 / 4 / 7：
//     视频有效画面区域（黑边处理）、按归一化布局绘制槽位、
//     引导 / 命中反馈 / 槽位标识均由表现层绘制；
//     逻辑层不读取节点位置。
// - VERDICT-121：槽位以物理键身份归属，不使用输入字符。
//
// 算法适配（ColorMusic，只保留语义）：
//   - A-001 / A-002 内容坐标 / 网格坐标分离：
//       视频仍独立 contain 适配；键盘按用户要求铺满整个 UI 区域，
//       槽位只按物理键身份判定，不从显示坐标反推逻辑；
//   - A-004 打击反馈：表现层短暂高亮，颜色不写账本 / 判定；
//   - 引导不透明度 = 1 - GuideTransparency/100，透明度不改变
//     目标槽位、Note 时间或判定窗口（AC-18）。
//
// 边界：presentation 对 chart 只 import type（R 边）；
// 不写账本；视频 / 音频媒体由组合根创建并经回调触发击音。
// ============================================================

import { _decorator, Component, Node, UITransform, Graphics, Label, Color, SpriteFrame } from 'cc';
import type { FrameRefreshable } from './FrameDriver';
import { LineEraseEffect } from './LineEraseEffect';
import type { ChartPremiereReader } from '../chart/ChartPremiere';
import type { ChartData } from '../chart/Note';
import type { GuidanceChart } from '../chart/GuidanceChart';
import type {
  ChartKeyId,
  ChartPadKind,
  KeyPadSlot,
  KeyboardPadLayout,
} from '../chart/KeyboardPadLayout';
import type { ChartJudgeTier } from '../chart/ChartScore';

const { ccclass } = _decorator;

// —— 表现层占位参数（禁止移入 constants；数值待美术 / 表现冻结）——
/** 引导提前进入时间（毫秒）：Note 在此窗口内开始下落显示。 */
const GUIDE_APPROACH_MS = 600;
/** Note 已过后仍显示引导的时长（与 Good 窗口视觉对齐）。 */
const GUIDE_TAIL_MS = 120;
/** 命中高亮持续（毫秒）。 */
const FLASH_DURATION_MS = 170;
/** 引导下落高度（占有效区域高度比例）。 */
const GUIDE_FALL_RATIO = 0.12;

/**
 * ChartPadView 谱面打击垫视图组件。
 */
@ccclass('ChartPadView')
export class ChartPadView extends Component implements FrameRefreshable {
  private premiere: ChartPremiereReader | null = null;
  private data: ChartData | GuidanceChart | null = null;
  private layout: KeyboardPadLayout | null = null;
  private lineEraseEffect: LineEraseEffect | null = null;
  private headLogo: SpriteFrame | null = null;

  private graphics: Graphics | null = null;
  private infoLabel: Label | null = null;
  private readonly slotLabelNodes: Node[] = [];
  private readonly slotLabels: Label[] = [];
  private built = false;
  private lastContainerW = 0;
  private lastContainerH = 0;

  private lastFeedbackSeq = 0;
  private readonly flashes: { keyId: ChartKeyId; expiresAt: number; tier: ChartJudgeTier }[] = [];

  /** 击音 / 反馈回调：组合根（媒体在表现侧）按档位与类别播放可替换单击。 */
  private hitSoundPlayer:
    | ((tier: ChartJudgeTier, kind: ChartPadKind) => void)
    | null = null;

  /** 接线首演只读接口。 */
  bindPremiere(reader: ChartPremiereReader): void {
    this.premiere = reader;
    this.lineEraseEffect?.bindPremiere(reader);
    this.lastFeedbackSeq = 0;
    this.flashes.length = 0;
  }

  /** 接线谱面数据与布局（引导显示坐标从布局派生）。 */
  bindChart(data: ChartData | GuidanceChart, layout: KeyboardPadLayout): void {
    this.data = data;
    this.lastContainerW = 0;
    this.lastContainerH = 0;
    this.lineEraseEffect?.clearVisuals();
    // 所有谱面显示同一逻辑网格的只读副本；不再仅在旧 Note 谱面中重排显示几何。
    this.layout = { ...layout,
      slots: layout.slots.filter(slot => slot.keyId !== 'Space').map(slot => ({ ...slot })) };
    this.lineEraseEffect?.bindHeadPosition('lines' in data ? data.lines[0]?.path.points[0] ?? null : null);
    if (this.built) { this.rebuildSlotLabels(); }
  }

  /** 可替换 Head LOGO 资源入口，由组合根提供 SpriteFrame。 */
  bindHeadLogo(logo: SpriteFrame): void {
    this.headLogo = logo;
    this.lineEraseEffect?.bindHeadLogo(logo);
  }

  onDisable(): void {
    this.graphics?.clear();
    this.lineEraseEffect?.clearVisuals();
    this.lastFeedbackSeq = 0;
    this.flashes.length = 0;
  }

  /** 接线击音播放器（可替换单击；鼓音由资源配置引用）。 */
  bindHitSoundPlayer(
    player: (tier: ChartJudgeTier, kind: ChartPadKind) => void,
  ): void {
    this.hitSoundPlayer = player;
  }

  /** 首次进入时创建绘图节点、信息标签与全部槽位标识节点。 */
  private ensureBuilt(): void {
    if (this.built) {
      return;
    }
    this.built = true;

    const drawNode = new Node('PadDraw');
    drawNode.layer = this.node.layer;
    this.node.addChild(drawNode);
    drawNode.addComponent(UITransform);
    this.graphics = drawNode.addComponent(Graphics);

    const infoNode = new Node('PadInfo');
    infoNode.layer = this.node.layer;
    this.node.addChild(infoNode);
    infoNode.addComponent(UITransform).setContentSize(720, 40);
    this.infoLabel = infoNode.addComponent(Label);
    this.infoLabel.fontSize = 22;
    this.infoLabel.color = new Color(235, 240, 250, 255);
    infoNode.setPosition(0, 0, 0);

    this.rebuildSlotLabels();

    const lineNode = new Node('GuidanceLineVisuals');
    lineNode.layer = this.node.layer;
    this.node.addChild(lineNode);
    lineNode.addComponent(UITransform);
    this.lineEraseEffect = lineNode.addComponent(LineEraseEffect);
    if (this.premiere !== null) {
      this.lineEraseEffect.bindPremiere(this.premiere);
    }
    if (this.headLogo !== null) {
      this.lineEraseEffect.bindHeadLogo(this.headLogo);
    }
    if (this.data !== null && 'lines' in this.data) {
      this.lineEraseEffect.bindHeadPosition(this.data.lines[0]?.path.points[0] ?? null);
    }
  }

  /** 切换谱面时重建可见槽位标签，避免保留旧布局的 Space 标识。 */
  private rebuildSlotLabels(): void {
    for (const node of this.slotLabelNodes) { node.destroy(); }
    this.slotLabelNodes.length = 0;
    this.slotLabels.length = 0;
    if (this.layout === null) { return; }
    for (const slot of this.layout.slots) {
      const labelNode = new Node(`SlotLabel-${slot.keyId}`);
      labelNode.layer = this.node.layer;
      this.node.addChild(labelNode);
      labelNode.addComponent(UITransform).setContentSize(60, 28);
      const label = labelNode.addComponent(Label);
      label.fontSize = 16;
      label.color = new Color(235, 240, 250, 140);
      label.string = labelOf(slot.keyId);
      this.slotLabelNodes.push(labelNode);
      this.slotLabels.push(label);
    }
  }

  /** 帧刷新：依据首演状态绘制（FrameDriver 不停）。 */
  onFrameRefresh(): void {
    if (this.premiere === null) {
      return;
    }
    const state = this.premiere.getState();
    this.ensureBuilt();
    if (state === 'Ready' || state === 'Exited') {
      this.lastFeedbackSeq = 0;
      this.flashes.length = 0;
    }

    if (this.graphics === null) {
      return;
    }
    if (state === 'Ready' || state === 'Exited') {
      this.graphics.clear();
      this.lineEraseEffect?.clearVisuals();
      return;
    }

    this.consumeFeedback();
    this.drawAll(state);
    this.lineEraseEffect?.onFrameRefresh();
  }

  /** 增量拉取判定反馈：登记高亮并触发击音（表现回调不直接写账本）。 */
  private consumeFeedback(): void {
    if (this.premiere === null) {
      return;
    }
    const pulled = this.premiere.getJudgeFeedbackSince(this.lastFeedbackSeq);
    if (pulled.nextSeq < this.lastFeedbackSeq) {
      this.lastFeedbackSeq = 0;
      this.flashes.length = 0;
      return this.consumeFeedback();
    }
    this.lastFeedbackSeq = pulled.nextSeq;
    const now = Date.now();
    for (const item of pulled.items) {
      this.flashes.push({
        keyId: item.keyId,
        expiresAt: now + FLASH_DURATION_MS,
        tier: item.tier,
      });
      if (this.hitSoundPlayer !== null) {
        this.hitSoundPlayer(item.tier, this.kindOfSlot(item.keyId));
      }
    }
  }

  /** 查槽位类别（只在布局数据内查找，不导入 chart 值函数）。 */
  private kindOfSlot(keyId: ChartKeyId): ChartPadKind {
    const slot =
      this.layout !== null
        ? this.layout.slots.find((candidate) => candidate.keyId === keyId)
        : undefined;
    return slot !== undefined ? slot.padKind : 'Regular';
  }

  /** 找槽位定义。 */
  private slotOf(keyId: ChartKeyId): KeyPadSlot | undefined {
    return this.layout !== null
      ? this.layout.slots.find((candidate) => candidate.keyId === keyId)
      : undefined;
  }

  /** 绘制有效区域、槽位、引导、高亮与信息。 */
  private drawAll(state: string): void {
    const transform = this.node.getComponent(UITransform);
    if (transform === null) {
      return;
    }
    const width = transform.width;
    const height = transform.height;
    if (width <= 0 || height <= 0) {
      return;
    }
    const rect = resolveContentRect(width, height);
    this.lineEraseEffect?.bindContentSize(rect.cw, rect.ch);
    const mapX = (u: number): number => rect.cx - rect.cw / 2 + u * rect.cw;
    const mapY = (v: number): number => rect.cy - rect.ch / 2 + v * rect.ch;

    const graphics = this.graphics;
    if (graphics === null) {
      return;
    }
    graphics.clear();

    this.drawSlots(graphics, mapX, mapY, rect);
    if (state !== 'Completed') {
      this.drawGuides(graphics, mapX, mapY, rect);
    }
    this.drawFlashes(graphics, mapX, mapY, rect);
    this.updateInfo(state, rect, mapX, mapY);
  }

  /** 绘制全部可见槽位；默认四行独立均分全宽，键少的行格子更宽。 */
  private drawSlots(
    graphics: Graphics,
    mapX: (u: number) => number,
    mapY: (v: number) => number,
    rect: ContentRect,
  ): void {
    if (this.layout === null) {
      return;
    }
    for (const slot of this.layout.slots) {
      const x = mapX(slot.u);
      const y = mapY(slot.v);
      const w = slot.width * rect.cw;
      const h = slot.height * rect.ch;
      const base = kindColor(slot.padKind);
      graphics.fillColor = new Color(base.r, base.g, base.b, 18);
      graphics.rect(x, y, w, h);
      graphics.fill();
      graphics.lineWidth = 1.5;
      graphics.strokeColor = new Color(base.r, base.g, base.b, 70);
      graphics.rect(x, y, w, h);
      graphics.stroke();
    }
  }

  /** 绘制引导：Note 标记下落进入槽位，透明度由 GuideTransparency 决定。 */
  private drawGuides(
    graphics: Graphics,
    mapX: (u: number) => number,
    mapY: (v: number) => number,
    rect: ContentRect,
  ): void {
    if (this.premiere === null || this.data === null || !('notes' in this.data)) {
      return;
    }
    const current = this.premiere.getCurrentTimeMs();
    const transparency = this.premiere.getGuideTransparency();
    const alpha = Math.round((1 - transparency / 100) * 255);
    if (alpha <= 0) {
      return; // 100% 透明：引导完全不可见（判定照常）。
    }
    const fall = rect.ch * GUIDE_FALL_RATIO;

    for (const note of this.data.notes) {
      const dt = note.timeMs - current;
      if (dt > GUIDE_APPROACH_MS || dt < -GUIDE_TAIL_MS) {
        continue;
      }
      const slot = this.slotOf(note.keyId);
      if (slot === undefined) {
        continue;
      }
      const slotX = mapX(slot.u) + slot.width * rect.cw / 2;
      const slotY = mapY(slot.v) + slot.height * rect.ch / 2;
      // dt 大 → 标记在上方；dt=0 → 落在槽位。
      const progress = Math.max(0, Math.min(1, dt / GUIDE_APPROACH_MS));
      const offsetY = progress * fall;
      const base = kindColor(slot.padKind);
      const markerSize = Math.min(slot.width * rect.cw, slot.height * rect.ch) * 0.42;
      graphics.fillColor = new Color(base.r, base.g, base.b, alpha);
      graphics.circle(slotX, slotY + offsetY, markerSize);
      graphics.fill();
    }
  }

  /** 绘制命中高亮（短暂，颜色不写账本）。 */
  private drawFlashes(
    graphics: Graphics,
    mapX: (u: number) => number,
    mapY: (v: number) => number,
    rect: ContentRect,
  ): void {
    const now = Date.now();
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      if (this.flashes[i].expiresAt <= now) {
        this.flashes.splice(i, 1);
      }
    }
    for (const flash of this.flashes) {
      const slot = this.slotOf(flash.keyId);
      if (slot === undefined) {
        continue;
      }
      const cx = mapX(slot.u) + slot.width * rect.cw / 2;
      const cy = mapY(slot.v) + slot.height * rect.ch / 2;
      const remaining = Math.max(0, flash.expiresAt - now) / FLASH_DURATION_MS;
      const color = flashColor(flash.tier);
      const radius = Math.min(slot.width * rect.cw, slot.height * rect.ch) * (0.45 + 0.25 * remaining);
      graphics.fillColor = new Color(color.r, color.g, color.b, Math.round(200 * remaining));
      graphics.circle(cx, cy, radius);
      graphics.fill();
    }
  }

  /** 更新槽位标识位置与信息文本（容器尺寸变化时重排，保证两档分辨率一致）。 */
  private updateInfo(
    state: string,
    rect: ContentRect,
    mapX: (u: number) => number,
    mapY: (v: number) => number,
  ): void {
    const transform = this.node.getComponent(UITransform);
    if (transform === null) {
      return;
    }
    if (this.infoLabel) {
      this.infoLabel.node.setPosition(0, transform.height / 2 - 12, 0);
      this.infoLabel.node.getComponent(UITransform)?.setContentSize(transform.width - 24, 24);
      this.infoLabel.fontSize = 10;
    }
    if (
      transform.width !== this.lastContainerW ||
      transform.height !== this.lastContainerH
    ) {
      this.lastContainerW = transform.width;
      this.lastContainerH = transform.height;
      if (this.layout !== null) {
        for (let i = 0; i < this.layout.slots.length; i++) {
          const slot = this.layout.slots[i];
          const node = this.slotLabelNodes[i];
          const label = this.slotLabels[i];
          if (node === undefined || label === undefined) {
            continue;
          }
          node.setPosition(
            mapX(slot.u) + slot.width * rect.cw / 2,
            mapY(slot.v) + slot.height * rect.ch / 2,
            0,
          );
          label.fontSize = Math.max(
            10,
            Math.round(Math.min(slot.width * rect.cw, slot.height * rect.ch) * 0.28),
          );
        }
      }
    }

    if (this.infoLabel !== null && this.premiere !== null) {
      const progressPercent = Math.round(this.premiere.getProgress() * 100);
      this.infoLabel.string =
        `${state}｜进度 ${progressPercent}%｜P${this.premiere.getPerfectCount()} ` +
        `G${this.premiere.getGoodCount()} M${this.premiere.getMissCount()}｜` +
        `得分 ${Math.round(this.premiere.getTotalScore())}｜引导透明 ${this.premiere.getGuideTransparency()}%`;
    }
  }
}

/** 有效区域矩形（节点中心坐标）。 */
interface ContentRect {
  readonly cx: number;
  readonly cy: number;
  readonly cw: number;
  readonly ch: number;
}

/**
 * 键盘显示区域铺满容器；视频尺寸及黑边由 VideoPlayer 独立处理。
 */
function resolveContentRect(
  containerW: number,
  containerH: number,
): ContentRect {
  return { cx: 0, cy: 0, cw: containerW, ch: containerH };
}

/** 类别基础色。 */
function kindColor(kind: ChartPadKind): { r: number; g: number; b: number } {
  if (kind === 'Drum') {
    return { r: 214, g: 148, b: 62 };
  }
  if (kind === 'Heavy') {
    return { r: 172, g: 96, b: 206 };
  }
  return { r: 78, g: 134, b: 206 };
}

/** 判定高亮色。 */
function flashColor(tier: ChartJudgeTier): { r: number; g: number; b: number } {
  if (tier === 'Perfect') {
    return { r: 120, g: 255, b: 172 };
  }
  if (tier === 'Good') {
    return { r: 255, g: 222, b: 120 };
  }
  return { r: 255, g: 96, b: 96 };
}

/** ChartKeyId → 槽位标识短文本（仅用于显示，不用于判定）。 */
function labelOf(keyId: ChartKeyId): string {
  if (keyId.startsWith('Key')) {
    return keyId.slice(3);
  }
  if (keyId.startsWith('Digit')) {
    return keyId.slice(5);
  }
  if (keyId === 'Space') {
    return 'SPACE';
  }
  const glyphs: Record<string, string> = {
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
  };
  return glyphs[keyId] ?? keyId;
}
