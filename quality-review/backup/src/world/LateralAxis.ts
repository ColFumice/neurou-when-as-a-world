﻿// ============================================================
// S2 地图域 · LateralAxis 横轴坐标（名库 v0.3 空间域冻结名）
// 依据：stage-1.md §3（坐标轴）、AC-01（沿横轴移动）
//
// 职责：声明横轴坐标的单位类型；纯类型，不含逻辑。
// ============================================================

import type { WorldMeter } from './WorldMeter';

/**
 * LateralAxis 横轴
 * 主角横向移动所在轴；坐标值以 MapCenter 为原点，
 * 单位 WorldMeter（INV-9）。
 */
export type LateralAxis = WorldMeter;
