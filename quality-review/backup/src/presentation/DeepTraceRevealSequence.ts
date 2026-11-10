// ============================================================
// P 表现层 · DeepTraceRevealSequence 深痕揭示序列组件
// （T6 / 名库 v2.3 / HANDOFF-ROUND-17 任务三）
//
// 依据：
// - 名库 v2.3 冻结名：DeepTraceRevealSequence（Cocos 组件）、
//   DeepTrace、ScreenInvertRipple（灰盒占位声明）；
// - VERDICT-114 / 116：深痕触发成立后播放揭示序列；序列不得
//   修改 TraceTier、解谜进度、账本或世界运动门控（INV-11）；
// - HANDOFF-ROUND-17 任务三：阶段 1 灰盒实现——用圆环缩放 +
//   淡出模拟 ScreenInvertRipple；不实现真实反色滤镜（完整
//   效果留到美术阶段）；序列结束后报告"播放结束或跳过"。
// - PROTOCOL 指示（扩张圆动画翻译）：参照同级目录
//   expanding_filtercircle_effect_code(html).txt 的 ripple 模式
//   波纹，翻译其三段动画语义（灰盒近似，见下方对照）：
//     ① 扩张缓动 nrL(p)=ln(1+4p)/ln5（先快后慢，起止速度比
//       5:1）→ easeExpand；② 亮度 k=nrL(1−p)（长时间保持高亮、
//       末段快速熄灭）→ 段材质 alpha 曲线；③ 圆走完触发短暂
//       曝光脉冲（0.9^(dt·60) 衰减，<0.004 截止）→ Flash 阶段
//       整环复亮再衰减。
//   真实滤镜（PROTOCOL 二次指示"尝试做一做"）：反色由同层
//   冻结名组件 ScreenInvertRipple 承载（RT 相机 + 全屏 Sprite +
//   assets/effects/invert-ripple.effect 圆形遮罩反色）；本组件
//   负责时序 / 跳过 / EnterChart，并把扩张进度与脉冲推给它。
//   灰盒圆环保留：作为波前边缘标记 + Effect 缺失时降级路径。
//   其余灰盒差异（不变更 INV-11 边界）：不做径向渐变软边
//   （12 段方块拼合）、无鼠标跟随圆、无 SVG 滤镜（浏览器专属
//   管线无对应物）；扩张速度按固定占位时长而非 780px/s 换算。
//
// 职责：
//   轮询 DeepTrace.isTriggered()；触发后播放灰盒揭示序列
//   （白色圆环由 12 段小方块拼合，放大 + 透明度衰减模拟
//   ScreenInvertRipple 冲击波）；播放中任意鼠标点击可跳过；
//   序列结束（播放完或跳过）后向 IntentPort 系统侧提交一个
//   EnterChart 意图（谱面入口由深痕授予，PlayerIntent 注释
//   明示该语义；系统侧提交先例：setPerceptionMode 公开供
//   系统侧使用），由 director 调度谱面入口切换。
//
// 边界（INV-11 / HANDOFF-ROUND-17 禁止事项）：
//   ✗ 不实现真实反色滤镜 / 后处理 / LUT（灰盒占位）
//   ✗ 不修改 TraceTier、PuzzleProgress、账本、世界运动门控
//   ✗ 不保存感知模式权威副本、不做颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：
//   presentation → trace R（DeepTrace，仅 import type）
//   presentation → director I（IntentPort，仅 import type）
//   presentation 可引用 cc
// ============================================================

import {
  _decorator,
  Component,
  Node,
  Color,
  MeshRenderer,
  Material,
  primitives,
  utils,
  input,
} from 'cc';
import type { DeepTrace } from '../trace/DeepTrace';
import type { IntentPort } from '../director/IntentPort';
import type { ScreenInvertRipple } from './ScreenInvertRipple';

const { ccclass } = _decorator;

// ------------------------------------------------------------
// 揭示序列灰盒表现参数（表现层配置，阶段 1 占位，待冻结登记；
// HANDOFF-ROUND-17 明示 constants 本轮仅新增
// RHYTHM_STRIKE_WINDOW_MS，故占位在本消费文件内部）。
// ------------------------------------------------------------

/** 序列时长（秒，占位）：圆环从起始缩放放大到结束缩放并淡出 */
const REVEAL_DURATION_SECONDS = 1.2;

/** 圆环起始缩放（占位） */
const RING_START_SCALE = 0.5;

/** 圆环结束缩放（占位；相对圆环半径 2WM，6 倍 ≈ 12WM 冲击范围） */
const RING_END_SCALE = 6;

/** 曝光脉冲衰减基数（每 1/60 秒乘 0.90，参照 nrRipFlash 衰减） */
const FLASH_DECAY_BASE = 0.9;

/** 曝光脉冲截止阈值（低于即结束序列，参照 nrRipFlash < 0.004） */
const FLASH_END_EPSILON = 0.004;

/**
 * 扩张缓动（参照 expanding_filtercircle_effect_code(html).txt 的
 * nrL：ln(1+4p)/ln5，单调递增，起始/结束速度比 5:1，先快后慢；
 * 直译待追认；导出供 ScreenInvertRipple 复用同一曲线）。
 */
export function easeExpand(p: number): number {
  return Math.log(1 + 4 * p) / Math.log(5);
}

/** 圆环段数（占位）：桩阶段无圆环几何，以小方块段拼合 */
const RING_SEGMENT_COUNT = 12;

/** 圆环单段方块边长（WorldMeter，占位） */
const RING_SEGMENT_SIZE = 0.3;

/** 圆环半径（WorldMeter，占位） */
const RING_RADIUS_WM = 2;

/**
 * DeepTraceRevealSequence 深痕揭示序列组件
 * （名库 v2.3 冻结类型名，Cocos 组件）
 *
 * 由 SceneBuilder 挂载到场景中任意常驻节点，bindSource 注入
 * DeepTrace、bindIntentPort 注入意图窄口。update 轮询触发
 * 状态（阶段 1 无事件总线，轮询为灰盒占位）。
 */
@ccclass('DeepTraceRevealSequence')
export class DeepTraceRevealSequence extends Component {
  /** 深痕（仅读取 isTriggered()；import type，无运行时耦合） */
  private deepTrace: DeepTrace | null = null;

  /** 意图窄口（I 边：序列结束提交 EnterChart，系统侧先例） */
  private intentPort: IntentPort | null = null;

  /** 屏幕反色涟漪（同层冻结名组件；缺失/降级时可为空） */
  private invertRipple: ScreenInvertRipple | null = null;

  /** 圆环节点（onLoad 构建；初始隐藏） */
  private ringNode: Node | null = null;

  /** 各圆环段材质（淡出时逐段写 mainColor 透明度） */
  private segmentMaterials: Material[] = [];

  /** 序列阶段（文件内私有状态；'Finished' 后不再响应） */
  private phase: 'Idle' | 'Playing' | 'Flash' | 'Finished' = 'Idle';

  /** 已播放秒数（Playing 阶段累加） */
  private elapsedSeconds = 0;

  /** 曝光脉冲强度（Flash 阶段由 1 按 0.9^(dt·60) 衰减，参照 nrRipFlash） */
  private flashValue = 0;

  /**
   * 接线深痕（方法名沿用 ROUND-12 追认模式 bindSource）。
   */
  bindSource(deepTrace: DeepTrace): void {
    this.deepTrace = deepTrace;
  }

  /**
   * 接线意图窄口（方法名沿用 ROUND-12 追认模式 bindIntentPort）。
   */
  bindIntentPort(intentPort: IntentPort): void {
    this.intentPort = intentPort;
  }

  /**
   * 接线屏幕反色涟漪（PROTOCOL 指示的真实滤镜尝试；沿用
   * 追认模式 bindInvertRipple）。为空 / 降级时仅灰盒圆环。
   */
  bindInvertRipple(invertRipple: ScreenInvertRipple): void {
    this.invertRipple = invertRipple;
  }

  /**
   * 构建圆环 + 注册跳过输入。
   * 圆环：12 段小方块沿 XY 平面圆周拼合；材质走 builtin-unlit
   * 透明 technique（technique: 1 经变量传入以兼容类型桩）。
   */
  onLoad(): void {
    this.buildRing();
    // 播放中任意鼠标点击 → 跳过（灰盒占位；点击同时会被
    // InputCollector 采集为 Strike，链已 Completed 时无害）。
    input.on('mouse-down', this.onSkipInput, this);
  }

  onDestroy(): void {
    input.off('mouse-down', this.onSkipInput, this);
  }

  /**
   * 每帧轮询：Idle 且深痕已触发 → 启动序列；Playing → 推进
   * 缓动扩张与亮度衰减（参照 nrL 曲线）；走完 → 曝光脉冲
   * （Flash）→ 衰减到阈值结束（报告"播放结束或跳过"）。
   */
  update(deltaTime: number): void {
    if (this.phase === 'Idle') {
      if (this.deepTrace !== null && this.deepTrace.isTriggered()) {
        this.startSequence();
      }
      return;
    }

    if (this.phase === 'Playing') {
      this.elapsedSeconds += deltaTime;
      const p = this.elapsedSeconds / REVEAL_DURATION_SECONDS;
      if (p >= 1) {
        // 圆走完：触发曝光脉冲（参照 nrRipFlash = 1）。
        this.flashValue = 1;
        this.phase = 'Flash';
        this.applySegmentAlpha(1);
        if (this.invertRipple !== null) {
          this.invertRipple.updateProgress(1, 1);
        }
        return;
      }

      // 扩张半径：r = r0 + (R − r0)·nrL(p)（先快后慢）。
      const lp = easeExpand(p);
      if (this.ringNode !== null) {
        const scale =
          RING_START_SCALE + (RING_END_SCALE - RING_START_SCALE) * lp;
        this.ringNode.setScale(scale, scale, scale);
      }
      // 亮度：k = nrL(1 − p)（长时间保持高亮，末段快速熄灭）。
      this.applySegmentAlpha(easeExpand(1 - p));
      // 真实反色滤镜同步推进（降级时组件内部直接忽略）。
      if (this.invertRipple !== null) {
        this.invertRipple.updateProgress(p, 0);
      }
      return;
    }

    if (this.phase === 'Flash') {
      // 曝光脉冲衰减（参照 nrRipFlash *= 0.90^dt，dt 为 1/60s 帧
      // 单位；约 0.6s 消失，低于阈值结束序列）。
      this.flashValue *= Math.pow(FLASH_DECAY_BASE, deltaTime * 60);
      if (this.flashValue < FLASH_END_EPSILON) {
        this.finishSequence();
        return;
      }
      this.applySegmentAlpha(this.flashValue);
      if (this.invertRipple !== null) {
        this.invertRipple.updateProgress(1, this.flashValue);
      }
    }
  }

  /**
   * 逐段写 mainColor 透明度（灰盒亮度曲线的唯一写入口）。
   */
  private applySegmentAlpha(intensity: number): void {
    const alpha = Math.round(255 * Math.max(0, Math.min(1, intensity)));
    for (const material of this.segmentMaterials) {
      material.setProperty('mainColor', new Color(255, 255, 255, alpha));
    }
  }

  /**
   * 鼠标点击回调：扩张中或曝光脉冲中点击 → 跳过（报告"跳过"）。
   */
  private onSkipInput(): void {
    if (this.phase === 'Playing' || this.phase === 'Flash') {
      this.finishSequence();
    }
  }

  /**
   * 启动序列（显示圆环、复位计时与亮度）。
   */
  private startSequence(): void {
    // 真实反色滤镜启动（降级时组件内部直接忽略）。
    if (this.invertRipple !== null) {
      this.invertRipple.begin();
    }
    if (this.ringNode !== null) {
      this.ringNode.active = true;
      const start = RING_START_SCALE;
      this.ringNode.setScale(start, start, start);
    }
    this.applySegmentAlpha(1);
    this.flashValue = 0;
    this.elapsedSeconds = 0;
    this.phase = 'Playing';
  }

  /**
   * 结束序列（播放到时或跳过共用；报告"播放结束或跳过"）：
   * 隐藏圆环，经 IntentPort 系统侧提交一个无载荷 EnterChart
   * 意图（谱面入口由深痕授予），由 director 调度谱面入口切换。
   */
  private finishSequence(): void {
    if (this.invertRipple !== null) {
      this.invertRipple.end();
    }
    if (this.ringNode !== null) {
      this.ringNode.active = false;
    }
    this.phase = 'Finished';
    if (this.intentPort !== null) {
      this.intentPort.submitFrameIntents([{ kind: 'EnterChart' }], 0);
    }
  }

  /**
   * 构建灰盒圆环（子节点；初始隐藏）。
   * 桩阶段无圆环（torus）几何，以 12 段小方块沿圆周拼合：
   * 每段绕 Z 轴旋转切向摆放，整环绕 X 轴倾斜 15 度面向相机。
   */
  private buildRing(): void {
    const ring = new Node('DeepTraceRevealRing');
    ring.active = false;
    ring.setPosition(0, 0.5, 0);
    ring.setRotationFromEuler(15, 0, 0);
    ring.layer = this.node.layer;
    this.node.addChild(ring);
    this.ringNode = ring;

    for (let i = 0; i < RING_SEGMENT_COUNT; i++) {
      const angle = (i / RING_SEGMENT_COUNT) * Math.PI * 2;
      const segment = new Node(`RingSegment${i}`);
      segment.layer = this.node.layer;

      const renderer = segment.addComponent(MeshRenderer);
      const mesh = utils.MeshUtils.createMesh(
        primitives.box({
          width: RING_SEGMENT_SIZE,
          height: RING_SEGMENT_SIZE,
          length: RING_SEGMENT_SIZE,
        }),
      );
      renderer.mesh = mesh;

      // 透明材质（灰盒淡出需要 alpha 混合）：technique: 1 为
      // builtin-unlit 透明通道；经变量传入以兼容阶段 1 类型桩。
      const material = new Material();
      const initInfo = { effectName: 'builtin-unlit', technique: 1 };
      material.initialize(initInfo);
      material.setProperty('mainColor', new Color(255, 255, 255, 255));
      renderer.material = material;
      this.segmentMaterials.push(material);

      const radius = RING_RADIUS_WM;
      segment.setPosition(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0,
      );
      segment.setRotationFromEuler(0, 0, (angle * 180) / Math.PI);
      ring.addChild(segment);
    }
  }
}
