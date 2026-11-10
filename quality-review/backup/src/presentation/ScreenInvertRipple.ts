// ============================================================
// P 表现层 · ScreenInvertRipple 屏幕反色涟漪组件
// （T6 / 名库 v2.3 冻结名，原灰盒占位声明经 PROTOCOL 指示转正）
//
// 依据：
// - 名库 v2.3 冻结名：ScreenInvertRipple（Cocos 组件）；
// - PROTOCOL 指示：参照 expanding_filtercircle_effect_code(html).txt
//   的 ripple 模式（CSS mask + invert(1)）尝试真实反色滤镜；
// - INV-11 边界不变：不修改 TraceTier、解谜进度、账本、世界
//   运动门控；本组件纯视觉，由 DeepTraceRevealSequence 驱动。
//
// 实现原理（对照参考实现的浏览器管线 → Cocos 管线翻译）：
//   CSS mask + invert(1) 无法直接用；等价做法为：
//   ① RenderTexture 相机（主相机子节点，同参投影）把 3D 世界
//     渲染到 RT；② Canvas 下全屏 Sprite 以该 RT 为纹理；
//   ③ 自定义 Effect assets/effects/invert-ripple.effect 在
//     圆形遮罩内输出反色（软边 smoothstep + 强度 k 曲线 +
//     曝光脉冲白化罩），遮罩外 alpha=0 不遮挡世界。
//   曲线与参考一致：扩张缓动 ln(1+4p)/ln5（复用
//   DeepTraceRevealSequence 的 easeExpand）、强度 nrL(1−p)、
//   软边 8 + min(r,600)×0.02、起始半径 2×高/15。
//
// 降级（效果资产缺失 / 初始化失败时）：
//   不激活 RT 相机与遮罩，仅保留 DeepTraceRevealSequence 的
//   12 段方块圆环灰盒（表现不中断）。
//
// 边界：
//   ✗ 不实现 SVG 滤镜（浏览器专属管线，无对应物）
//   ✗ 无鼠标跟随圆（触发源是深痕位置事件，非点击）
//   ✗ 圆心取屏幕中心（占位；深痕世界坐标投影待 PROTOCOL 追认）
//
// 依赖矩阵（stage-1.md §6）：presentation 可引用 cc；
//   对 DeepTraceRevealSequence 仅复用其导出的缓动函数。
// ============================================================

import {
  _decorator,
  Component,
  Node,
  Camera,
  Sprite,
  SpriteFrame,
  RenderTexture,
  Material,
  Vec4,
  UITransform,
  screen,
} from 'cc';
import { easeExpand } from './DeepTraceRevealSequence';

const { ccclass } = _decorator;

// ------------------------------------------------------------
// 滤镜参数（占位，参照 expanding_filtercircle_effect_code(html).txt
// 直译，待追认登记）。
// ------------------------------------------------------------

/** 自定义 Effect 资产名（assets/effects/invert-ripple.effect） */
const INVERT_EFFECT_NAME = 'invert-ripple';

/** 起始半径占视口高的比例（参照 r0 = 2 * vh / 15） */
const START_RADIUS_VIEW_RATIO = 2 / 15;

/** 软边基础像素（参照 soft = 8 + …） */
const SOFT_EDGE_BASE_PX = 8;

/** 软边随半径增长系数（参照 … + min(r, 600) * 0.02） */
const SOFT_EDGE_RADIUS_SCALE = 0.02;

/** 软边半径封顶像素（参照 min(r, 600)） */
const SOFT_EDGE_RADIUS_CAP_PX = 600;

/**
 * ScreenInvertRipple 屏幕反色涟漪组件
 * （名库 v2.3 冻结类型名，Cocos 组件）
 *
 * 由 SceneBuilder 挂载并接线：bindUiRoot 注入 Canvas 根、
 * bindSourceCamera 注入主 3D 相机；DeepTraceRevealSequence 在
 * 揭示序列各阶段调用 begin / updateProgress / end。
 */
@ccclass('ScreenInvertRipple')
export class ScreenInvertRipple extends Component {
  /** UI 根节点（遮罩 Sprite 挂其下，取其层与全屏尺寸） */
  private uiRoot: Node | null = null;

  /** 主 3D 相机（RT 相机挂其节点下复制投影参数） */
  private sourceCamera: Camera | null = null;

  /** RT 相机（渲染世界到 RenderTexture；序列外禁用） */
  private rtCamera: Camera | null = null;

  /** 渲染纹理（世界画面；遮罩 Sprite 的采样源） */
  private renderTexture: RenderTexture | null = null;

  /** 全屏遮罩 Sprite 节点（Canvas 下；序列外隐藏） */
  private overlayNode: Node | null = null;

  /** 反色滤镜材质（invert-ripple Effect 实例） */
  private material: Material | null = null;

  /** 涟漪是否激活（begin → end 之间） */
  private active = false;

  /** 视口尺寸（px，begin 时快照） */
  private widthPx = 0;
  private heightPx = 0;

  /** 起始 / 结束半径（px，begin 时按视口计算） */
  private startRadiusPx = 0;
  private endRadiusPx = 0;

  /**
   * 接线 UI 根（方法名沿用 ROUND-12 追认模式 bindUiRoot）。
   */
  bindUiRoot(root: Node): void {
    this.uiRoot = root;
  }

  /**
   * 接线主 3D 相机（沿用追认模式 bindSourceCamera）。
   */
  bindSourceCamera(camera: Camera): void {
    this.sourceCamera = camera;
  }

  /**
   * 启动涟漪（构建/复用管线资源，激活 RT 相机与遮罩）。
   * 效果资产缺失时静默降级（调用方无需感知）。
   */
  begin(): void {
    if (this.active || this.uiRoot === null || this.sourceCamera === null) {
      return;
    }
    const size = screen.windowSize;
    this.widthPx = size.width;
    this.heightPx = size.height;
    if (!this.ensurePipeline()) {
      return;
    }

    // 起始 / 结束半径（参照 nrSpawn：r0 = 2*vh/15；
    // R = 圆心到最远角距离，居中时即半对角线）。
    this.startRadiusPx = START_RADIUS_VIEW_RATIO * this.heightPx;
    const halfW = this.widthPx / 2;
    const halfH = this.heightPx / 2;
    this.endRadiusPx = Math.sqrt(halfW * halfW + halfH * halfH);
    if (this.endRadiusPx <= this.startRadiusPx + 1) {
      this.endRadiusPx = this.startRadiusPx + 1;
    }

    this.active = true;
    if (this.rtCamera !== null) {
      this.rtCamera.enabled = true;
    }
    if (this.overlayNode !== null) {
      this.overlayNode.active = true;
    }
    this.applyUniforms(this.startRadiusPx, 0, 0);
  }

  /**
   * 推进涟漪（由 DeepTraceRevealSequence 每帧调用）：
   * progress ∈ [0,1] 扩张进度；flash ∈ [0,1] 曝光脉冲强度。
   * 曲线与参考一致：半径走 easeExpand（先快后慢），
   * 强度走 easeExpand(1−p)（长亮末熄）。
   */
  updateProgress(progress: number, flash: number): void {
    if (!this.active || this.material === null) {
      return;
    }
    const p = Math.max(0, Math.min(1, progress));
    const lp = easeExpand(p);
    const radiusPx =
      this.startRadiusPx + (this.endRadiusPx - this.startRadiusPx) * lp;
    const invertK = easeExpand(1 - p);
    this.applyUniforms(radiusPx, invertK, Math.max(0, Math.min(1, flash)));
  }

  /**
   * 结束涟漪（停 RT 相机、隐藏遮罩；资源复用不清除）。
   */
  end(): void {
    this.active = false;
    if (this.rtCamera !== null) {
      this.rtCamera.enabled = false;
    }
    if (this.overlayNode !== null) {
      this.overlayNode.active = false;
    }
  }

  onDestroy(): void {
    this.end();
  }

  /**
   * 确保 RT + RT 相机 + 遮罩 Sprite + 材质就绪（懒构建一次）。
   * 返回 false 表示 Effect 缺失 / 初始化失败（降级灰盒）。
   */
  private ensurePipeline(): boolean {
    // RT（尺寸随当前视口重建；SpriteFrame 持同对象引用自动生效）
    if (this.renderTexture === null) {
      this.renderTexture = new RenderTexture();
    }
    this.renderTexture.reset({
      name: 'DeepTraceInvertRT',
      width: Math.max(2, Math.round(this.widthPx)),
      height: Math.max(2, Math.round(this.heightPx)),
    });

    // 材质（先建，失败即降级，避免留下无材质节点）
    if (this.material === null) {
      const material = new Material();
      try {
        material.initialize({ effectName: INVERT_EFFECT_NAME });
      } catch (error) {
        console.warn('[ScreenInvertRipple] 反色 Effect 初始化失败：', error);
        return false;
      }
      if (material.passes.length === 0) {
        console.warn('[ScreenInvertRipple] 未找到 invert-ripple Effect（降级灰盒圆环）');
        return false;
      }
      this.material = material;
    }

    // RT 相机（主相机子节点，局部零变换即同位姿；复制投影参数）
    if (this.rtCamera === null && this.sourceCamera !== null) {
      const camNode = new Node('DeepTraceInvertRtCamera');
      this.sourceCamera.node.addChild(camNode);
      const cam = camNode.addComponent(Camera);
      cam.projection = this.sourceCamera.projection;
      cam.fov = this.sourceCamera.fov;
      cam.orthoHeight = this.sourceCamera.orthoHeight;
      cam.near = this.sourceCamera.near;
      cam.far = this.sourceCamera.far;
      cam.clearFlags = this.sourceCamera.clearFlags;
      cam.clearColor = this.sourceCamera.clearColor;
      cam.visibility = this.sourceCamera.visibility;
      cam.priority = this.sourceCamera.priority;
      // 渲染目标 = RT；默认禁用，序列期间由 begin 激活。
      cam.targetTexture = this.renderTexture;
      cam.enabled = false;
      this.rtCamera = cam;
    }

    // 全屏遮罩 Sprite（Canvas 下最上层；采样 RT）
    if (this.overlayNode === null && this.uiRoot !== null) {
      const node = new Node('ScreenInvertRippleOverlay');
      node.layer = this.uiRoot.layer;
      this.uiRoot.addChild(node);
      node
        .addComponent(UITransform)
        .setContentSize(this.widthPx, this.heightPx);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.type = Sprite.Type.SIMPLE;
      const frame = new SpriteFrame();
      frame.texture = this.renderTexture;
      sprite.spriteFrame = frame;
      sprite.customMaterial = this.material;
      node.active = false;
      this.overlayNode = node;
    }

    return this.rtCamera !== null && this.overlayNode !== null;
  }

  /**
   * 写滤镜 uniforms（软边随半径增长，参照 radial-gradient 软渐变）。
   */
  private applyUniforms(
    radiusPx: number,
    invertK: number,
    flash: number,
  ): void {
    if (this.material === null) {
      return;
    }
    const softPx =
      SOFT_EDGE_BASE_PX +
      Math.min(radiusPx, SOFT_EDGE_RADIUS_CAP_PX) * SOFT_EDGE_RADIUS_SCALE;
    this.material.setProperty(
      'u_centerRadius',
      new Vec4(this.widthPx / 2, this.heightPx / 2, radiusPx, softPx),
    );
    this.material.setProperty(
      'u_params',
      new Vec4(invertK, flash, this.widthPx, this.heightPx),
    );
  }
}
