// ============================================================
// C 谱面域 · ChartPlaybackState 谱面播放状态（名库 v2.5）
//
// 依据：
// - HANDOFF-ROUND-18 冻结：
//     ChartPlaybackState = Ready / Playing / Paused / Completed / Exited；
//     ToggleChartPause 携带 videoTimeMs。
//
// 职责：只声明状态与暂停切换载荷；状态迁移规则在 ChartPremiere。
// 禁止：零 cc 依赖。
// ============================================================

/**
 * ChartPlaybackState 谱面播放状态（HANDOFF-ROUND-18 冻结）。
 */
export type ChartPlaybackState =
  | 'Ready'
  | 'Playing'
  | 'Paused'
  | 'Completed'
  | 'Exited';

/**
 * ToggleChartPause 暂停切换载荷（HANDOFF-ROUND-18 冻结）。
 *
 * ESC 在 Playing / Paused 之间请求切换；videoTimeMs 用于
 * 按输入序列确定暂停边界。
 */
export interface ToggleChartPause {
  /** 切换请求对应的视频 / 谱面时间码（毫秒）。 */
  readonly videoTimeMs: number;
}
