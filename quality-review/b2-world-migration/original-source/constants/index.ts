﻿﻿// ============================================================
// 常量集中管理（HANDOFF-ROUND-09 后）
//
// 规则：
// 1. 业务逻辑中禁止硬编码数值，一律引用本文件导出；
// 2. 仅写入 HANDOFF / 名库明示或 PROTOCOL 追认的数值；
// 3. 时间单位按常量后缀区分：SECONDS 秒 / HOURS 小时；
// 4. 比例（RATIO）为占总时长的比值，无量纲。
// ============================================================

// ------------------------------------------------------------
// 板块一：静止 / 接管时间阈值（秒）
// ------------------------------------------------------------

/**
 * 静止阈值：冻结名 IdleThreshold（入口域）。
 * ROUND-08 正式定名常量 IDLE_THRESHOLD_SECONDS，取值 20；
 * 到达该阈值触发 StarPoint 掉落。
 */
export const IDLE_THRESHOLD_SECONDS = 20;

/**
 * AI 接管阈值（冻结类型名：AutopilotThreshold）。
 * HANDOFF-ROUND-06 明示为 30 秒。
 * PROTOCOL 验收轮第二部分第 5 条裁定：AutopilotThreshold
 * 随 src/service 归档后，ConstellationGate 不再经依赖注入
 * 间接使用，而是直接读本常量与静止时长比较（30 秒线）。
 */
export const AUTOPILOT_THRESHOLD_SECONDS = 30;

// ------------------------------------------------------------
// 板块二：离线宽限（小时）
// ------------------------------------------------------------

/**
 * 离线宽限时长：ROUND-08 正式定名常量 OFFLINE_GRACE_HOURS，
 * 取值 1（名库服务域 OfflineGrace 备注“1小时”；
 * VERDICT-020：离线有效期由 OfflineGrace 确定）。
 * 单位为小时；OfflineGrace 实现落地时由消费方换算。
 * ROUND-09：RealityPause 时长不得短于该值（名库 v1.1 规则）；
 * ROUND-11：OFFLINE_GRACE_HOURS 常量经 HANDOFF 追认冻结。
 */
export const OFFLINE_GRACE_HOURS = 1;

// ------------------------------------------------------------
// 板块三：共情增幅窗口（秒）与上限
// ------------------------------------------------------------

/**
 * 增幅统计窗口：冻结名 ScalingWindow，HANDOFF 明示
 * “近 1 小时”。60 * 60 为时→秒单位换算，非数值平衡决策。
 */
export const SCALING_WINDOW_SECONDS = 60 * 60;

/**
 * 共情增幅上限：常量名已追认。
 *
 * ROUND-11 裁定：取值 0 为暂定安全值（增幅量裁剪为 0，
 * 基础值保持不变，满足“只增不减”且不产生未经平衡的增益）；
 * 该值属数值平衡事项，待阶段 8 调整时仅在本文件更新。
 */
export const EMPATHY_SCALING_CAP = 0;

// ------------------------------------------------------------
// 板块四：截图后处理参数（MomentCapture 占位）
//
// 三个常量名已经 PROTOCOL 追认；ROUND-11 确认 0 / 1 / 1
// 为占位安全值（数学恒等，允许画面零改变），非渲染实现：
//   sigma=0 不模糊 / gain=1 亮度不变 / ratio=1 不降分辨率
// MomentCapture 内不写图形渲染代码。
// ------------------------------------------------------------

/** 高斯模糊强度（追认；0 = 无模糊的恒等安全值） */
export const GAUSSIAN_BLUR_SIGMA = 0;

/** 亮度增益倍数（追认；1 = 亮度不变的恒等安全值） */
export const BRIGHTNESS_GAIN = 1;

/** 降分辨率比例（追认；1 = 原分辨率的恒等安全值） */
export const DOWNSCALE_RATIO = 1;

// ------------------------------------------------------------
// 板块五：终末回映（EndingMemoryPlayback / EndingWindow）
// HANDOFF-ROUND-09 明示数值；名库硬约束：
// MixedVideoDurationCap 与 GlitchGapDurationCap 的
// 比例之和必须小于 1（0.3 + 0.1 = 0.4，满足）。
// ------------------------------------------------------------

/**
 * 回映时间窗口：冻结名 EndingWindow，HANDOFF 明示“1小时”。
 * 常量名为冻结名 + 已追认 SECONDS 后缀；60 * 60 为单位换算。
 */
export const ENDING_WINDOW_SECONDS = 60 * 60;

/** 回映总时长下限（秒）：冻结名 EndingMemoryDuration 区间下界 */
export const ENDING_MEMORY_MIN_SECONDS = 60;

/** 回映总时长上限（秒）：冻结名 EndingMemoryDuration 区间上界 */
export const ENDING_MEMORY_MAX_SECONDS = 300;

/**
 * 入场视频时长（秒）：HANDOFF-ROUND-09 常量清单明示。
 * 消费点（入场片段逻辑）本轮未授权，本常量先行落盘待用，
 * 禁止在未授权逻辑中引用。
 */
export const ENTRY_VIDEO_SECONDS = 10;

/**
 * 混剪分配上限比例：对应冻结名 MixedVideoDurationCap，
 * 占回映总时长的比值；与 GLITCH_GAP_CAP_RATIO 之和必须 < 1。
 */
export const MIXED_VIDEO_CAP_RATIO = 0.3;

/**
 * 缺口分配上限比例：对应冻结名 GlitchGapDurationCap，
 * 占回映总时长的比值；与 MIXED_VIDEO_CAP_RATIO 之和必须 < 1。
 */
export const GLITCH_GAP_CAP_RATIO = 0.1;

// ------------------------------------------------------------
// 板块六：阶段 1 账本词汇（名库 v1.6 / stage-1.md §9，T4）
//
// 本板块只放共享词汇（枚举、ID 类型、常量定义），
// 不含任何逻辑（stage-1.md §3：constants 是叶子模块）。
// ------------------------------------------------------------

/**
 * NarrativeDimension 20 维叙事向量枚举
 *
 * 名库 v1.6 + stage-1.md §9 冻结：顺序为冻结顺序（情感在前，
 * 第 17 维为 TruthLevel），与 §9 表格逐字一致：
 *   情感  Red / Green / Blue / Black / White / Grey
 *   元素  Initial / Process / Trace / Highlight / Commented / Residue
 *   关系  Trust / Closeness / Understanding / Conflict
 *   真相  TruthLevel
 *   时间  NarrativeTime
 *   空间  InfluenceRadius
 *   共情  PlayerEmpathy
 *
 * 每一维取值均为非负实数；代码中对 20 维的访问一律通过
 * NarrativeDimension 枚举名，禁止数字下标。
 */
export enum NarrativeDimension {
  Red,
  Green,
  Blue,
  Black,
  White,
  Grey,
  Initial,
  Process,
  Trace,
  Highlight,
  Commented,
  Residue,
  Trust,
  Closeness,
  Understanding,
  Conflict,
  TruthLevel,
  NarrativeTime,
  InfluenceRadius,
  PlayerEmpathy,
}

/**
 * 向量存储格式版本（名库 v1.6 冻结：20 维有序数组附带
 * VectorSchemaVersion = 1）。
 */
export const VectorSchemaVersion = 1;

/**
 * TraceId 痕的 ID 类型
 *
 * VERDICT-086 返工裁定：账本只引用 ID，禁止 ledger → trace，
 * 痕的 ID 类型在 constants 定义。
 * 底层承载暂以 string 占位；ID 结构（生成规则 / 前缀 / 序号）
 * 名库尚未冻结，待 PROTOCOL 裁定。
 * 名称已经 PROTOCOL 验收轮第一部分第 1 条正式追认。
 */
export type TraceId = string;

/**
 * NarrativeEventId 叙事事件 ID 类型
 *
 * T4 读取接口要求“按 ID 查询”，账本需要事件自身的 ID 类型；
 * ledger 依矩阵只能依赖 constants，故在本叶子模块定义。
 * 底层承载暂以 string 占位，结构待 PROTOCOL 冻结；
 * 名称已经 PROTOCOL 验收轮第一部分第 2 条正式追认。
 */
export type NarrativeEventId = string;

// ------------------------------------------------------------
// 板块七：阶段 1 技术常量（名库 v1.8 / stage-1.md §7，T2）
//
// 命名规则（VERDICT-088）：距离类后缀 WM（WorldMeter），
// 速度类后缀 WM_PER_SECONDS，毫秒类后缀 MS。
// 仅登记 HANDOFF-ROUND-12 明示的六个常量；视觉参数
// （ViewDistance、拖尾长度上限、转场时长）属 presentation
// 配置，不在本文件登记。
// ------------------------------------------------------------

/**
 * ScaleRef 尺度锚点（角色身高）：1.6 WorldMeter，
 * 全游戏唯一尺度锚点（stage-1.md §7；AC-06）。
 */
export const SCALE_REF_WM = 1.6;

/**
 * 主角最大移动速度（WorldMeter/秒，占位值）。
 * 实际 MoveSpeed 不得超过该上限；占位平衡值，
 * 后续数值平衡仅在本文件更新。
 */
export const MAX_MOVE_SPEED_WM_PER_SECONDS = 5;

/**
 * 纵深可移动范围（WorldMeter，占位值）：
 * 主角沿 DepthAxis 的可移动跨度，远小于地图横向（AC-01）。
 */
export const DEPTH_RANGE_WM = 5;

/**
 * Perfect 判定窗口（毫秒）：用户确认放宽，修订 VERDICT-123 第 5 条。
 * 必须严格小于 GOOD_WINDOW_MS（100 < 200 ✓）；窗口含端点。
 */
export const PERFECT_WINDOW_MS = 100;

/**
 * Good 判定窗口（毫秒）：用户确认放宽，修订 VERDICT-123 第 5 条。
 * 必须严格大于 PERFECT_WINDOW_MS；超出 Good 窗口即为 Miss。
 */
export const GOOD_WINDOW_MS = 200;

/** Head 独立启动窗口，含两个端点。本值于 PROTOCOL 裁定批次正式确认为 1000ms；名库和 stage-1 已同步修正。 */
export const HEAD_WINDOW_MS = 1000;

/**
 * 音画同步容差（毫秒）：T0 技术验证合格线口径。
 * 名库 v1.8 硬约束：SYNC_TOLERANCE_MS 必须严格小于
 * PERFECT_WINDOW_MS（30 < 100 ✓）。原 T0 实测偏差
 * 16.87ms / 16.53ms，在该容差内。
 */
export const SYNC_TOLERANCE_MS = 30;

// ------------------------------------------------------------
// 板块八：跳跃物理参数（名库 v2.0 / VERDICT-103，T2 跳跃 / AC-30）
//
// HANDOFF-ROUND-15 / VERDICT-103 明示两个常量放入本文件。
// 最大高度和滞空时间由上述参数派生，不另设独立常量：
//   最大高度 = 8² / (2×20) = 1.6 WM
//   滞空时间 = 2×8 / 20   = 0.8 秒
// ------------------------------------------------------------

/**
 * 跳跃初始垂直速度（WorldMeter/秒，名库 v2.0 / VERDICT-103）。
 *
 * 主角在地面按下空格起跳时，verticalSpeed 被设为本值；
 * 之后每帧按 GRAVITY_WM_PER_SECONDS_SQUARED 衰减。
 * 占位取值 8，待数值平衡阶段在本文件更新。
 */
export const JUMP_INITIAL_SPEED_WM_PER_SECONDS = 8;

/**
 * 重力加速度（WorldMeter/秒²，名库 v2.0 / VERDICT-103）。
 *
 * 每帧 verticalSpeed -= 本值 × deltaTime；vertical += verticalSpeed × deltaTime。
 * 落地（vertical <= 0）时 vertical 与 verticalSpeed 同时归零。
 * 占位取值 20，待数值平衡阶段在本文件更新。
 */
export const GRAVITY_WM_PER_SECONDS_SQUARED = 20;

// ------------------------------------------------------------
// 板块九：节奏敲击（名库 v2.3 / VERDICT-113，T6）
// ------------------------------------------------------------

/**
 * 节奏敲击判定窗口（毫秒）：名库 v2.3 冻结名 RHYTHM_STRIKE_WINDOW_MS，
 * 本轮用户确认取值 100，修订 VERDICT-113 第 2 条（原值 50）。
 * 敲击时间戳与目标节拍时间戳的绝对偏差
 * 小于等于本值时判为命中（RhythmStrike 判定口径）。
 */
export const RHYTHM_STRIKE_WINDOW_MS = 100;

// ------------------------------------------------------------
// 板块十：T7 视频谱面共享类型（HANDOFF-ROUND-18 冻结契约）
//
// 名库 v2.5：ChartTier / ChartRef 为跨模块共享名；
// HANDOFF-ROUND-18 裁定 ChartRef 上提到 constants，
// 其共享身份成员为 chartId。本板块只放共享类型，
// 不放算法或媒体资源（constants 是叶子模块）。
// ------------------------------------------------------------

/**
 * ChartRef 谱面引用（HANDOFF-ROUND-18 冻结）。
 *
 * 由 constants 统一共享：账本 NarrativeEvent.ChartRef 与
 * 谱面完成结算均引用本类型；身份成员 chartId 唯一标识谱面。
 */
export interface ChartRef {
  /** 谱面唯一标识（ChartRef 共享身份成员；承载规则名库尚未冻结）。 */
  readonly chartId: string;
  /** VERDICT-236: new entries explicitly distinguish an invitation from a completed premiere. */
  readonly state?: 'Entry' | 'PremiereCompleted';
}

/**
 * ChartTier 谱面档位（名库 v2.5 冻结）：
 * Regular / Character / World / Final；
 * 阶段 1 仅使用 Regular。
 */
export type ChartTier = 'Regular' | 'Character' | 'World' | 'Final';

/**
 * ChartBaseScore 谱面命中基础分（HANDOFF-ROUND-18 占位值 = 100）。
 * 占位平衡值；EXECUTOR 不决定平衡，后续仅在本文件更新。
 */
export const CHART_BASE_SCORE = 100;

/**
 * ChartTransparencyBonusMax 透明度加成上限（HANDOFF-ROUND-18 占位值 = 100）。
 * 0% 透明 → 0 加成，100% 透明 → 最多 100 加成（线性）。
 * 占位平衡值；后续仅在本文件更新。
 */
export const CHART_TRANSPARENCY_BONUS_MAX = 100;
