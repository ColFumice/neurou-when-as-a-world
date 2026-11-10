﻿// ============================================================
// S2 地图域 · WorldMeter 距离单位（名库 v0.3 空间域冻结名）
// 依据：stage-1.md §5 INV-9（全游戏只有一种距离单位
//       WorldMeter）、§7 常量表单位列、VERDICT-088 命名后缀
//
// 职责：只声明唯一距离单位；逻辑层一切距离 / 长度 / 速度
//       分量均以 WorldMeter（或 WorldMeter/秒）表达，
//       禁止引入第二种距离单位。
// 本文件为纯类型别名，不含逻辑，且不得引用 cc。
// ============================================================

/**
 * WorldMeter 世界米
 * 全游戏唯一距离单位（INV-9）：
 * - ScaleRef（角色身高）= 1.6 WorldMeter；
 * - 移动速度单位为 WorldMeter/秒；
 * - CenterDistance、LateralAxis、DepthAxis 均以本单位计。
 */
export type WorldMeter = number;
