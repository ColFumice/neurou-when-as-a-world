// ============================================================
// S5 叙事导演域 · PlayerIntent 玩家意图（名库 v2.0 冻结名）
//
// 依据：
// - 名库 v2.0：PlayerIntent（移动 / 敲击 / 切换感知模式 /
//   进入谱面 / 退出谱面 / 跳跃）、IntentPort，文件放 src/director/；
// - 名库 v0.5：PerceptionMode(Normal / Triggered / Rain)；
// - 名库 v2.0：Jump（第 6 种 PlayerIntent，无载荷）；
// - HANDOFF-ROUND-12：阶段 1 原 5 种意图；
// - HANDOFF-ROUND-15 / VERDICT-101：扩展第 6 种意图 Jump，
//   阶段 1 意图由五种扩展为六种；
//   调整视距不是意图，不进入 PlayerIntent。
// - HANDOFF-ROUND-18（T7）：
//     Strike 增加可选 keyId（谱面消费必需，世界敲击可省略）；
//     新增第 7 种意图 ToggleChartPause（携带 videoTimeMs）。
//
// 意图接口（I）铁律（stage-1.md §6）：
// presentation → director 仅允许 import type，值导入违规。
// 故本文件的判别量与感知模式一律采用字符串字面量类型
// （纯类型、零运行时导出）：表现层以对象字面量即可构造
// 意图，不需要任何值导入；判别成员名仍是各意图的冻结名。
// keyId 仅以 import type 引用 chart 类型，编译期擦除。
//
// 同文件占位：PerceptionMode 类型。感知模式由 director
// 保存为运行时状态、不写入账本（HANDOFF 特别提醒 /
// 名库 v1.8）；trace 以模式为判断参数、自身不保存模式。
// 是否拆分为独立文件待 PROTOCOL 指定。
// ============================================================

import type { ChartKeyId } from '../chart/KeyboardPadLayout';

/**
 * PerceptionMode 感知模式（名库 v0.5 冻结三值，字符串字面量联合）
 *
 * 阶段 1 仅使用 'Normal' / 'Triggered'（AC-10/11）；
 * 'Rain' 为名库逐字冻结值，随联合完整保留，阶段 1 不产生。
 */
export type PerceptionMode = 'Normal' | 'Triggered' | 'Rain';

/**
 * PlayerIntent 玩家意图（判别联合，纯类型）
 *
 * 只描述“玩家想做什么”：
 * - 调整视距（滚轮 / 捏合）不是意图，由 InputCollector
 *   直送 CameraRig，不出现在本联合中；
 * - 所有字段只读，本类型不携带任何写账本 / 写状态的能力。
 *
 * 六个判别值（'Move' / 'Strike' / 'SwitchPerceptionMode' /
 * 'EnterChart' / 'ExitChart' / 'Jump'）与载荷字段名
 * （lateral / depth / videoTimeMs / mode）均为 HANDOFF
 * 中文描述的直译结构名，待 PROTOCOL 追认。
 *
 * Jump（名库 v2.1 修订 / VERDICT-107）：第 6 种意图，无载荷。
 * InputCollector 每帧检测空格按住状态，按住时该帧提交一个
 * Jump（非按下边沿一次）；空中请求不缓存。起跳与否由
 * DirectorSession.submitFrameIntents 按 VERDICT-108 冻结顺序
 * 根据落地状态决定：落地帧若有有效请求则立即重新起跳
 * （蜻蜓点水式连续跳跃）；松开空格后落地不再起跳。
 * 谱面 / 转场期间世界运动暂停（门控点待 T6/T7 冻结）。
 */
export type PlayerIntent =
  | {
      /** 移动意图：两轴方向分量 */
      readonly kind: 'Move';
      /** 横轴方向分量，区间 [-1, 1] */
      readonly lateral: number;
      /** 纵深轴方向分量，区间 [-1, 1]；纵深幅度由角色域裁剪 */
      readonly depth: number;
    }
  | {
      /** 敲击意图：附带当前视频时间 */
      readonly kind: 'Strike';
      /** 当前视频时间（毫秒，媒体时间口径，非挂钟时间） */
      readonly videoTimeMs: number;
      /**
       * 槽位标识（HANDOFF-ROUND-18 新增，可选）。
       * 世界敲击省略；谱面消费时必需。
       */
      readonly keyId?: ChartKeyId;
    }
  | {
      /** 切换感知模式意图 */
      readonly kind: 'SwitchPerceptionMode';
      /** 目标感知模式 */
      readonly mode: PerceptionMode;
    }
  | {
      /** 进入谱面意图（谱面入口由深痕授予，意图本身不含载荷） */
      readonly kind: 'EnterChart';
    }
  | {
      /** 退出谱面意图（中途退出不写入账本，AC-21） */
      readonly kind: 'ExitChart';
    }
  | {
      /**
       * 跳跃意图（名库 v2.1 / VERDICT-107 修订；无载荷）。
       *
       * 空格按住期间每帧提交一个 Jump；空中请求不缓存；
       * 落地帧有有效请求则立即重新起跳（连续跳跃）；
       * 松开空格后落地不再起跳。
       * 谱面 / 转场期间世界运动暂停（门控待 T6/T7 冻结）。
       */
      readonly kind: 'Jump';
    }
  | {
      /**
       * 暂停切换意图（HANDOFF-ROUND-18 冻结，第 7 种意图）。
       *
       * ESC 在谱面 Playing / Paused 之间请求切换；
       * videoTimeMs 用于按输入序列确定暂停边界。
       * 暂停不写账本；暂停界面的继续 / 退出由 presentation 接线。
       */
      readonly kind: 'ToggleChartPause';
      /** 切换请求对应的视频 / 谱面时间（毫秒）。 */
      readonly videoTimeMs: number;
    };
