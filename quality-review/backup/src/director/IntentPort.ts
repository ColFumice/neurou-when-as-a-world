// ============================================================
// S5 叙事导演域 · IntentPort 意图窄口（名库 v2.1 冻结名）
//
// 依据：
// - 名库 v2.1：IntentPort 是 presentation 通往 director
//   的唯一窄路，文件放 src/director/；PlayerIntent 六种意图
//   （Move / Strike / SwitchPerceptionMode / EnterChart /
//   ExitChart / Jump）；
// - stage-1.md §6：presentation → director 为 I 边，
//   只接收“玩家想做什么”，不暴露写入能力；
// - 名库 v1.9 / HANDOFF 特别提醒：当前感知模式由 director
//   保存为运行时状态，不写入账本；trace 以模式为参数，
//   自身不保存模式；表现层经本窄口读取当前模式以切换
//   低饱和滤镜。
// - HANDOFF-ROUND-13 / VERDICT-096：主角状态承载类
//   Protagonist 命名冻结，director 持有其实例引用以分发
//   Move 意图（director → character 矩阵 A，允许值导入）。
// - VERDICT-100 第 4 条 / 名库 v1.9 纵深语义：MapCenter 为
//   纵深裁剪基准，director 持有当前 MapCenter 引用以传给
//   protagonist.move（director → world 矩阵 A）。
// - HANDOFF-ROUND-15 / VERDICT-101 ~ 106：跳跃功能。
// - HANDOFF-ROUND-16 / VERDICT-107 ~ 109 / 名库 v2.1：
//   Jump 修订为“每帧检测空格按住状态，按住时该帧提交一个
//   无载荷 Jump”；本帧执行顺序冻结（见 submitFrameIntents）；
//   tickVertical 每帧只推进一次；紧贴地面为逻辑落地数值容差。
// - HANDOFF-ROUND-16 / T5（AC-09 ~ AC-11）：
//   director 持有参与 Trigger / Forget 检测的元素实体，
//   每帧按主角平面距离推进可见性（阶段 1 占位，阶段 4
//   由解谜链规则细化）；提供 setPerceptionMode。
// - HANDOFF-ROUND-17 / T6（VERDICT-113 / 114 / 115 / 116 /
//   117，AC-12 ~ AC-14）：
//   · 解谜链调度：director 每帧计算主角到深痕的平面距离并
//     经表现层探针获取深痕屏幕投影，驱动 PuzzleChain 两步链
//     （进度只更新 PuzzleProgress，不写账本）；
//   · 链终点结算：到达终点后由 director 恰好追加一条
//     NarrativeEvent（INV-2 / E5：director 是唯一可引用
//     LedgerAppend 的模块）并防止重复结算，同时标记深痕
//     已触发（不修改 TraceTier / 进度 / 账本 / 门控，INV-11）；
//   · 谱面入口（VERDICT-115）：EnterChart 仅在链终点结算
//     完成后接受（谱面入口由深痕授予，意图本身不含载荷）；
//     接受即调度场景切换并同帧接入世界运动门控。
//
// - HANDOFF-ROUND-18 / T7（VERDICT-121 ~ 126，AC-15 ~ AC-21）：
//   · 绑定谱面首演状态机（chartPremiere）与谱面媒体时钟探针
//     （chartClockProbe）；门控期间由 director 驱动谱面推进，
//     世界不推进、不补算，FrameDriver 照常；
//   · 输入分流（INV-13）：谱面上下文（Playing/Paused）中带
//     keyId 的 Strike 提交给首演，ToggleChartPause 按输入序列
//     定边界；世界上下文中 Strike 走解谜链；
//   · 完成结算：首演进 Completed 后由 director 恰好追加一条
//     带 ChartRef 的 NarrativeEvent，与得分无关；
//   · 退出（AC-21）：ExitChart 不写账本、恢复世界运动、保留
//     入口；重入复位首演但不重复 T6 链终点记录。
//
// 世界运动门控（VERDICT-111 / HANDOFF-ROUND-17 任务四 3）：
//   谱面及禁止世界运动的转场期间，世界运动暂停推进；暂停
//   时间不得在恢复后作为一个大步长补算。阶段 1 门控点在
//   DirectorSession（worldMotionGated）：EnterChart 被接受
//   的同一帧起跳过 Move / Jump / tickVertical / 可见性 /
//   解谜链各步——不存在"角色仍可驱动世界运动"的空档；
//   意图汇总仍每帧执行（表现层系统侧 EnterChart 经本方法
//   到达，不被门控吞掉）。
//
// 本文件含：IntentPort 窄口接口 + DirectorSession 运行时
//   状态类。逻辑目录，不引用 cc。
//
// 本文件命名已于 PROTOCOL HANDOFF-ROUND-17 追认批次正式冻结。
// 追认名：bindBeatClockProbe、beatClockProbe、bindPuzzleChain、
// bindDeepTrace、bindLedgerAppend、bindScreenProjectionProbe、
// bindRhythmStrikeProbe、isChartEntryScheduled、handleStrikeIntent、
// handleEnterChartIntent、updatePuzzleChain、settlePuzzleChainEndpoint、
// buildEndpointNarrativeEvent、endpointSettled、worldMotionGated、
// chartEntryScheduled、tracePosition、ScreenProjection。
//
// VERDICT-120 新增直译名（待追认）：beatClockOffsetMs
//   （加到输出对齐后的拍点时钟上的校准偏移，默认 0；
//    用户敲击稳定晚于目标时为负）、getBeatClockOffsetMs、
//    setBeatClockOffsetMs。
// ============================================================

import type { PlayerIntent } from './PlayerIntent';
import type { PerceptionMode } from './PlayerIntent';
import type { MapCenter } from '../world/MapCenter';
import { Protagonist } from '../character/Protagonist';
import type { ElementEntity } from '../trace/ElementEntity';
import { VisibilityState } from '../trace/VisibilityState';
import { VisibilityTransitionReason } from '../trace/VisibilityTransition';
import { PuzzleChain } from '../trace/PuzzleChain';
import { DeepTrace } from '../trace/DeepTrace';
import type { RhythmStrike } from '../trace/RhythmStrike';
import type { LedgerAppend } from '../ledger/LedgerAppend';
import { InputSource } from '../ledger/NarrativeEvent';
import type { NarrativeEvent } from '../ledger/NarrativeEvent';
import type { NarrativeVector } from '../ledger/NarrativeEvent';
import { VectorSchemaVersion } from '../../constants/index';
import type { NarrativeEventId, ChartRef } from '../../constants/index';
import type { ChartPlaybackState } from '../chart/ChartPlaybackState';
import type { ChartPremiere } from '../chart/ChartPremiere';

// ------------------------------------------------------------
// T5 可见性触发占位参数（AC-11；阶段 1 占位，阶段 4 由
// 解谜链规则细化）。HANDOFF-ROUND-16 明示 constants 本轮不
// 新增常量，且“具体距离或触发方式由你选择占位实现”，故
// 登记在本消费文件内部，禁止移入逻辑代码其他位置。
// 用平方比较（dx²+dz² <= r²），不做开方 / 向量计算。
// ------------------------------------------------------------

/** 触发半径（WorldMeter，占位）：主角进入 Concealed 实体
 *  该距离内 → Trigger 转换（形态 → 明态）。阶段 1 占位，
 *  阶段 4 由解谜链规则细化。 */
const TRIGGER_DISTANCE_WM = 2;

/** 遗忘半径（WorldMeter，占位）：已显形实体与主角距离达到
 *  该值 → Forget 转换（明态 → 形态，暂忘）。大于触发半径
 *  形成迟滞区间，避免边界来回翻转。阶段 1 占位，阶段 4 由
 *  解谜链规则细化。 */
const FORGET_DISTANCE_WM = 5;

/**
 * 归一化屏幕投影点（文件内私有结构，不导出新名称）。
 *
 * 与 PuzzleChain 文件内的 ScreenProjectionPoint 同构（结构化
 * 类型直接赋值）；测量由表现层完成，经探针注入本文件，
 * director 不做任何投影计算、不引用 cc。
 */
interface ScreenProjection {
  readonly x: number;
  readonly y: number;
}

/**
 * IntentPort 意图窄口
 *
 * 全工程 presentation → director 的唯一引用面
 * （check-dependencies E9 硬校验：presentation 只允许引用
 * PlayerIntent.ts 与本文件）。
 *
 * 只包含：
 * 1. 接收本帧玩家意图与本帧时长（不暴露任何账本写入能力，
 *    账本追加在后续任务中由 director 内部经 LedgerAppend
 *    完成，INV-2）；
 * 2. 读取当前感知模式（供表现层切换低饱和滤镜；只读值）。
 */
export interface IntentPort {
  /**
   * 接收本帧全部玩家意图。
   *
   * 方法名 submitFrameIntents 已经 HANDOFF-ROUND-12 PROTOCOL
   * 验收轮第一部分正式追认冻结。
   *
   * @param intents 本帧意图（按采集顺序；空数组表示无操作）
   * @param frameDurationSeconds 本帧时长（秒）
   */
  submitFrameIntents(
    intents: ReadonlyArray<PlayerIntent>,
    frameDurationSeconds: number,
  ): void;

  /**
   * 读取当前感知模式（运行时状态，只读；不来自账本）。
   * 方法名已经 HANDOFF-ROUND-12 PROTOCOL 验收轮第一部分
   * 正式追认冻结。
   */
  getCurrentPerceptionMode(): PerceptionMode;

  /**
   * 读取当前谱面播放状态（chart 状态经 director 只读暴露；
   * 未绑定首演时为 Ready）。表现层据此做上下文路由
   * （VERDICT-121 / INV-13）：只有 Playing 接受演奏输入。
   */
  getChartPlaybackState(): ChartPlaybackState;
}

/**
 * DirectorSession 叙事导演运行时状态（HANDOFF-ROUND-12
 * PROTOCOL 验收轮第一部分正式追认冻结类名）
 *
 * 阶段 1 承载：
 * - 当前感知模式（运行时状态；初始 Normal；不写入账本）；
 * - 主角引用 + 地图中点引用（用于 Move 意图分发）；
 * - 本帧意图分发：
 *     · SwitchPerceptionMode 即时生效；
 *     · Move 调用 protagonist.move(input, frameDuration,
 *       mapCenter)（VERDICT-096 / VERDICT-100 第 4 条）；
 *     · Strike → 解谜链第二步结算（T6 / VERDICT-117）；
 *     · EnterChart → 谱面入口调度（T6 / VERDICT-115，仅链
 *       终点结算完成后接受）；ExitChart 仍空挂起（T7）。
 *
 * 依赖矩阵：director → character A、director → world A
 * （stage-1.md §6），均为值导入。
 */
export class DirectorSession implements IntentPort {
  /** 当前感知模式（director 保存；trace 只经参数读取） */
  private currentPerceptionMode: PerceptionMode = 'Normal';

  /** 主角实例引用（VERDICT-096 解锁） */
  private protagonist: Protagonist | null = null;

  /** 地图中点引用（VERDICT-100 第 4 条 / 纵深裁剪基准） */
  private mapCenter: MapCenter | null = null;

  /**
   * 参与可见性检测的元素实体列表（T5 / AC-11）。
   *
   * 仅注册初始 Concealed、需要 Trigger / Forget 转换的实体；
   * 初始即 Revealed 的常驻实体（Initial / Process / 普通痕）
   * 不注册——它们不应因 Forget 被隐藏（AC-09 要求常驻可见）。
   * 方法名为直译，待 PROTOCOL 追认。
   */
  private readonly visibilityTrackedEntities: ElementEntity[] = [];

  /**
   * 接线主角实例（director 持有引用以分发 Move 意图）。
   *
   * @param protagonist 主角实例（VERDICT-096 冻结名）
   */
  bindProtagonist(protagonist: Protagonist): void {
    this.protagonist = protagonist;
  }

  /**
   * 接线地图中点（纵深裁剪基准）。
   *
   * @param mapCenter 地图中点（VERDICT-100 第 4 条：
   *                  纵深裁剪必须计入中点偏移）
   */
  bindMapCenter(mapCenter: MapCenter): void {
    this.mapCenter = mapCenter;
  }

  /**
   * 接线参与可见性检测的元素实体（T5 / AC-11）。
   *
   * 仅注册初始 Concealed 的实体；SceneBuilder 装配时调用一次。
   * 方法名为直译，待 PROTOCOL 追认。
   *
   * @param entities 需要 Trigger / Forget 转换的实体集合
   */
  bindVisibilityTrackedEntities(entities: ReadonlyArray<ElementEntity>): void {
    for (const entity of entities) {
      this.visibilityTrackedEntities.push(entity);
    }
  }

  // ------------------------------------------------------------
  // T6 解谜链 / 深痕 / 谱面入口（HANDOFF-ROUND-17 任务二 ~ 四）
  // 依赖矩阵：director → trace A、director → ledger A
  // （LedgerAppend 仅有 director 可引用，E5）；链进度只更新
  // PuzzleProgress，不写账本（HANDOFF-ROUND-17 任务二 2）。
  // ------------------------------------------------------------

  /** 解谜链（两步链；链绑定痕为场景中的深痕） */
  private puzzleChain: PuzzleChain | null = null;

  /** 深痕（链终点结算时标记触发；触发不改层级 / 进度 /
   *  账本 / 门控，INV-11） */
  private deepTrace: DeepTrace | null = null;

  /** 账本追加接口（链终点恰好写入一条 NarrativeEvent；INV-2） */
  private ledgerAppend: LedgerAppend | null = null;

  /** 屏幕投影探针：表现层测量深痕的归一化屏幕投影
   *  （x / y ∈ [0,1]，原点屏幕左上）；未就绪返回 null。
   *  director 不做投影计算（I 边探针注入模式）。 */
  private screenProjectionProbe:
    | (() => ScreenProjection | null)
    | null = null;

  /** 节奏敲击探针：表现层在敲击时刻记录（敲击时间戳，
   *  目标节拍时间戳）后经探针提供；无已记录敲击返回 null。 */
  private rhythmStrikeProbe: (() => RhythmStrike | null) | null = null;

  /** beat 时钟探针：表现层提供当前 beat 时钟毫秒（BGM 起播
   *  为原点；未就绪返回 -1）。供逐帧检查持续期超时用。 */
  private beatClockProbe: (() => number) | null = null;

  /**
   * beat 时钟校准偏移（毫秒，VERDICT-120）。
   *
   * 定义：加到输出对齐后的拍点时钟上的校准偏移；默认 0。
   * 用户敲击稳定晚于目标时，所需偏移为负（将拍点时钟前移，
   * 使目标拍点更早到达判定窗口中心）。挑战开始前确定，挑战
   * 中固定，不根据命中结果持续调整。
   */
  private beatClockOffsetMs = 0;

  /** 链终点是否已结算（防重复结算：恰好写入一条 NarrativeEvent） */
  private endpointSettled = false;

  /** 世界运动门控（VERDICT-111）：谱面入口调度后置位；
   *  置位帧起跳过 Move / Jump / tickVertical / 可见性 /
   *  解谜链各步——不推进、不补算。 */
  private worldMotionGated = false;

  /** 谱面入口是否已调度（表现层轮询后执行场景切换） */
  private chartEntryScheduled = false;

  /** T7 谱面首演状态机（chart 域；director 驱动推进与结算） */
  private chartPremiere: ChartPremiere | null = null;

  /**
   * 谱面媒体时钟探针：表现层提供当前谱面 / 视频媒体时间（毫秒）；
   * 媒体未就绪 / 未播放时返回 -1。director 据此推进首演。
   */
  private chartClockProbe: (() => number) | null = null;

  /** T7 完成账本是否已记录（恰好一条带 ChartRef 事件，幂等闸）。 */
  private chartCompletionRecorded = false;

  /**
   * 接线解谜链（方法名为"解谜链"直译，待 PROTOCOL 追认）。
   *
   * @param chain 两步解谜链（组合根装配注入）
   */
  bindPuzzleChain(chain: PuzzleChain): void {
    this.puzzleChain = chain;
  }

  /**
   * 接线深痕（方法名为"深痕"直译，待 PROTOCOL 追认）。
   *
   * @param trace 深痕实例（链绑定痕；链终点结算时标记触发）
   */
  bindDeepTrace(trace: DeepTrace): void {
    this.deepTrace = trace;
  }

  /**
   * 接线账本追加接口（方法名为直译，待 PROTOCOL 追认）。
   * 仅 director 可引用 LedgerAppend（E5）；账本承载实现
   * 待后续 HANDOFF 授权，阶段 1 由表现层组合根注入占位 sink。
   *
   * @param append 账本追加接口实现
   */
  bindLedgerAppend(append: LedgerAppend): void {
    this.ledgerAppend = append;
  }

  /**
   * 接线屏幕投影探针（方法名为直译，待 PROTOCOL 追认）。
   *
   * @param probe 返回深痕归一化屏幕投影（未就绪为 null）
   */
  bindScreenProjectionProbe(
    probe: () => ScreenProjection | null,
  ): void {
    this.screenProjectionProbe = probe;
  }

  /**
   * 接线节奏敲击探针（方法名为直译，待 PROTOCOL 追认）。
   *
   * @param probe 返回最近一次敲击的时间戳对（无则为 null）
   */
  bindRhythmStrikeProbe(probe: () => RhythmStrike | null): void {
    this.rhythmStrikeProbe = probe;
  }

  /**
   * 接线 beat 时钟探针（方法名为直译，待 PROTOCOL 追认）。
   *
   * @param probe 返回当前 beat 时钟毫秒（BGM 未就绪返回 -1）
   */
  bindBeatClockProbe(probe: () => number): void {
    this.beatClockProbe = probe;
  }

  /**
   * 接线谱面首演状态机（T7；方法名直译，待追认）。
   *
   * @param premiere 已加载谱面数据的首演状态机（chart 域）
   */
  bindChartPremiere(premiere: ChartPremiere): void {
    this.chartPremiere = premiere;
  }

  /**
   * 接线谱面媒体时钟探针（T7；方法名直译，待追认）。
   *
   * @param probe 返回当前谱面 / 视频媒体时间（毫秒），未播放返回 -1
   */
  bindChartClockProbe(probe: () => number): void {
    this.chartClockProbe = probe;
  }

  /**
   * 读取 beat 时钟校准偏移（VERDICT-120）。
   * 表现层在记录敲击时间戳时需将此偏移叠加到拍点时钟上，
   * 使 Strike 时间戳、目标拍点、持续期计时统一使用同一
   * 条音频时间线。
   */
  getBeatClockOffsetMs(): number {
    return this.beatClockOffsetMs;
  }

  /**
   * 设置 beat 时钟校准偏移（VERDICT-120）。
   * 在挑战开始前确定；挑战中固定不调整。
   */
  setBeatClockOffsetMs(offsetMs: number): void {
    this.beatClockOffsetMs = offsetMs;
  }

  /**
   * 查询谱面入口是否已调度（方法名为直译，待 PROTOCOL 追认）。
   *
   * 表现层（SceneBuilder）每帧轮询；为 true 时执行"切换到
   * 谱面场景"的表现侧调度——阶段 1 切至空占位场景并标注
   * "待 T7 填充"（HANDOFF-ROUND-17 任务四 4）。
   */
  isChartEntryScheduled(): boolean {
    return this.chartEntryScheduled;
  }

  /**
   * 设置当前感知模式（HANDOFF-ROUND-16 明示方法名）。
   *
   * 运行时状态，不写入账本；阶段 1 仅在 Normal / Triggered
   * 间切换（'Rain' 保留但不产生）。
   *
   * 注：表现层不直接调用本方法——玩家切换经
   * SwitchPerceptionMode 意图到达 submitFrameIntents 后由此
   * 方法落地；本方法公开供系统侧（未来转场 / 演出）使用。
   *
   * @param mode 目标感知模式
   */
  setPerceptionMode(mode: PerceptionMode): void {
    this.currentPerceptionMode = mode;
  }

  /**
   * 便捷工厂：以指定主角初始位置 + 地图中点构造 DirectorSession。
   *
   * 灰盒占位：场景接线（场景内部如何 new DirectorSession /
   * new Protagonist / new MapCenter）由表现层 SceneSetup 或
   * Cocos 场景文件挂载组件完成；director 不引用 cc。
   *
   * @param protagonistSeed 主角初始位置（lateral, depth）
   * @param mapCenter 地图中点
   */
  static createWithProtagonist(
    protagonistSeed: { lateral: number; depth: number },
    mapCenter: MapCenter,
  ): DirectorSession {
    const session = new DirectorSession();
    const protagonist = new Protagonist(protagonistSeed);
    session.bindProtagonist(protagonist);
    session.bindMapCenter(mapCenter);
    return session;
  }

  /**
   * 接收本帧全部玩家意图（VERDICT-108 / 名库 v2.1 冻结执行顺序）。
   *
   * 每帧严格按下列顺序执行：
   *   1. 汇总并筛选有效意图（含每帧检测的空格按住状态 → Jump；
   *      Move / Switch / Strike / Chart 各按分发规则处理）；
   *   2. 若主角已落地（isGrounded，含紧贴地面容差），处理本帧
   *      Jump 请求（起跳）；
   *   3. 推进一次垂直物理（tickVertical；本帧只推进一次）；
   *   4. 若本次推进使主角落地，且本帧有 Jump 请求：立即处理
   *      重新起跳（不再执行第二次 tickVertical）；
   *   5. 推进元素实体可见性检测；
   *   6. （T6 追加，链序未冻结待 PROTOCOL）解谜链推进与链
   *      终点结算，随后表现层读取最终状态。
   *
   * 关键规则（VERDICT-108）：
   *   - 每个允许世界运动的逻辑帧，即使意图数组为空，也必须
   *     推进一次垂直物理（无输入时也要落地）；
   *   - 同一帧不得因多个意图重复推进（即使数组含多个 Jump）；
   *   - 世界运动门控（VERDICT-111，谱面入口调度后置位）：
   *     门控期间跳过第 2~6 步——不推进、不补算；意图汇总
   *     照常执行（表现层系统侧 EnterChart 不被吞掉）。
   */
  submitFrameIntents(
    intents: ReadonlyArray<PlayerIntent>,
    frameDurationSeconds: number,
  ): void {
    // —— 第 1 步：汇总并筛选有效意图 ——
    // 非 Jump 意图即时分发；本帧是否存在 Jump 只记录为布尔，
    // 起跳决策延后到第 2 / 4 步按落地状态执行（请求-消费模型：
    // 输入回调不读物理状态，物理判定只在帧更新内完成）。
    let frameHasJump = false;
    for (const intent of intents) {
      switch (intent.kind) {
        case 'SwitchPerceptionMode':
          // 切换运行时感知模式（不写账本，名库 v1.9）。
          this.setPerceptionMode(intent.mode);
          break;

        case 'Move':
          if (this.protagonist !== null && this.mapCenter !== null) {
            this.protagonist.move(
              { lateral: intent.lateral, depth: intent.depth },
              frameDurationSeconds,
              this.mapCenter,
            );
          }
          break;

        case 'Strike':
          // T7：谱面上下文且带 keyId → 按输入顺序即时提交首演
          // （与同帧 ToggleChartPause 保持先后顺序）。
          if (this.isChartContext() && intent.keyId !== undefined) {
            this.chartPremiere?.submitStrike({
              videoTimeMs: intent.videoTimeMs,
              keyId: intent.keyId,
            });
          } else {
            // T6（VERDICT-113 / 117）：解谜链第二步——世界节奏敲击。
            this.handleStrikeIntent();
          }
          break;

        case 'EnterChart':
          // T6（VERDICT-115）：谱面入口——仅链终点结算完成后
          // 接受（入口由深痕授予）；接受即同帧接入世界运动门控。
          this.handleEnterChartIntent();
          break;

        case 'ExitChart':
          // T7（AC-21）：退出不写账本，恢复世界运动、保留入口。
          this.handleExitChartIntent();
          break;

        case 'ToggleChartPause':
          // T7：ESC 按输入序列确定暂停边界（Playing/Paused 间即时切换）。
          this.chartPremiere?.togglePause(intent.videoTimeMs);
          break;

        case 'Jump':
          // 空中请求不缓存：本帧只标记有无有效请求；
          // 是否起跳由第 2 / 4 步的落地状态决定。
          frameHasJump = true;
          break;
      }
    }

    // —— 世界运动门控（VERDICT-111）：谱面入口调度后置位，
    //      自本帧起跳过第 2~6 步世界运动（不推进、不补算）；
    //      但 FrameDriver / 谱面 / 表现刷新继续——此帧驱动谱面。
    if (this.worldMotionGated) {
      this.driveChartPlayback();
      return;
    }

    if (this.protagonist === null) {
      return;
    }

    // —— 第 2 步：已落地（含紧贴地面容差）时处理本帧 Jump ——
    const groundedBeforeTick = this.protagonist.isGrounded();
    if (frameHasJump && groundedBeforeTick) {
      this.protagonist.jump();
    }

    // —— 第 3 步：推进一次垂直物理（每帧恰好一次；意图数组
    //      为空时同样推进，保证无输入也会落地） ——
    this.protagonist.tickVertical(frameDurationSeconds);
    const groundedAfterTick = this.protagonist.isGrounded();

    // —— 第 4 步：本次推进使主角落地，且本帧有 Jump：
    //      立即重新起跳（蜻蜓点水式连续跳跃），不再 tick ——
    if (frameHasJump && !groundedBeforeTick && groundedAfterTick) {
      this.protagonist.jump();
    }

    // —— 第 5 步：元素实体可见性检测（表现层读取前的最后逻辑）——
    this.updateElementVisibility();

    // —— 第 6 步（T6 追加，链序未冻结待 PROTOCOL）：解谜链
    //      推进与链终点结算（AC-12 / AC-13）——
    this.updatePuzzleChain();
  }

  getCurrentPerceptionMode(): PerceptionMode {
    return this.currentPerceptionMode;
  }

  getChartPlaybackState(): ChartPlaybackState {
    return this.chartPremiere !== null ? this.chartPremiere.getState() : 'Ready';
  }

  /**
   * 是否处于谱面输入上下文（T7 / INV-13）：首演 Playing/Paused。
   * 方法名为直译，待追认。
   */
  private isChartContext(): boolean {
    if (this.chartPremiere === null) {
      return false;
    }
    const state = this.chartPremiere.getState();
    return state === 'Playing' || state === 'Paused';
  }

  /**
   * 门控期间驱动谱面（T7；世界不推进、不补算）。
   *
   * 顺序：媒体实际开始 → begin；Playing 时按媒体时间 advance；
   * 进入 Completed 且尚未记账 → 恰好记录一条完成事件。
   * 方法名为直译，待追认。
   */
  private driveChartPlayback(): void {
    if (this.chartPremiere === null || this.chartClockProbe === null) {
      return;
    }
    const mediaTimeMs = this.chartClockProbe();
    if (this.chartPremiere.getState() === 'Ready' && mediaTimeMs >= 0) {
      this.chartPremiere.begin();
    }
    if (this.chartPremiere.getState() === 'Playing' && mediaTimeMs >= 0) {
      this.chartPremiere.advance(mediaTimeMs);
    }
    if (
      this.chartPremiere.getState() === 'Completed' &&
      !this.chartCompletionRecorded
    ) {
      this.recordChartCompletion(mediaTimeMs);
    }
  }

  /**
   * 记录谱面完成（AC-20）：director 恰好追加一条带 ChartRef 的
   * NarrativeEvent，与得分无关。方法名为直译，待追认。
   */
  private recordChartCompletion(finishedAtMs: number): void {
    this.chartCompletionRecorded = true;
    if (this.ledgerAppend !== null && this.chartPremiere !== null) {
      this.ledgerAppend.append(
        this.buildCompletionNarrativeEvent(finishedAtMs),
      );
    }
  }

  /**
   * 构造谱面完成 NarrativeEvent（灰盒占位）：
   * 20 维以零向量占位；ChartRef 携带首演 chartId；
   * 其余附加项与终点事件同口径。方法名为直译，待追认。
   */
  private buildCompletionNarrativeEvent(
    finishedAtMs: number,
  ): NarrativeEvent {
    const zeroVector: NarrativeVector = [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const eventId: NarrativeEventId = 'T7_COMPLETION_PLACEHOLDER';
    return {
      eventId,
      vector: zeroVector,
      VectorSchemaVersion,
      AppendedAt: { epochMs: Date.now() },
      InputSource: InputSource.Player,
      ChapterTag: {},
      ChartRef: {
        chartId:
          this.chartPremiere !== null ? this.chartPremiere.getChartId() : '',
      },
    };
  }

  /**
   * 解析当前 ChartRef（T7）：从绑定首演取 chartId；
   * 未绑定时以显式占位串返回并告警。方法名为直译，待追认。
   */
  private resolveChartRef(): ChartRef {
    if (this.chartPremiere !== null) {
      return { chartId: this.chartPremiere.getChartId() };
    }
    return { chartId: 'CHART_NOT_BOUND' };
  }

  /**
   * 处理退出谱面（T7 / AC-21）。
   *
   * 不写账本；首演进 Exited；恢复世界运动（worldMotionGated=false）、
   * 清入口调度（chartEntryScheduled=false）以便重入；
   * endpointSettled 保持，深痕入口与 T6 记录保留。
   * 表现层观察 Exited 后回收播放资源、还原世界。
   * 方法名为直译，待追认。
   */
  private handleExitChartIntent(): void {
    if (this.chartPremiere !== null) {
      const probeTime =
        this.chartClockProbe !== null ? this.chartClockProbe() : -1;
      this.chartPremiere.requestExit(probeTime >= 0 ? probeTime : 0);
    }
    this.worldMotionGated = false;
    this.chartEntryScheduled = false;
  }

  /**
   * 推进被跟踪元素实体的可见性（T5 / AC-11）。
   *
   * 阶段 1 占位口径（HANDOFF-ROUND-16 明示：具体距离或触发
   * 方式由实现方占位，阶段 4 由解谜链规则细化）：
   *   - 实体为 Concealed 且主角平面距离 <= TRIGGER_DISTANCE_WM：
   *     Trigger 转换（形态 → 明态）；
   *   - 实体为 Revealed 且主角平面距离 >= FORGET_DISTANCE_WM：
   *     Forget 转换（明态 → 形态，对应"移出屏幕后变回形态"）。
   *
   * 只做水平面（lateral / depth）距离判定，不使用 vertical
   * （实体阶段 1 位于地面）；平方比较，无开方 / 向量计算。
   * 仅被跟踪实体（初始 Concealed 者）参与，常驻 Revealed
   * 实体不受 Forget 影响。
   *
   * 方法名为直译，待 PROTOCOL 追认。
   */
  private updateElementVisibility(): void {
    if (this.protagonist === null) {
      return;
    }
    const protagonistPosition = this.protagonist.getPosition();
    const triggerDistanceSquared = TRIGGER_DISTANCE_WM * TRIGGER_DISTANCE_WM;
    const forgetDistanceSquared = FORGET_DISTANCE_WM * FORGET_DISTANCE_WM;

    for (const entity of this.visibilityTrackedEntities) {
      const entityPosition = entity.getPosition();
      const dx = entityPosition.lateral - protagonistPosition.lateral;
      const dz = entityPosition.depth - protagonistPosition.depth;
      const distanceSquared = dx * dx + dz * dz;
      const state = entity.getVisibilityState();

      if (
        state === VisibilityState.Concealed &&
        distanceSquared <= triggerDistanceSquared
      ) {
        // 触发条件满足：形态 → 明态（Trigger）。
        entity.applyVisibility({ reason: VisibilityTransitionReason.Trigger });
      } else if (
        state === VisibilityState.Revealed &&
        distanceSquared >= forgetDistanceSquared
      ) {
        // 远离 / 移出屏幕：明态 → 形态（Forget，暂忘）。
        entity.applyVisibility({ reason: VisibilityTransitionReason.Forget });
      }
    }
  }

  /**
   * 处理本帧 Strike 意图（T6 / VERDICT-117 解谜链第二步）。
   *
   * 经节奏敲击探针取得表现层记录的时间戳对（敲击时间戳 +
   * 目标节拍时间戳），交由 PuzzleChain.attemptStrike 判定
   * （绝对偏差 ≤ RHYTHM_STRIKE_WINDOW_MS，judgeRhythmStrike
   * 纯函数在链内执行）。命中 → 链推进至终点；未命中 → 保留
   * "待敲击"允许重试（均由链内部落地，director 不改进度）。
   *
   * 世界运动门控期间敲击不结算（谱面入口已调度，链已终点）。
   * 方法名为直译，待 PROTOCOL 追认。
   */
  private handleStrikeIntent(): void {
    if (this.worldMotionGated) {
      return;
    }
    if (this.puzzleChain === null || this.rhythmStrikeProbe === null) {
      return;
    }
    const strike = this.rhythmStrikeProbe();
    if (strike === null) {
      return;
    }
    this.puzzleChain.attemptStrike(strike);
  }

  /**
   * 处理本帧 EnterChart 意图（T6 / VERDICT-115 谱面入口）。
   *
   * 谱面入口由深痕授予：仅链终点结算完成后接受（防止未解谜
   * 直接进谱面）；接受即：
   *   1. chartEntryScheduled = true（表现层轮询后切换场景，
   *      阶段 1 切至空占位场景并标注"待 T7 填充"）；
   *   2. worldMotionGated = true（同帧接入 VERDICT-111 门控
   *      ——后续帧起 Move / Jump / tickVertical / 可见性 /
   *      解谜链均不再推进，无空档；本方法在意图汇总阶段
   *      执行，本帧剩余步骤同样被门控跳过）。
   *
   * 方法名为直译，待 PROTOCOL 追认。
   */
  private handleEnterChartIntent(): void {
    if (this.chartEntryScheduled) {
      return;
    }
    if (!this.endpointSettled) {
      return;
    }
    // T7 重入：首演已在 Exited/Completed 则先复位（谱面身份、
    // 布局与 T6 终点记录均保留，不重复写入 T6 链终点事件）。
    if (this.chartPremiere !== null) {
      const premiereState = this.chartPremiere.getState();
      if (premiereState === 'Exited' || premiereState === 'Completed') {
        this.chartPremiere.reopen();
        this.chartCompletionRecorded = false;
      }
    }
    this.chartEntryScheduled = true;
    this.worldMotionGated = true;
  }

  /**
   * 推进解谜链（T6 / AC-12 ~ AC-13；帧序第 6 步，链序未冻结
   * 待 PROTOCOL）。
   *
   * 链已到终点 → 执行链终点结算（恰好一条 NarrativeEvent）；
   * 链未到终点 → 每帧评估第一步条件：主角到深痕的平面距离
   * （本方法计算，平方和开根——同 calculateCenterDistance
   * 标量口径，非向量计算）+ 表现层探针提供的深痕屏幕投影，
   * 经 PuzzleChain.evaluateStepCondition 推进 / 退回
   * PuzzleProgress（进度只更新 PuzzleProgress，不写账本）。
   *
   * 方法名为直译，待 PROTOCOL 追认。
   */
  private updatePuzzleChain(): void {
    if (this.endpointSettled) {
      return;
    }
    if (this.puzzleChain === null || this.deepTrace === null) {
      return;
    }
    if (this.protagonist === null) {
      return;
    }

    const stage = this.puzzleChain.getProgress().getStage();
    if (stage === 'Completed') {
      this.settlePuzzleChainEndpoint();
      return;
    }

    // 主角到深痕的平面距离（横轴 + 纵深轴；不含 vertical，
    // 与 calculateCenterDistance 同口径）。
    const protagonistPosition = this.protagonist.getPosition();
    const tracePosition = this.deepTrace.getPosition();
    const deltaLateral = tracePosition.lateral - protagonistPosition.lateral;
    const deltaDepth = tracePosition.depth - protagonistPosition.depth;
    const distanceWm = Math.sqrt(
      deltaLateral * deltaLateral + deltaDepth * deltaDepth,
    );

    const projection =
      this.screenProjectionProbe !== null ? this.screenProjectionProbe() : null;
    this.puzzleChain.evaluateStepCondition(distanceWm, projection);

    // 逐帧检查持续期是否已满 7 秒（VERDICT-119 / VERDICT-120）。
    // VERDICT-120：拍点时钟消费处叠加 beatClockOffsetMs 校准偏移，
    // 使 Strike、目标拍点、持续期计时统一使用同一条音频时间线。
    if (this.beatClockProbe !== null) {
      const currentBeatTimeMs = this.beatClockProbe() + this.beatClockOffsetMs;
      if (currentBeatTimeMs >= 0) {
        this.puzzleChain.checkSustainedExpiry(currentBeatTimeMs);
      }
    }
  }

  /**
   * 链终点结算（T6 / AC-13 / AC-14；INV-2 / INV-11）。
   *
   * 恰好写入一条 NarrativeEvent（经 LedgerAppend，director
   * 是唯一可引用方 E5）+ 标记深痕已触发（表现层据此播放
   * DeepTraceRevealSequence）；endpointSettled 双重防重复
   * 结算（链 'Completed' 阶段判定 + 本布尔幂等闸）。
   *
   * 触发不修改 TraceTier / 解谜进度 / 世界运动门控（INV-11）
   * ——门控在 EnterChart 被接受时才接入（VERDICT-115）。
   * 方法名为直译，待 PROTOCOL 追认。
   */
  private settlePuzzleChainEndpoint(): void {
    if (this.endpointSettled) {
      return;
    }
    this.endpointSettled = true;
    if (this.deepTrace !== null) {
      this.deepTrace.markTriggered();
    }
    if (this.ledgerAppend !== null) {
      this.ledgerAppend.append(this.buildEndpointNarrativeEvent());
    }
  }

  /**
   * 构造链终点 NarrativeEvent（阶段 1 灰盒占位，偏差待裁定）：
   * 20 维向量以零向量占位（语义来源待冻结）；eventId 占位
   * 字符串；AppendedAt 取挂钟 Date.now()；InputSource.Player
   * 占位；ChapterTag 空对象（结构未冻结）；
   * ChartRef 携带目标谱面 chartId（T7 上提后的 constants 类型）。
   * 方法名为直译，待 PROTOCOL 追认。
   */
  private buildEndpointNarrativeEvent(): NarrativeEvent {
    const zeroVector: NarrativeVector = [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const eventId: NarrativeEventId = 'T6_ENDPOINT_PLACEHOLDER';
    return {
      eventId,
      vector: zeroVector,
      VectorSchemaVersion,
      AppendedAt: { epochMs: Date.now() },
      InputSource: InputSource.Player,
      ChapterTag: {},
      ChartRef: this.resolveChartRef(),
    };
  }
}
