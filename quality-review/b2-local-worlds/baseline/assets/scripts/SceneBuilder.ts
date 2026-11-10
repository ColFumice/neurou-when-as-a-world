// ============================================================
// 场景装配 · SceneBuilder（Cocos Creator 3.8.8 组件）
//
// 用法（人工唯一操作）：
//   1. 新建空场景，创建 Canvas（编辑器自动带 UI 相机）；
//      若场景里自带 Main Camera，请删掉它（本脚本会自建
//      3D 主相机，两个相机会冲突）；
//   2. 把本组件挂到 Canvas 节点上；
//   3. 点运行。start() 会以纯代码方式生成全部节点树并
//      完成全部组件挂载与接线。
//
// 生成的节点树（全部为 Canvas 的子节点）：
//   Canvas
//   ├── FrameDriver          （FrameDriver 组件，帧三步）
//   ├── InputCollector       （InputCollector 组件，键鼠）
//   ├── CameraRig            （CameraRig 组件）
//   │   └── MainCamera3D     （Camera 透视相机，俯视偏移）
//   ├── BackgroundFar        （远景灰盒，z=-20，AC-04）
//   ├── BackgroundMid        （中景灰盒，z=-10，AC-04）
//   ├── BackgroundNear       （近景灰盒，z=-5， AC-04）
//   ├── Ground               （地面灰盒）
//   ├── RouteSegmentRotating （旋转路段标记，横向 3~6 WM）
//   ├── Protagonist          （1×1×1 立方体 + ProtagonistView，
//   │                         运行时缩放 1.6，AC-06）
//   ├── TrailRender        （拖尾渲染器节点，子节点为白色段池，
//   │                         T3 拖尾 / AC-07 / AC-08；3D 跟随）
//   ├── ElementInitial       （Initial 实体，明态常驻，T5 AC-09）
//   ├── ElementProcess       （Process 实体，明态常驻，T5 AC-09）
//   ├── ElementTrace         （普通痕，明态常驻，T5 AC-09）
//   ├── ElementTraceConcealed（形态痕，Triggered 可见；靠近
//   │                         Trigger 显形 / 远离 Forget，AC-10/11）
//   └── DebugLabel           （Label + DebugPanel，AC-05）
//
// PerceptionFilter 挂在 MainCamera3D 节点上（AC-10：
// Normal 低饱和占位 / Triggered 恢复，灰盒以相机背景色占位）。
//
// 视差原理（AC-04）：透视相机下，相机随主角横向移动时，
// z=-20/-10/-5 三层背景在屏幕上的位移量依次增大。
//
// 旋转路段（AC-04）：主角横轴坐标进入 [3, 6] WM 区间时，
// 每帧调用 CameraRig.rotateAlongRoute，镜头装置绕 Y 轴
// 旋转到 -25°；离开区间回到 0°。
//
// 视距（AC-03）：滚轮改变 CameraRig 的 ViewDistance（仅
// 显示状态），本脚本 update 把视距映射到相机 fov；主角
// 坐标与距中点距离完全不受影响。
//
// 跳跃（AC-30，HANDOFF-ROUND-15 / VERDICT-101~106）：
//   空格键 = Jump（按住每帧提交）；数字键 = 世界 Strike
//   （撤销原空格 Strike 绑定）。
//
// T6 节奏敲击与解谜链（HANDOFF-ROUND-17 / VERDICT-113~117）：
//   · DeepTrace 深痕节点：与普通痕同色同尺寸（触发前无视觉
//     区别），不挂 ElementEntityView、不注册可见性跟踪；
//   · 两步解谜链：进度标签实时显示 PuzzleProgress 阶段
//     （AC-13 可观察进度阶段）+ 账本事件计数；
//   · 探针：屏幕投影（worldToScreen 归一化，原点左上）与
//     节奏敲击（左键记录占位 BGM 拍点时钟时间戳对）经
//     bindXxx 注入 director（I 边探针模式，测量归表现层）；
//   · 占位 BGM：60BPM 节拍器（assets/resources/audio/，
//     可循环），音量由 TraceProximityVolume 按主角到深痕
//     距离驱动（越近越大；只调音量，不改节拍 / 速度 / 窗口）；
//   · 深痕揭示序列：DeepTraceRevealSequence 挂深痕位置，
//     灰盒圆环缩放 + 淡出模拟 ScreenInvertRipple，结束经
//     IntentPort 系统侧提交 EnterChart；
//   · 谱面入口：轮询 isChartEntryScheduled() 后隐藏 3D 世界
//     （门控已由 director 同帧接入），进入 T7 谱面层。
//
// T7 视频谱面 / 键盘打击垫 / 暂停（HANDOFF-ROUND-18）：
//   · ChartLayer 全屏 UI 层（Canvas 下）：VideoPlayer 视频以
//     keepAspectRatio 呈现（黑边由 ChartPadView 按宽高比排除），
//     ChartPadView 绘制槽位 / 引导 / 命中反馈 / 槽位标识，
//     ChartPausePanel 提供暂停继续 / 退出；
//   · 谱面数据：resources/chart/chart_placeholder.json（ChartData
//     形状，layoutVersion 与默认布局一致）；加载失败回退确定性
//     占位谱面；首演 ChartPremiere 创建后绑定 director 与视图；
//   · 时钟：chart 媒体时钟探针读 VideoPlayer.currentTime（ms），
//     供 director 推进首演；Strike 时间戳同一视频时钟；
//   · 击音：Regular / Drum / Heavy 三个可替换 AudioClip，经
//     playOneShot 播放（鼓音仅反馈，不进入判定）；Miss 不播音；
//   · 暂停：director 冻结首演，本层暂停视频；恢复重建视频时钟
//     读数后继续；退出停止视频、释放表现、还原世界、保留入口；
//     重入不重复 T6 记录。
//
// 导入规范：assets 内相对导入省略扩展名（Cocos 3.8）。
//
// 本文件命名已于 PROTOCOL HANDOFF-ROUND-17 追认批次正式冻结。
// 追认名：bgmClipLoaded、bgmLoadFailed、autoplayUnlocked、
// screenProjectionOf、lastStrikeDeviationMs、onAutoplayUnlock。
// ============================================================

import {
  _decorator,
  Component,
  Node,
  Camera,
  Canvas,
  DirectionalLight,
  Label,
  UITransform,
  Overflow,
  MeshRenderer,
  Mesh,
  Material,
  Color,
  utils,
  primitives,
  Vec3,
  AudioSource,
  AudioClip,
  VideoPlayer,
  VideoClip,
  JsonAsset,
  SpriteFrame,
  input, Input,
  resources,
  screen, isValid,
} from 'cc';
import { AudioOutputClock } from './src/presentation/AudioOutputClock';
import { Bootstrap } from './Bootstrap';
import type { RuntimeGraph } from './Bootstrap';
import { FrameDriver } from './src/presentation/FrameDriver';
import { CameraRig } from './src/presentation/CameraRig';
import { InputCollector } from './src/presentation/InputCollector';
import { DebugPanel } from './src/presentation/DebugPanel';
import { ProtagonistView } from './src/presentation/ProtagonistView';
import { TrailRender } from './src/presentation/TrailRender';
import { PerceptionFilter } from './src/presentation/PerceptionFilter';
import { ElementEntityView } from './src/presentation/ElementEntityView';
import { DeepTraceRevealSequence } from './src/presentation/DeepTraceRevealSequence';
import { ScreenInvertRipple } from './src/presentation/ScreenInvertRipple';
import { ChartPadView } from './src/presentation/ChartPadView';
import { ChartPausePanel } from './src/presentation/ChartPausePanel';
import { ElementEntity } from './src/trace/ElementEntity';
import { VisibilityState } from './src/trace/VisibilityState';
import { DeepTrace } from './src/trace/DeepTrace';
import { PuzzleProgress } from './src/trace/PuzzleProgress';
import { PuzzleChain } from './src/trace/PuzzleChain';
import { TraceProximityVolume } from './src/trace/TraceProximityVolume';
import { createDefaultKeyboardPadLayout, CHART_KEY_IDS } from './src/chart/KeyboardPadLayout';
import { ChartPremiere, CHART_MEDIA_END_TIMEOUT_MS } from './src/chart/ChartPremiere';
import { parseGuidanceChart } from './src/chart/GuidanceChart';
import type { GuidanceChart } from './src/chart/GuidanceChart';
import { parseGuidanceVisualData } from './src/editor/GuidanceEditorSession';
import { WorldFolderBuilder } from './WorldFolderBuilder';
import type { RhythmStrike } from './src/trace/RhythmStrike';
import type { ChartData, Note } from './src/chart/Note';
import type {
  KeyboardPadLayout,
  ChartKeyId,
  ChartPadKind,
} from './src/chart/KeyboardPadLayout';
import type { ChartJudgeTier } from './src/chart/ChartScore';
import type { ChartTier } from './constants/index';

const { ccclass, property } = _decorator;

/** 旋转路段起点（WorldMeter，横轴） */
const ROUTE_BAND_START = 3;
/** 旋转路段终点（WorldMeter，横轴） */
const ROUTE_BAND_END = 6;
/** 旋转路段最大转角（度） */
const ROUTE_MAX_ANGLE = -25;
/** 视距 → fov 缩放口径（ViewDistance=10 时 fov=45°） */
const FOV_PER_VIEW_DISTANCE = 4.5;
/**
 * 3D 世界层掩码（Cocos Layers.Enum.DEFAULT = 1 << 30）。
 *
 * 必须显式设置：节点挂在 Canvas 下时，Cocos 可能把它当 UI
 * 子节点处理（继承 UI_2D 层），导致 3D 相机的 visibility
 * 掩码看不到它。3D 相机的 visibility 也得显式设到同一掩码。
 */
const LAYER_DEFAULT_3D = 1 << 30;

/**
 * 使用引擎位掩码，包含深度与模板清理，避免 RT 保留旧深度。
 */
const CLEAR_FLAGS_SOLID_COLOR = Camera.ClearFlag.SOLID_COLOR;
const CLEAR_FLAGS_DEPTH_ONLY = Camera.ClearFlag.DEPTH_ONLY;

// ------------------------------------------------------------
// T6 占位参数（SceneBuilder 表现层配置；待冻结登记）
// ------------------------------------------------------------

/** 占位 BGM 节拍间隔（毫秒）：60BPM 拍点网格，对应占位
 *  音频 assets/resources/audio/bgm_placeholder_60bpm.wav */
const BEAT_INTERVAL_MS = 1000;

/** 深痕平面坐标（WorldMeter；逻辑 DeepTrace 实例与视觉节点
 *  同值；置于出生点左侧 6WM，避开旋转路段 [3,6]） */
const DEEP_TRACE_LATERAL = -6;
const DEEP_TRACE_DEPTH = 0;

/**
 * 创建一个灰盒立方体节点（无美术资源；运行时用
 * primitives.box 生成网格 + builtin-unlit 材质）。
 *
 * @param parent 父节点
 * @param name 节点名
 * @param size 尺寸（WorldMeter：宽 / 高 / 长）
 * @param tint 灰盒占位颜色（仅显示，非逻辑颜色映射）
 * @param xyz 位置（x=横轴，y=竖直，z=纵深）
 * @param rotY Y 轴旋转（度，默认 0）
 * @param desaturationCollector 低饱和目标收集器（AC-10 分项 2；
 *        传入时把本盒材质与原始色收集进去，装配后整体注入
 *        PerceptionFilter；缺省不收集）
 * @returns 新建节点
 */
function addBox(
  parent: Node,
  name: string,
  size: { readonly w: number; readonly h: number; readonly l: number },
  tint: Color,
  xyz: { readonly x: number; readonly y: number; readonly z: number },
  rotY: number = 0,
  desaturationCollector?: Array<{ material: Material; originalColor: Color }>,
): Node {
  const node = new Node(name);
  parent.addChild(node);
  // 显式设层，避免继承自父节点 UI_2D 层导致 3D 相机看不到
  node.layer = LAYER_DEFAULT_3D;

  const meshRenderer = node.addComponent(MeshRenderer);
  const mesh = utils.MeshUtils.createMesh(
    primitives.box({ width: size.w, height: size.h, length: size.l }),
  );
  meshRenderer.mesh = mesh;

  const material = new Material();
  // 使用 builtin-unlit：无需光源即可直接显示 mainColor，
  // 灰盒占位不会因缺光而黑屏（builtin-standard 是 PBR，无光会黑）。
  material.initialize({ effectName: 'builtin-unlit' });
  material.setProperty('mainColor', tint);
  meshRenderer.material = material;
  if (desaturationCollector !== undefined) {
    desaturationCollector.push({ material, originalColor: tint });
  }

  node.setPosition(xyz.x, xyz.y, xyz.z);
  if (rotY !== 0) {
    node.setRotationFromEuler(0, rotY, 0);
  }
  return node;
}

/**
 * SceneBuilder 场景自动装配组件（挂在 Canvas 上即可）。
 */
@ccclass('SceneBuilder')
export class SceneBuilder extends Component {
  /** Set only by the folder composition root before Creator invokes start(). */
  private folderWorld = false;
  /** AC-18：演奏开始前在 Creator 属性面板调整，保持演奏中不变。 */
  @property({ min: 0, max: 100, step: 1, slide: true, tooltip: '引导透明度（百分比），演奏开始前配置' })
  GuideTransparency = 0;
  /** 保留旧 T7 资源入口；默认加载 C 步引导线谱面。 */
  @property({ tooltip: '使用 v1/v2/v3 引导线谱面；关闭可运行原 T7' })
  UseGuidanceChart = true;
  /** B1：resources 相对路径，不含 .json；进入世界前由 Inspector 配置。 */
  @property({ tooltip: '引导线谱面资源路径，如 chart/guidance_c 或 chart/我的谱面；不含 .json' })
  ChartResourcePath = 'chart/guidance_c';
  private readonly createdVisualAssets: Array<Mesh | Material> = [];
  /** 组合根组装出的运行时对象图（start 后置非空） */
  private graph: RuntimeGraph | null = null;

  /** 3D 主相机（用于把视距映射到 fov） */
  private camera3D: Camera | null = null;
  private uiCamera: Camera | null = null;

  /** 镜头装置（用于旋转路段转角更新） */
  private cameraRig: CameraRig | null = null;

  // —— T6 运行时句柄（start 装配后置非空；灰盒组合根先例：
  //    逻辑实例随场景装配创建，同 ElementEntity 先例） ——
  /** 解谜链进度（进度标签显示用） */
  private puzzleProgress: PuzzleProgress | null = null;
  /** 解谜链（读连续命中进度用） */
  private puzzleChain: PuzzleChain | null = null;
  /** 深痕逻辑实例（BGM 音量距离计算用） */
  private deepTrace: DeepTrace | null = null;

  /** 痕接近音量（BGM 音量驱动） */
  private proximityVolume: TraceProximityVolume | null = null;
  /** BGM 与视频输出时间线；暂停 / 重播重建媒体映射 */
  private readonly audioOutputClock = new AudioOutputClock();
  private chartMediaStarted = false;
  private lastChartState = 'Ready';
  /** BGM 是否已就绪（资源加载完成；起播与否见 bgmReady） */
  private bgmClipLoaded = false;
  /** BGM 是否已起播（输出音频时钟可读） */
  private bgmReady = false;
  /** 是否已完成首次点击解锁（浏览器 autoplay 手势要求） */
  private autoplayUnlocked = false;
  /** BGM 资源加载是否失败（诊断可见化：进度标签显示"资源缺失"） */
  private bgmLoadFailed = false;
  /**
   * 世界敲击 FIFO 时间线（替代单次 lastStrike 覆盖）。
   * 每次数字键边沿入队一条 RhythmStrike；director 经探针按
   * Strike 意图顺序逐条 dequeue；同帧多键不互相覆盖。
   */
  private readonly strikeTimeline: RhythmStrike[] = [];
  /** 最近一次世界敲击偏差（毫秒；仅诊断显示，>0 = 敲晚） */
  private lastStrikeDeviationMs: number | null = null;
  /** 深痕屏幕投影闭包（探针与进度标签诊断共用） */
  private screenProjectionOf:
    | (() => { x: number; y: number } | null)
    | null = null;

  /** 3D 世界根节点（谱面入口切换时整体隐藏） */
  private worldRootNode: Node | null = null;
  /** 调试面板节点（谱面入口切换时隐藏） */
  private debugLabelNode: Node | null = null;
  /** 解谜链进度标签（AC-13 可观察进度阶段） */
  private puzzleLabel: Label | null = null;
  /** 是否已进入谱面（显示 / 回收的幂等闸；退出时复位） */
  private chartEntered = false;

  // —— T7 谱面（HANDOFF-ROUND-18）——
  /** 键盘打击垫布局（默认五行；版本随 ChartData 校验）。 */
  private readonly keyboardLayout: KeyboardPadLayout =
    createDefaultKeyboardPadLayout();
  /** 已解析谱面数据（JSON 成功或回退占位）。 */
  private chartData: ChartData | GuidanceChart | null = null;
  /** 谱面数据是否已解析（加载回调完成，含失败回退）。 */
  private chartDataResolved = false;
  /** 谱面首演状态机（解析后创建并绑定）。 */
  private chartPremiere: ChartPremiere | null = null;
  private chartMediaUnavailableElapsedMs = 0;
  private chartFallbackTimeMs = -1;
  /** 谱面全屏 UI 层（视频 + 打击垫 + 暂停面板）。 */
  private chartLayerNode: Node | null = null;
  /** 视频播放器（谱面媒体）。 */
  private videoPlayer: VideoPlayer | null = null;
  /** 打击垫视图。 */
  private chartPadView: ChartPadView | null = null;
  /** 暂停面板。 */
  private pausePanel: ChartPausePanel | null = null;
  /** 击音播放组件（playOneShot）。 */
  private hitAudioSource: AudioSource | null = null;
  /** 可替换击音（按类别）。 */
  private readonly hitClips: {
    regular: AudioClip | null;
    drum: AudioClip | null;
    heavy: AudioClip | null;
  } = { regular: null, drum: null, heavy: null };

  /**
   * Cocos 生命周期：场景启动时一次性装配全部节点 / 组件 /
   * 接线。幂等：start 在组件生命周期内只执行一次。
   */
  start(): void {
    if (!this.folderWorld) {
      const folders = this.node.addComponent(WorldFolderBuilder);
      folders.bindWorldFactory(node => {
        const world = node.addComponent(SceneBuilder);
        world.folderWorld = true;
        world.UseGuidanceChart = this.UseGuidanceChart;
        world.ChartResourcePath = this.ChartResourcePath;
        world.GuideTransparency = this.GuideTransparency;
      });
      this.enabled = false;
      return;
    }
    // The component may be attached to Canvas or to a plain child node.
    const rootTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    const parentTransform = this.node.parent?.getComponent(UITransform);
    rootTransform.setContentSize(parentTransform?.width ?? screen.windowSize.width,
      parentTransform?.height ?? screen.windowSize.height);
    // —— 输入监听注册（与 onDestroy 的 off 成对；T6） ——
    // ① autoplay 解锁：浏览器要求 AudioContext 在用户手势内
    //    启动 / 恢复；首次鼠标按下或键盘按下时起播 BGM 并启动
    //    拍点时钟（幂等闸保证仅首次生效）。
    // ② 节奏敲击记录：数字键时间戳对经探针供 director 判定
    //    （用户指令变更：敲击输入由鼠标左键改为任意数字键）。
    input.on(Input.EventType.MOUSE_DOWN, this.onAutoplayUnlock, this);
    input.on(Input.EventType.KEY_DOWN, this.onAutoplayUnlock, this);
    // T7：节奏敲击不再由本组件直接监听键盘——统一由
    // InputCollector 做白名单边沿采集与上下文路由；世界敲击经
    // bindWorldStrikeRecorder 回调在 BGM 时钟上记录时间线。

    // —— 0. UI 相机让位：Canvas 节点自带的 UI 相机默认
    //       clearFlags=SOLID_COLOR，会用它自己的 clearColor
    //       整屏覆盖，把我们先渲染的 3D 内容盖掉，画面只剩纯色。
    //       改成 DEPTH_ONLY（只清深度，不清颜色），3D 像素即可透过来。
    //       如果用户没在 Canvas 上挂 UI 相机，跳过此步（仅靠 3D 相机渲染）。
    const uiCamera = this.node.getComponent(Canvas)?.cameraComponent ??
      this.node.parent?.getComponent(Canvas)?.cameraComponent ??
      this.node.getComponent(Camera) ?? this.node.parent?.getComponent(Camera);
    this.uiCamera = uiCamera ?? null;
    if (uiCamera) {
      uiCamera.clearFlags = CLEAR_FLAGS_DEPTH_ONLY;
      // 同时把 UI 相机优先级抬到 1（数值大后渲染），保证它在我们
      // 3D 相机（priority=-1）之后渲染，UI 标签永远盖在 3D 之上。
      uiCamera.priority = 1;
    }

    // —— 0.5 创建 3D 世界根节点（Canvas 的兄弟节点） ——
    // 关键修复：原来所有 3D 内容挂在 Canvas 下，Cocos 的 UI
    // 渲染管线会把它们当 UI 子节点处理（影响层级 / 渲染管线），
    // 3D 相机看不到。挪到 Canvas 同级的独立 World3D 根节点下，
    // 走标准 3D 渲染管线。
    // Frame/input/UI stay in the disposable runtime root; 3D must remain outside Canvas.
    const sceneRoot = this.node;
    const worldSceneRoot = this.node.parent?.parent ?? this.node;
    const world3D = new Node('World3D');
    worldSceneRoot.addChild(world3D);
    world3D.layer = LAYER_DEFAULT_3D;
    const worldRoot: Node = world3D;
    this.worldRootNode = worldRoot;

    // —— 1. 组合根：组装逻辑层对象图（session/protagonist/center） ——
    const existingBootstrap = this.node.getComponent(Bootstrap);
    const bootstrap = existingBootstrap !== null
      ? existingBootstrap
      : this.node.addComponent(Bootstrap);
    this.graph = bootstrap.ensureRuntime();

    // —— 2. 帧驱动与输入采集（独立节点承载组件） ——
    // 关键（T7）：挂在 sceneRoot 而非 World3D 下。进入谱面会隐藏
    // World3D（可视世界 + 3D 相机），帧驱动与输入采集必须继续存活，
    // 否则谱面推进与键盘路由会随世界一起被冻结。
    const frameDriverNode = new Node('FrameDriver');
    sceneRoot.addChild(frameDriverNode);
    frameDriverNode.layer = LAYER_DEFAULT_3D;
    const frameDriver = frameDriverNode.addComponent(FrameDriver);

    const inputNode = new Node('InputCollector');
    sceneRoot.addChild(inputNode);
    inputNode.layer = LAYER_DEFAULT_3D;
    const inputCollector = inputNode.addComponent(InputCollector);

    // —— 3. 镜头装置 + 3D 主相机（相机为装置子节点，
    //       保留俯视高度 / 前后偏移；父节点平移 / 旋转即
    //       AC-02 镜头跟随与 AC-04 沿路线旋转） ——
    const rigNode = new Node('CameraRig');
    worldRoot.addChild(rigNode);
    rigNode.layer = LAYER_DEFAULT_3D;
    this.cameraRig = rigNode.addComponent(CameraRig);

    const cameraNode = new Node('MainCamera3D');
    rigNode.addChild(cameraNode);
    cameraNode.layer = LAYER_DEFAULT_3D;
    // 相机偏移：相对 CameraRig 节点（位于主角位置）抬高 6、后撤 15。
    // 俯角 -15°（约 0.26 斜率）：在 Z=0 处视野中心 Y≈2，可见 Y∈[-4, 8]；
    // 在 Z=-20 处视野中心 Y≈-3.4，可见 Y∈[-17.9, 11.1]——
    // 三层背景墙（Y∈[-2, 10]）全部入画。原 -51° 太陡，
    // 视线在 Z=-20 处已掉到 Y=-24，所有盒子都飞出垂直 FOV。
    cameraNode.setPosition(0, 6, 15);
    cameraNode.setRotationFromEuler(-15, 0, 0);
    this.camera3D = cameraNode.addComponent(Camera);
    this.camera3D.fov = 45;
    this.camera3D.near = 0.1;
    this.camera3D.far = 200;
    // 背景天空色（淡蓝灰），避免 clearColor 默认接近黑导致纯黑屏
    this.camera3D.clearColor = new Color(135, 175, 220, 255);
    // 3D 相机优先级 -1，确保先于 Canvas 自带的 UI 相机渲染，
    // 否则 UI 相机先 clearDepth 会让 3D 内容被遮挡或丢失。
    this.camera3D.priority = -1;
    // 显式设可见层掩码，确保能看到所有 DEFAULT 层 3D 节点
    this.camera3D.visibility = LAYER_DEFAULT_3D;
    // 3D 相机清屏标志：纯色清屏（清颜色 + 清深度）
    this.camera3D.clearFlags = CLEAR_FLAGS_SOLID_COLOR;

    // —— 3.5 主光源（即便 builtin-unlit 不需要光照，加一束方向光
    //       可让未来切到 builtin-standard 的物体有立体感；开销极低） ——
    const lightNode = new Node('DirectionalLight');
    worldRoot.addChild(lightNode);
    lightNode.layer = LAYER_DEFAULT_3D;
    // 光源从右上前上方斜照下来，俯角约 45°、方位角约 -30°
    lightNode.setRotationFromEuler(-45, -30, 0);
    const dirLight = lightNode.addComponent(DirectionalLight);
    dirLight.color = new Color(255, 240, 220, 255);
    dirLight.illuminance = 1.5;

    // 注：场景环境光（Ambient）在 Cocos 3.8 是 Asset 资源而非 Component，
    // 经 scene.globals.ambient 设置，无法用 addComponent 添加。
    // builtin-unlit 材质不依赖环境光，跳过即可。

    // AC-10 分项 2（T6 / VERDICT-110 复验）：场景主体低饱和
    // 目标收集器（材质 + 原始色）；装配完成后注入 PerceptionFilter，
    // Normal 模式下主体确实呈低饱和（非只变背景色）。
    const desaturationTargets: Array<{
      material: Material;
      originalColor: Color;
    }> = [];

    // —— 4. 三层纵深灰盒背景（AC-04：透视视差） ——
    // 注意：parent 改成 worldRoot（不再是 this.node / Canvas）
    addBox(
      worldRoot, 'BackgroundFar',
      { w: 60, h: 12, l: 0.5 }, new Color(60, 60, 70, 255),
      { x: 0, y: 4, z: -20 },
      0, desaturationTargets,
    );
    addBox(
      worldRoot, 'BackgroundMid',
      { w: 60, h: 10, l: 0.5 }, new Color(100, 100, 115, 255),
      { x: 0, y: 3.5, z: -10 },
      0, desaturationTargets,
    );
    addBox(
      worldRoot, 'BackgroundNear',
      { w: 60, h: 8, l: 0.5 }, new Color(150, 150, 165, 255),
      { x: 0, y: 3, z: -5 },
      0, desaturationTargets,
    );
    // 地面
    addBox(
      worldRoot, 'Ground',
      { w: 60, h: 0.2, l: 60 }, new Color(90, 90, 95, 255),
      { x: 0, y: -0.85, z: 0 },
      0, desaturationTargets,
    );
    // 旋转路段标记（位于横向 3~6 WM 区间，预先偏转 -25°
    // 提示路线走向；镜头在该区间内同步旋转）
    addBox(
      worldRoot, 'RouteSegmentRotating',
      { w: 6, h: 0.1, l: 1.4 }, new Color(200, 140, 60, 255),
      { x: 4.5, y: -0.72, z: -2 },
      ROUTE_MAX_ANGLE, desaturationTargets,
    );

    // —— 5. 主角占位方块 + ProtagonistView（AC-06 缩放 1.6） ——
    const protagonistNode = addBox(
      worldRoot, 'Protagonist',
      { w: 1, h: 1, l: 1 }, new Color(220, 70, 70, 255),
      { x: 0, y: 0, z: 0 },
      0, desaturationTargets,
    );
    const protagonistView = protagonistNode.addComponent(ProtagonistView);
    protagonistView.bindSource(this.graph.protagonist);

    // —— 5.5 拖尾渲染器（T3：AC-07 / AC-08） ——
    // 挂在 worldRoot 下而非主角节点下：拖尾段位置以世界坐标
    // （= 历史主角位置）写入，若挂主角节点下会被主角节点平移
    // 叠加，导致拖尾错位（"由世界中心距角色的比例移动" bug）。
    // 拖尾颜色固定白色 #FFFFFF（占位逻辑拖尾色，AC-08）；
    // 静止时拖尾收拢（AC-07）。
    const trailNode = new Node('TrailRender');
    worldRoot.addChild(trailNode);
    trailNode.layer = LAYER_DEFAULT_3D;
    const trailRenderer = trailNode.addComponent(TrailRender);
    trailRenderer.bindSource(this.graph.protagonist);

    // —— 5.6 元素实体（T5：AC-09 / AC-10 / AC-11） ——
    // 三枚常驻明态实体（AC-09）：Initial / Process / 普通 Trace；
    // 另放一枚初始形态（Concealed）的 Trace：
    //   · Normal 模式隐藏，按 2 切到 Triggered 后可见（AC-10）；
    //   · 主角走近 ≤2WM 触发 Trigger（形态→明态，AC-11）；
    //   · 远离 ≥5WM 触发 Forget（明态→形态，暂忘，AC-11）。
    // 触发 / 遗忘半径为阶段 1 占位，阶段 4 由解谜链规则细化。
    // 灰盒颜色仅为占位区分，固定不读感绪值（非颜色映射）。
    const concealedTraceEntity = new ElementEntity({
      elementType: 'Trace',
      visibilityState: VisibilityState.Concealed,
      lateral: 4,
      depth: 0,
    });
    const elementSpecs: ReadonlyArray<{
      readonly nodeName: string;
      readonly tint: Color;
      readonly x: number;
      readonly z: number;
      readonly entity: ElementEntity;
    }> = [
      {
        nodeName: 'ElementInitial',
        tint: new Color(225, 225, 225, 255),
        x: -3, z: -2,
        entity: new ElementEntity({
          elementType: 'Initial',
          visibilityState: VisibilityState.Revealed,
          lateral: -3,
          depth: -2,
        }),
      },
      {
        nodeName: 'ElementProcess',
        tint: new Color(90, 180, 200, 255),
        x: 2, z: -3,
        entity: new ElementEntity({
          elementType: 'Process',
          visibilityState: VisibilityState.Revealed,
          lateral: 2,
          depth: -3,
        }),
      },
      {
        nodeName: 'ElementTrace',
        tint: new Color(220, 200, 90, 255),
        x: -2, z: 1.5,
        entity: new ElementEntity({
          elementType: 'Trace',
          visibilityState: VisibilityState.Revealed,
          lateral: -2,
          depth: 1.5,
        }),
      },
      {
        nodeName: 'ElementTraceConcealed',
        tint: new Color(180, 110, 220, 255),
        x: 4, z: 0,
        entity: concealedTraceEntity,
      },
    ];

    const elementViews: ElementEntityView[] = [];
    for (const spec of elementSpecs) {
      const elementNode = addBox(
        worldRoot,
        spec.nodeName,
        { w: 0.8, h: 0.8, l: 0.8 },
        spec.tint,
        { x: spec.x, y: 0, z: spec.z },
        0,
        desaturationTargets,
      );
      const entityView = elementNode.addComponent(ElementEntityView);
      entityView.bindSource(spec.entity);
      entityView.bindIntentPort(this.graph.session);
      // 立即按初始状态设置一次 active，避免首帧形态实体闪现。
      entityView.onFrameRefresh();
      elementViews.push(entityView);
    }

    // 仅初始形态实体参与 Trigger / Forget 距离检测（AC-11）；
    // 常驻明态实体不注册，避免被 Forget 隐藏（AC-09）。
    this.graph.session.bindVisibilityTrackedEntities([concealedTraceEntity]);

    // —— 5.7 深痕 + 两步解谜链（T6 / AC-12 ~ AC-14） ——
    // 深痕触发前与普通痕无视觉区别（名库 v2.3）：同尺寸
    // 0.8×0.8×0.8、同灰盒占位色 (220,200,90)；不挂
    // ElementEntityView、不注册可见性跟踪（常驻可见）。
    // 触发不改层级 / 进度 / 账本 / 门控（INV-11）。
    const deepTrace = new DeepTrace({
      lateral: DEEP_TRACE_LATERAL,
      depth: DEEP_TRACE_DEPTH,
    });
    const deepTraceNode = addBox(
      worldRoot, 'DeepTrace',
      { w: 0.8, h: 0.8, l: 0.8 }, new Color(220, 200, 90, 255),
      { x: DEEP_TRACE_LATERAL, y: 0, z: DEEP_TRACE_DEPTH },
      0, desaturationTargets,
    );
    this.deepTrace = deepTrace;


    // 两步解谜链（VERDICT-117）：进度只更新 PuzzleProgress，
    // 不写账本；链终点结算由 director 执行（恰好一条
    // NarrativeEvent + 防重复结算），同时标记深痕触发。
    const puzzleProgress = new PuzzleProgress();
    const puzzleChain = new PuzzleChain(puzzleProgress, BEAT_INTERVAL_MS);
    this.puzzleProgress = puzzleProgress;
    this.puzzleChain = puzzleChain;
    this.graph.session.bindPuzzleChain(puzzleChain);
    this.graph.session.bindDeepTrace(deepTrace);

    // 账本容器与追加能力仅由 director 承载。

    // —— T6 探针（I 边注入：测量归表现层，决策归 director） ——
    // ① 屏幕投影探针：深痕世界坐标 → 3D 相机 worldToScreen →
    //    按 screen.windowSize 归一化（原点屏幕左上，y 翻转）。
    this.screenProjectionOf = () => {
      if (this.camera3D === null) {
        return null;
      }
      const worldPos = deepTraceNode.worldPosition;
      const screenPos = this.camera3D.worldToScreen(
        new Vec3(worldPos.x, worldPos.y, worldPos.z),
      );
      const windowSize = screen.windowSize;
      return {
        x: screenPos.x / windowSize.width,
        y: 1 - screenPos.y / windowSize.height,
      };
    };
    this.graph.session.bindScreenProjectionProbe(this.screenProjectionOf);

    // ② 节奏敲击探针：按 Strike 意图顺序从 FIFO 时间线 dequeue
    //    一条（敲击 / 目标拍点时间戳）；空队列返回 null。
    this.graph.session.bindRhythmStrikeProbe(
      () => this.strikeTimeline.shift() ?? null,
    );
    // beat 时钟探针：供 director 逐帧检查持续期超时（7 秒）。
    this.graph.session.bindBeatClockProbe(
      () => this.bgmReady ? this.audioOutputClock.readBgmTimeMs() : -1,
    );

    // —— 5.8 深痕揭示序列（T6 / VERDICT-114 / 116） ——
    // 挂在深痕位置（圆环以深痕为圆心）；轮询 isTriggered()
    // 启动灰盒序列；结束（播放完或跳过）经 IntentPort 系统侧
    // 提交 EnterChart（谱面入口由深痕授予，VERDICT-115）。
    const revealNode = new Node('DeepTraceReveal');
    worldRoot.addChild(revealNode);
    revealNode.layer = LAYER_DEFAULT_3D;
    revealNode.setPosition(DEEP_TRACE_LATERAL, 0, DEEP_TRACE_DEPTH);
    const revealSequence = revealNode.addComponent(DeepTraceRevealSequence);
    revealSequence.bindSource(deepTrace);
    revealSequence.bindIntentPort(this.graph.session);
    // 真实反色滤镜（PROTOCOL 指示尝试）：ScreenInvertRipple 经
    // RT 相机 + 自定义 Effect（assets/effects/invert-ripple.effect）
    // 做圆形遮罩反色；Effect 缺失时组件内部自动降级为纯圆环。
    if (this.camera3D !== null) {
      const invertRipple = revealNode.addComponent(ScreenInvertRipple);
      invertRipple.bindUiRoot(this.node);
      invertRipple.bindSourceCamera(this.camera3D);
      revealSequence.bindInvertRipple(invertRipple);
    }

    // —— 5.9 占位 BGM（T6 / AC-12：越靠近痕音量越大） ——
    // 60BPM 节拍器占位音频（可循环、节拍稳定）；音量由
    // TraceProximityVolume 按主角到深痕距离驱动（只调音量，
    // 不改节拍 / 播放速度 / 判定窗口）。挂在 World3D 之外的
    // sceneRoot，谱面占位切换隐藏 World3D 后 BGM 不中断。
    this.proximityVolume = new TraceProximityVolume();
    resources.load(
      'audio/bgm_placeholder_60bpm',
      AudioClip,
      async (err: Error | null, clip: AudioClip | null) => {
        if (!isValid(this, true)) { return; }
        // 注意：Cocos 3.x 加载成功时回调的 err 实际传 undefined
        // 而非 null，严格 !== null 判定会把成功误判为失败
        // （err = undefined 且 clip 有效即此情形）；改用宽松判空。
        if (err != null || clip == null) {
          // 占位资源缺失不阻塞其余功能：仅 BGM 音量与拍点
          // 时钟不可用（敲击判定无拍点可比对，链停在第一步）。
          // 诊断可见化：控制台告警 + 进度标签显示"资源缺失"。
          this.bgmLoadFailed = true;
          console.warn(
            '[SceneBuilder] BGM 加载失败：err =', err,
            '; clip =', clip,
            '；请确认编辑器已导入 assets/resources/audio/'
            + 'bgm_placeholder_60bpm.wav。',
          );
          return;
        }
        // 不在此处 play：浏览器 autoplay 政策要求 AudioContext
        // 必须在用户手势内启动（否则挂起无声，拍点时钟与播放
        // 脱钩）；起播挪至 onAutoplayUnlock（首次鼠标按下）。
        try {
          await this.audioOutputClock.loadBgm(clip.nativeUrl);
          if (!isValid(this, true)) { return; }
          this.bgmClipLoaded = true;
          if (this.autoplayUnlocked) { this.bgmReady = this.audioOutputClock.startBgm(); }
        } catch (error) {
          this.bgmLoadFailed = true;
          console.error('[SceneBuilder] BGM 解码失败', error);
        }
      },
    );

    // 感知滤镜（AC-10）：挂 3D 主相机节点，Normal 低饱和灰 /
    // Triggered 天空蓝（灰盒以后处理方案接入前的占位视觉信号）。
    const perceptionFilter = cameraNode.addComponent(PerceptionFilter);
    perceptionFilter.bindCamera(this.camera3D);
    perceptionFilter.bindIntentPort(this.graph.session);
    // AC-10 分项 2（T6 / VERDICT-110 复验）：场景主体低饱和
    // 目标（材质 + 原始色）注入；须在首次 onFrameRefresh 之前。
    perceptionFilter.bindDesaturationTargets(desaturationTargets);
    perceptionFilter.onFrameRefresh();

    // —— 6. 调试面板（AC-05：距中点距离 + WorldMeter 单位） ——
    // 留在 Canvas 下（UI 元素，必须走 UI 相机渲染）
    const labelNode = new Node('DebugLabel');
    this.node.addChild(labelNode);
    // 2D 节点必须使用 Canvas 的 UI 层，否则 UI 相机不渲染
    labelNode.layer = this.node.layer;
    const uiTransform = labelNode.addComponent(UITransform);
    uiTransform.setContentSize(640, 48);
    const label = labelNode.addComponent(Label);
    label.string = '0.00 WM';
    label.fontSize = 28;
    label.lineHeight = 36;
    label.color = new Color(255, 255, 255, 255);
    labelNode.setPosition(-430, 300, 0);

    const debugPanel = labelNode.addComponent(DebugPanel);
    // 运行时创建的 Label 无法走编辑器 @property 拖拽，直接赋值
    debugPanel.label = label;
    debugPanel.bindSource(this.graph.protagonist, this.graph.mapCenter);
    this.debugLabelNode = labelNode;

    // —— 6.5 解谜链进度标签（T6 / AC-13：第一步必须形成
    //       可观察的进度阶段；同时显示账本事件计数以验证
    //       "终点恰好写入一条 NarrativeEvent"） ——
    const puzzleLabelNode = new Node('PuzzleLabel');
    this.node.addChild(puzzleLabelNode);
    puzzleLabelNode.layer = this.node.layer;
    const puzzleTransform = puzzleLabelNode.addComponent(UITransform);
    // 布局修复：原位置 (-430,240) + 宽 760 使文本块左端
    //（-430-380=-810）超出屏幕左缘，折行后的行首（含敲击
    // 偏差数值）被裁在屏外。改为屏幕下方居中（宽 900 全部
    // 落在屏内），字号 24 / 行高 32 控制每行不折行。
    puzzleTransform.setContentSize(900, 48);
    const puzzleLabel = puzzleLabelNode.addComponent(Label);
    puzzleLabel.string = '解谜链：第一步';
    puzzleLabel.fontSize = 24;
    puzzleLabel.lineHeight = 32;
    puzzleLabel.color = new Color(255, 255, 255, 255);
    // 多行显示修复：宽度固定 760、高度随内容自适应并自动换行
    //（原默认单行模式 + 固定 48px 高，换行符之后的行被挤出
    // 节点范围而不可见——诊断行因此丢失）。
    puzzleLabel.overflow = Overflow.RESIZE_HEIGHT;
    puzzleLabel.enableWrapText = true;
    puzzleLabelNode.setPosition(0, 120, 0);
    this.puzzleLabel = puzzleLabel;

    // —— 6.6 T7 谱面层（视频 / 键盘打击垫 / 暂停面板） ——
    const windowSize = screen.windowSize;
    const chartLayerNode = new Node('ChartLayer');
    this.node.addChild(chartLayerNode);
    chartLayerNode.layer = this.node.layer;
    chartLayerNode.active = false;
    chartLayerNode
      .addComponent(UITransform)
      .setContentSize(windowSize.width, windowSize.height);
    this.chartLayerNode = chartLayerNode;

    // 视频（keepAspectRatio：黑边留待视图按宽高比排除）
    const videoNode = new Node('ChartVideo');
    chartLayerNode.addChild(videoNode);
    videoNode.layer = this.node.layer;
    videoNode
      .addComponent(UITransform)
      .setContentSize(windowSize.width, windowSize.height);
    const videoPlayer = videoNode.addComponent(VideoPlayer);
    videoPlayer.playOnAwake = false;
    videoPlayer.fullScreenOnAwake = false;
    videoPlayer.keepAspectRatio = true;
    videoPlayer.stayOnBottom = true;
    videoPlayer.volume = 1;
    this.videoPlayer = videoPlayer;

    // 键盘打击垫视图
    const padNode = new Node('ChartPad');
    chartLayerNode.addChild(padNode);
    padNode.layer = this.node.layer;
    padNode
      .addComponent(UITransform)
      .setContentSize(windowSize.width, windowSize.height);
    const chartPadView = padNode.addComponent(ChartPadView);
    chartPadView.bindHitSoundPlayer(
      (tier, kind) => this.playHit(tier, kind),
    );
    this.chartPadView = chartPadView;
    resources.load('guidance/head-logo/spriteFrame', SpriteFrame, (err, logo) => {
      if (!isValid(this, true)) { return; }
      if (err || !logo) { console.error('[SceneBuilder] Head LOGO 加载失败', err); return; }
      chartPadView.bindHeadLogo(logo);
    });

    // 暂停面板
    const pauseNode = new Node('ChartPause');
    chartLayerNode.addChild(pauseNode);
    pauseNode.layer = this.node.layer;
    pauseNode
      .addComponent(UITransform)
      .setContentSize(windowSize.width, windowSize.height);
    this.pausePanel = pauseNode.addComponent(ChartPausePanel);

    // 击音播放器（playOneShot 复用同一 AudioSource）
    const hitNode = new Node('HitAudio');
    chartLayerNode.addChild(hitNode);
    this.hitAudioSource = hitNode.addComponent(AudioSource);

    // —— 资源加载：视频（缺失仅黑屏，不阻塞）——
    resources.load(
      'video/chart_video_placeholder',
      VideoClip,
      (err: Error | null, clip: VideoClip | null) => {
        if (!isValid(this, true)) { return; }
        if (err != null || clip == null) {
          console.warn('[SceneBuilder] 谱面视频缺失（黑底运行）：', err);
          return;
        }
        videoPlayer.clip = clip;
        if (this.chartEntered) { this.startChartVideo(); }
      },
    );

    // —— 击音 ×3（可替换；缺失静默）——
    this.loadHitClip('audio/hit_regular', 'regular');
    this.loadHitClip('audio/hit_drum', 'drum');
    this.loadHitClip('audio/hit_heavy', 'heavy');

    // —— 独立谱面 JSON：引导线严格拒绝非法/超范围数据；旧 T7 保留 ——
    const chartResourcePath = this.UseGuidanceChart ? this.ChartResourcePath.trim() : 'chart/chart_placeholder';
    if (this.UseGuidanceChart && !/^chart\/[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(chartResourcePath)) {
      this.showChartLoadError(chartLayerNode, new Error('ChartResourcePath 须为 chart/ 下不含 .json 的资源路径'));
    } else {
      resources.load(
        chartResourcePath,
        JsonAsset,
        (err: Error | null, asset: JsonAsset | null) => {
          if (!isValid(this, true)) { return; }
          if (this.UseGuidanceChart) {
            try {
              if (err || !asset) { throw err ?? new Error('GuidanceChart 资源缺失'); }
              this.chartData = parseGuidanceChart(asset.json, this.keyboardLayout);
              this.chartDataResolved = true;
              // 先绑定首演和谱面，避免颜色先到后被 bindChart 的清理覆盖。
              this.ensureChartPremiere();
              // 可选颜色只流向表现层；玩法数据与首演判定不含 RGB。
              const chart = this.chartData;
              if (resources.getInfoWithPath(chartResourcePath + '.visual', JsonAsset)) {
                resources.load(chartResourcePath + '.visual', JsonAsset, (visualError, visualAsset) => {
                  if (!isValid(this, true)) { return; }
                  if (visualError || !visualAsset) { return; }
                  try {
                    const visual = parseGuidanceVisualData(visualAsset.json, chart);
                    this.chartPadView?.bindNodeColors(visual.nodes);
                  } catch (error) {
                    console.warn('[SceneBuilder] 颜色伴随文件无效，使用默认颜色：', chartResourcePath, error);
                  }
                });
              }
            } catch (error) {
              this.showChartLoadError(chartLayerNode, error);
            }
            return;
          }
          if (err == null && asset != null && asset.json != null) {
            const parsed = parseChartData(
              asset.json,
              this.keyboardLayout.layoutVersion,
            );
            if (parsed !== null) {
              this.chartData = parsed;
              this.chartDataResolved = true;
              return;
            }
            console.warn('[SceneBuilder] 谱面 JSON 形状无效，使用回退谱面');
          } else {
            console.warn('[SceneBuilder] 谱面 JSON 缺失，使用回退谱面：', err);
          }
          this.chartData = createFallbackChartData(this.keyboardLayout.layoutVersion);
          this.chartDataResolved = true;
        },
      );
    }

    // —— 7. 帧驱动固定三步接线 ——
    // ① InputCollector；② session（IntentPort）；③ refreshables
    inputCollector.bindCameraRig(this.cameraRig);
    // T7：谱面状态路由 + 视频媒体时钟 + 世界敲击录制回调。
    // 局部捕获 session：闭包内不再对可空字段 this.graph 做窄化。
    const session = this.graph.session;
    inputCollector.bindChartStateProvider(
      () => session.getChartPlaybackState(),
    );
    inputCollector.bindChartContextProvider(() => session.isChartEntryScheduled());
    inputCollector.bindWorldMotionProvider(() => session.isWorldMotionGated());
    inputCollector.bindChartTimeProbe(() => this.readVideoTimeMs());
    inputCollector.bindWorldStrikeRecorder(() => this.recordWorldStrike());
    inputCollector.bindWorldStrikeResetter(() => { this.strikeTimeline.length = 0; });
    this.cameraRig.bindProtagonist(this.graph.protagonist);
    frameDriver.bindWiring(inputCollector, this.graph.session);

    // 暂停面板接线：暂停判定 + 继续 / 退出（经输入采集转意图）。
    if (this.pausePanel !== null) {
      this.pausePanel.bindWiring(
        () => session.getChartPlaybackState() === 'Paused',
        () => inputCollector.requestToggleChartPause(),
        () => inputCollector.requestExitChart(),
      );
    }

    frameDriver.addRefreshable(this);
    frameDriver.addRefreshable(this.cameraRig);
    frameDriver.addRefreshable(protagonistView);
    frameDriver.addRefreshable(trailRenderer);
    frameDriver.addRefreshable(debugPanel);
    // T5：感知滤镜 + 全部元素实体视图每帧刷新
    frameDriver.addRefreshable(perceptionFilter);
    // T7：打击垫 + 暂停面板每帧刷新（层未激活时内部自判空）。
    frameDriver.addRefreshable(chartPadView);
    if (this.pausePanel !== null) {
      frameDriver.addRefreshable(this.pausePanel);
    }
    for (const entityView of elementViews) {
      frameDriver.addRefreshable(entityView);
    }
    for (const renderer of worldRoot.getComponentsInChildren(MeshRenderer)) {
      if (renderer.mesh) { this.createdVisualAssets.push(renderer.mesh); }
      if (renderer.sharedMaterial) { this.createdVisualAssets.push(renderer.sharedMaterial); }
    }
  }

  /**
   * Cocos 每帧回调：
   * - 视距（ViewDistance）→ 相机 fov（AC-03 可视范围变化，
   *   不触碰主角坐标）；
   * - 主角位于旋转路段区间时驱动镜头旋转（AC-04）。
   */
  update(dt: number): void {
    if (this.graph === null || this.cameraRig === null) {
      return;
    }
    const transform = this.node.getComponent(UITransform)!;
    const parentTransform = this.node.parent?.getComponent(UITransform);
    if (parentTransform) { transform.setContentSize(parentTransform.width, parentTransform.height); }
    for (const node of [this.chartLayerNode, this.chartPadView?.node, this.pausePanel?.node, this.videoPlayer?.node]) {
      node?.getComponent(UITransform)?.setContentSize(transform.width, transform.height);
    }
    if (this.debugLabelNode) {
      this.debugLabelNode.setPosition(0, transform.height / 2 - 28, 0);
      this.debugLabelNode.getComponent(UITransform)?.setContentSize(transform.width - 48, 48);
    }
    if (this.puzzleLabel) {
      this.puzzleLabel.node.setPosition(0, -transform.height / 2 + 120, 0);
      this.puzzleLabel.node.getComponent(UITransform)?.setContentSize(Math.min(900, transform.width - 48), 220);
      this.puzzleLabel.fontSize = Math.min(22, Math.max(14, transform.width / 44));
    }
    // T7：谱面数据解析后创建首演并绑定 director / 视图。
    this.ensureChartPremiere();
    if (this.chartEntered && this.chartPremiere) {
      const ended = this.audioOutputClock.hasChartMediaEnded();
      const unavailable = this.audioOutputClock.isChartMediaUnavailable();
      const state = this.chartPremiere.getState();
      if (state === 'Ready' || state === 'Playing') {
        this.chartMediaUnavailableElapsedMs = unavailable && !ended
          ? this.chartMediaUnavailableElapsedMs + dt * 1000 : 0;
      }
      // 这里只提供时间；判定推进归 director，先消费本帧时间戳输入。
      // 媒体提前结束后原生时钟停滞，未决对象沿独立时间继续至终结；暂停不推进。
      if ((ended && this.chartPremiere.getResolvedCount() < this.chartPremiere.getTotalNoteCount()) ||
          (unavailable && !ended && this.chartMediaUnavailableElapsedMs >= CHART_MEDIA_END_TIMEOUT_MS)) {
        if (state === 'Ready' || state === 'Playing') {
          this.chartFallbackTimeMs = this.chartPremiere.getCurrentTimeMs() + dt * 1000;
        }
      }
    }

    // AC-03：视距映射 fov（ViewDistance=10 → fov=45°）
    if (this.camera3D !== null) {
      this.camera3D.fov = this.cameraRig.getViewDistance() * FOV_PER_VIEW_DISTANCE;
    }

    // AC-04：旋转路段 [3, 6] WM 内线性转到 -25°，区间外 0°
    const lateral = this.graph.protagonist.getPosition().lateral;
    if (lateral >= ROUTE_BAND_START && lateral <= ROUTE_BAND_END) {
      const ratio = (lateral - ROUTE_BAND_START) /
        (ROUTE_BAND_END - ROUTE_BAND_START);
      this.cameraRig.rotateAlongRoute(ratio * ROUTE_MAX_ANGLE);
    } else {
      this.cameraRig.rotateAlongRoute(0);
    }

    // —— T6：解谜链进度标签（AC-13 可观察进度阶段） ——
    if (this.puzzleLabel !== null && this.puzzleProgress !== null) {
      const stage = this.puzzleProgress.getStage();
      const stageText = stage === 'Step1'
        ? '第一步：走近深痕，使其投影进入屏幕中央敲击区'
        : stage === 'AwaitingStrike'
          ? '第二步：跟拍按数字键（±100ms，连续 7 秒无漏拍通过）'
          : '解谜完成';
      const bgmText = !this.bgmClipLoaded
        ? this.bgmLoadFailed
          ? 'BGM:资源缺失'
          : 'BGM:加载中'
        : this.bgmReady
          ? 'BGM:正常'
          : 'BGM:点击屏幕出声';
      // 诊断行（纯显示，AC-13 第一步条件实时数值，供人工测试
      // 定位卡点）：距深痕平面距离与深痕屏幕投影；判定阈值
      // 显示为占位口径（接近 2 / 敲击区 0.30~0.70），非冻结值。
      let diagnostics = '';
      if (this.deepTrace !== null) {
        const protagonistPos = this.graph.protagonist.getPosition();
        const tracePos = this.deepTrace.getPosition();
        const dx = tracePos.lateral - protagonistPos.lateral;
        const dz = tracePos.depth - protagonistPos.depth;
        const distanceWm = Math.sqrt(dx * dx + dz * dz);
        const projection =
          this.screenProjectionOf !== null ? this.screenProjectionOf() : null;
        const projectionText = projection === null
          ? '不可用'
          : `(${projection.x.toFixed(2)}, ${projection.y.toFixed(2)})`;
        let deviationText = '未敲击';
        if (this.lastStrikeDeviationMs !== null) {
          const deviation = this.lastStrikeDeviationMs;
          deviationText =
            (deviation >= 0 ? '+' : '') + deviation.toFixed(0) + 'ms';
        }
        // 连续无失误持续进度（AC-13 可观察进度阶段；时间制）。
        let sustainedText = '';
        if (this.puzzleChain !== null) {
          const elapsed = this.puzzleChain.getSustainedElapsedMs();
          const req = this.puzzleChain.getRequiredSustainedMs();
          const elapsedSec = (elapsed / 1000).toFixed(1);
          const reqSec = (req / 1000).toFixed(0);
          sustainedText = `\n持续 ${elapsedSec}/${reqSec}s（miss 归零）`;
        }
        diagnostics =
          `\n距深痕 ${distanceWm.toFixed(1)} 米（需≤2）｜`
          + `投影 ${projectionText}（需在 0.30~0.70）`
          + `\n最近敲击偏差 ${deviationText}（需|偏差|≤100，+ = 敲晚）`
          + sustainedText;
      }
      this.puzzleLabel.string =
        `解谜链：${stageText}｜账本事件：${this.graph.session.getLedgerEvents().length}｜${bgmText}`
        + diagnostics;
    }

    // —— T6：BGM 音量（AC-12：越靠近痕音量越大；只调音量，
    //    不改节拍 / 播放速度 / 判定窗口；距离口径与 director
    //    链条件同式：平面平方和开根） ——
    if (
      this.bgmReady &&
      this.proximityVolume !== null &&
      this.deepTrace !== null
    ) {
      const protagonistPos = this.graph.protagonist.getPosition();
      const tracePos = this.deepTrace.getPosition();
      const dx = tracePos.lateral - protagonistPos.lateral;
      const dz = tracePos.depth - protagonistPos.depth;
      const distanceWm = Math.sqrt(dx * dx + dz * dz);
      this.audioOutputClock.setBgmVolume(this.chartEntered ? 0 :
        this.proximityVolume.calculateVolume(distanceWm));
    }
  }

  /** FrameDriver 逻辑提交后同帧同步媒体与显示，避免暂停晚一帧。 */
  onFrameRefresh(): void {
    if (!this.graph) { return; }
    if (this.puzzleLabel) { this.puzzleLabel.node.active = !this.graph.session.isWorldMotionGated(); }
    // —— T7：谱面入口轮询（VERDICT-115） ——
    // director 在 EnterChart 接受帧已同帧接入世界门控；表现层
    // 隐藏 3D 世界，显示谱面层并从 0 起播视频。
    if (!this.chartEntered && this.graph.session.isChartEntryScheduled()) {
      this.chartEntered = true;
      if (this.puzzleLabel) { this.puzzleLabel.node.active = false; }
      if (this.worldRootNode !== null) {
        this.worldRootNode.active = false;
      }
      if (this.debugLabelNode !== null) {
        this.debugLabelNode.active = false;
      }
      if (this.chartLayerNode !== null) {
        this.chartLayerNode.active = true;
      }
      this.startChartVideo();
    }

    // —— T7：按首演状态控制媒体 + 退出回收（FrameDriver 不停） ——
    if (this.chartEntered) {
      const chartState = this.graph.session.getChartPlaybackState();
      if (chartState === 'Paused' && this.lastChartState !== 'Paused') {
        // 冻结媒体位置（与判定窗口 / 进度一同停住）。
        this.videoPlayer?.pause();
        if (this.videoPlayer && this.chartPremiere) {
          this.videoPlayer.currentTime = this.chartPremiere.getCurrentTimeMs() / 1000;
          this.audioOutputClock.resetChart();
          if (this.chartFallbackTimeMs >= 0) { this.chartFallbackTimeMs = this.chartPremiere.getCurrentTimeMs(); }
        }
      } else if (chartState === 'Playing' && this.lastChartState === 'Paused') {
        // 恢复后重建视频时钟读数（探针每帧读 currentTime），
        // 若视频仍暂停则续播。
        if (this.videoPlayer !== null && !this.videoPlayer.isPlaying) {
          this.videoPlayer.resume();
        }
      } else if (chartState === 'Exited') {
        this.teardownChart();
      }
      this.lastChartState = chartState;
    }

  }

  /**
   * Cocos 销毁生命周期：注销本组件注册的输入监听。
   */
  onDestroy(): void {
    input.off(Input.EventType.MOUSE_DOWN, this.onAutoplayUnlock, this);
    input.off(Input.EventType.KEY_DOWN, this.onAutoplayUnlock, this);
    this.audioOutputClock.destroy();
    // This owned 3D sibling is intentionally outside Canvas's UI traversal.
    if (this.worldRootNode && isValid(this.worldRootNode, true)) { this.worldRootNode.destroy(); }
    this.worldRootNode = null;
    // 这些灰盒网格 / 材质为运行时创建，不属于资源库资产。
    for (const asset of this.createdVisualAssets) {
      if (isValid(asset, true)) { asset.destroy(); }
    }
    this.createdVisualAssets.length = 0;
  }

  onDisable(): void {
    if (this.folderWorld) {
      this.videoPlayer?.pause();
      if (this.worldRootNode && isValid(this.worldRootNode, true)) { this.worldRootNode.active = false; }
    }
  }

  /**
   * 首次鼠标按下：在用户手势内起播 BGM（T6 灰盒）。
   *
   * 浏览器 autoplay 政策：AudioContext 未经用户手势创建 /
   * 恢复时处于挂起状态（无声、播放不推进）。因此起播不在
   * 资源加载回调里执行，而挪到首次鼠标按下——手势内的
   * play() 调用满足政策，AudioContext 得以正常出声，拍点
   * 时钟以 AudioContext 输出时间为原点。
   *
   * 注意：不得使用 audioEngine.resume()——该符号在 3.8 预览
   * 构建运行时为 undefined（类型声明存在、实现被裁剪），
   * 调用即 TypeError 且会中断同一 emit 中的后续监听回调。
   * 幂等：仅首次生效；任意鼠标键均可解锁（手势要求与键位无关）。
   */
  private onAutoplayUnlock(): void {
    if (this.autoplayUnlocked) {
      return;
    }
    this.autoplayUnlocked = true;
    void this.audioOutputClock.unlock().then(() => {
      if (!isValid(this, true)) { return; }
      if (this.bgmClipLoaded && !this.bgmReady) { this.bgmReady = this.audioOutputClock.startBgm(); }
    }).catch(error => {
      this.autoplayUnlocked = false;
      console.error('[SceneBuilder] 音频解锁失败', error);
    });
  }

  // ----------------------------------------------------------
  // T7 谱面（视频 / 击音 / 首演 / 回收）
  // ----------------------------------------------------------

  /** 资源边界失败保持原谱面拒绝加载行为，不回退成另一张引导线谱面。 */
  private showChartLoadError(parent: Node, error: unknown): void {
    console.error('[SceneBuilder] 引导线谱面拒绝加载：', this.ChartResourcePath, error);
    const errorNode = new Node('GuidanceLoadError');
    errorNode.layer = parent.layer;
    parent.addChild(errorNode);
    errorNode.addComponent(UITransform).setContentSize(800, 120);
    const errorLabel = errorNode.addComponent(Label);
    errorLabel.fontSize = 22;
    errorLabel.color = new Color(255, 100, 100);
    errorLabel.string = `谱面拒绝加载：${this.ChartResourcePath}\n${String(error)}\n按 Esc 返回世界`;
  }

  /** 加载一个可替换击音到指定类别槽位（缺失静默）。 */
  private loadHitClip(path: string, slot: 'regular' | 'drum' | 'heavy'): void {
    resources.load(
      path,
      AudioClip,
      (err: Error | null, clip: AudioClip | null) => {
        if (!isValid(this, true)) { return; }
        if (err != null || clip == null) {
          console.warn('[SceneBuilder] 击音缺失（静默）：', path, err);
          return;
        }
        this.hitClips[slot] = clip;
      },
    );
  }

  /** 播放击音（Miss 不播音；鼓音仅表现反馈，不进入判定）。 */
  private playHit(tier: ChartJudgeTier, kind: ChartPadKind): void {
    if (tier === 'Miss') {
      return;
    }
    const clip =
      kind === 'Drum'
        ? this.hitClips.drum
        : kind === 'Heavy'
          ? this.hitClips.heavy
          : this.hitClips.regular;
    if (clip !== null && this.hitAudioSource !== null) {
      this.hitAudioSource.playOneShot(clip, 1);
    }
  }

  /** 读视频媒体时间（毫秒；未进入 / 无播放器 → -1）。 */
  private readVideoTimeMs(): number {
    if (this.videoPlayer === null || !this.chartEntered) {
      return -1;
    }
    if (this.chartPremiere?.getState() === 'Paused') { return this.chartPremiere.getCurrentTimeMs(); }
    return Math.max(this.audioOutputClock.readChartTimeMs(), this.chartFallbackTimeMs);
  }

  /**
   * 录制一条世界敲击（FIFO 时间线）。BGM 未就绪不记录；
   * 叠加 beatClockOffsetMs，统一在 BGM 音频时间线上取时间戳。
   */
  private recordWorldStrike(): void {
    if (this.graph === null || !this.bgmReady) {
      return;
    }
    const offset = this.graph.session.getBeatClockOffsetMs();
    const strikeTimeMs = this.audioOutputClock.readBgmTimeMs() + offset;
    const targetBeatTimeMs =
      Math.round(strikeTimeMs / BEAT_INTERVAL_MS) * BEAT_INTERVAL_MS;
    this.strikeTimeline.push({ strikeTimeMs, targetBeatTimeMs });
    this.lastStrikeDeviationMs = strikeTimeMs - targetBeatTimeMs;
  }

  /** 从 0 起播谱面视频。 */
  private startChartVideo(): void {
    if (this.videoPlayer === null || !this.videoPlayer.clip || !this.videoPlayer.nativeVideo || this.chartMediaStarted) {
      return;
    }
    this.audioOutputClock.attachVideo(this.videoPlayer.nativeVideo);
    this.audioOutputClock.resetChart();
    this.videoPlayer.enabled = true;
    // Reapply after teardown restored the UI camera's world overlay flags.
    this.videoPlayer.stayOnBottom = false;
    this.videoPlayer.stayOnBottom = true;
    this.chartMediaStarted = true;
    this.videoPlayer.currentTime = 0;
    this.videoPlayer.play();
  }

  /**
   * 数据解析后创建首演，绑定 director（含媒体时钟探针）与打击垫；
   * 首演未创建时执行一次。
   */
  private ensureChartPremiere(): void {
    if (
      this.chartPremiere !== null ||
      this.graph === null ||
      !this.chartDataResolved ||
      this.chartData === null
    ) {
      return;
    }
    const premiere = new ChartPremiere(this.chartData, this.keyboardLayout);
    premiere.setGuideTransparency(this.GuideTransparency);
    this.chartPremiere = premiere;
    this.graph.session.bindChartPremiere(premiere);
    this.graph.session.bindChartClockProbe(() => this.readVideoTimeMs());
    this.graph.session.bindChartMediaProbe(() => ({
      ended: this.audioOutputClock.hasChartMediaEnded(),
      unavailable: this.audioOutputClock.isChartMediaUnavailable(),
    }));
    if (this.chartPadView !== null) {
      this.chartPadView.bindPremiere(premiere);
      this.chartPadView.bindChart(this.chartData, this.keyboardLayout);
    }
  }

  /**
   * 退出回收：停止视频、隐藏谱面层、还原世界；保留首演（Exited）。
   * 入口（chartEntryScheduled）已由 director 清；重入由
   * director.reopen 复位，不重复 T6 记录。
   */
  private teardownChart(): void {
    this.videoPlayer?.stop();
    if (this.videoPlayer) { this.videoPlayer.enabled = false; }
    this.audioOutputClock.resetChart();
    this.chartMediaStarted = false;
    this.chartMediaUnavailableElapsedMs = 0;
    this.chartFallbackTimeMs = -1;
    if (this.chartLayerNode !== null) {
      this.chartLayerNode.active = false;
    }
    if (this.worldRootNode !== null) {
      this.worldRootNode.active = true;
    }
    // Web VideoPlayer.stayOnBottom mutates the render camera to clear color.
    // Disabling the video does not restore it, so the late UI camera would
    // erase the newly restored 3D world until explicitly reset here.
    if (this.uiCamera) { this.uiCamera.clearFlags = CLEAR_FLAGS_DEPTH_ONLY; }
    if (this.debugLabelNode !== null) {
      this.debugLabelNode.active = true;
    }
    this.chartEntered = false;
    if (this.puzzleLabel) { this.puzzleLabel.node.active = true; }
  }
}

/**
 * 校验并解析 ChartData（资源边界；非法形状返回 null）。
 *   chartId 非空；tier ∈ 允许集合（缺省 Regular）；
 *   layoutVersion 与当前布局一致；notes 每项 timeMs 有限 ≥0、
 *   keyId 在白名单槽位内；按 timeMs 复制排序。
 */
function parseChartData(raw: unknown, layoutVersion: string): ChartData | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const chartId = source.chartId;
  if (typeof chartId !== 'string' || chartId.length === 0) {
    return null;
  }
  if (source.layoutVersion !== layoutVersion) {
    return null;
  }
  const tierInput = source.tier;
  const tier: ChartTier =
    tierInput === 'Character' || tierInput === 'World' ||
    tierInput === 'Final' || tierInput === 'Regular'
      ? tierInput
      : 'Regular';
  const notesRaw = source.notes;
  if (!Array.isArray(notesRaw)) {
    return null;
  }
  const keyIdSet = new Set<ChartKeyId>(CHART_KEY_IDS);
  const notes: Note[] = [];
  for (const item of notesRaw) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }
    const noteSource = item as Record<string, unknown>;
    const timeMs = noteSource.timeMs;
    const keyId = noteSource.keyId;
    if (
      typeof timeMs !== 'number' ||
      !Number.isFinite(timeMs) ||
      timeMs < 0 ||
      typeof keyId !== 'string' ||
      !keyIdSet.has(keyId as ChartKeyId)
    ) {
      return null;
    }
    notes.push({ timeMs, keyId: keyId as ChartKeyId });
  }
  notes.sort((a, b) => a.timeMs - b.timeMs);
  return { chartId, tier, layoutVersion, notes };
}

/**
 * 构造确定性回退谱面（资源缺失 / 非法时）。
 * 覆盖字母 / 数字 / 符号可见槽位；Space 只用于 Head，不作为回退 Note。
 */
function createFallbackChartData(layoutVersion: string): ChartData {
  const sequence: ChartKeyId[] = [
    'KeyD', 'KeyF', 'Digit1', 'KeyG', 'KeyJ', 'KeyK', 'Comma', 'Period',
  ];
  const notes: Note[] = sequence.map((keyId, index) => ({
    timeMs: 1000 + index * 500,
    keyId,
  }));
  return {
    chartId: 'chart-placeholder-fallback',
    tier: 'Regular',
    layoutVersion,
    notes,
  };
}
