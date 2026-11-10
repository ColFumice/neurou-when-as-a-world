// ============================================================
// S8 表现层 · EmotionToTrailColor 接口
// 名库冻结名：EmotionToTrailColor、TrailColor、
//            EmotionWindowSum、EmotionWindow、
//            DivergenceAxis（冻结成员
//            Understanding / Empathy，其余四维待冻结）、
//            HairColor（ROUND-08 确认即“发色基准”；
//            ROUND-11：BaseHairColor = HairColor 等同关系
//            经 HANDOFF 正式追认冻结）
// 本文件仅定义类型骨架，不包含任何映射公式、计算或渲染逻辑
// ============================================================

import type { HairColor } from '../character/HairColor';

/**
 * TrailColor 痕迹颜色（RGB 结构）
 * 名库颜色体系冻结名；结构按 HANDOFF 指定为 RGB。
 *
 * 占位说明：TrailColor 暂随本文件同文件声明；
 * 是否拆分为独立文件待 PROTOCOL 指定。
 */
export interface TrailColor {
  /** 红色通道（RGB 结构，HANDOFF 指定） */
  r: number;

  /** 绿色通道（RGB 结构，HANDOFF 指定） */
  g: number;

  /** 蓝色通道（RGB 结构，HANDOFF 指定） */
  b: number;
}

/**
 * DivergenceAxis 分歧轴（6 大情感维度）
 * 名库路线体系冻结名：DivergenceAxis(6大情感维度)
 *
 * 按 PROTOCOL 方案 B 冻结两维成员：
 *   Understanding（理解）/ Empathy（共情）
 * 其余四维成员名仍待冻结，保持注释占位，未臆造。
 */
export interface DivergenceAxis {
  /** “理解”维度（冻结成员） */
  Understanding: number;

  /** “共情”维度（冻结成员） */
  Empathy: number;

  // 其余四个情感维度成员名待 PROTOCOL 冻结（继续空占位）
}

/**
 * EmotionWindowSum 感绪窗口求和
 * 名库感绪域冻结名（EmotionWindow / AppendedAt /
 * EmotionWindowSum）。
 *
 * 占位说明：具体结构名库未冻结，暂为空接口占位；
 * 是否拆分至感绪域独立文件待 PROTOCOL 指定。
 */
export interface EmotionWindowSum {
  // 结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * EmotionToTrailColor 感绪 → 痕迹颜色 映射接口
 *
 * 修订：输入为“感绪 + 发色基准”，输出为 TrailColor RGB。
 * ROUND-08 裁定：发色基准即外观域冻结类型 HairColor
 * （历史名 BaseHairColor 不再使用，阻塞解除）。
 * 仅描述输入 / 输出结构，不包含任何映射逻辑。
 */
export interface EmotionToTrailColor {
  /** 输入：感绪窗口求和 + 发色基准（冻结类型 HairColor） */
  input: {
    /** 感绪窗口求和，名库冻结类型 */
    emotionWindowSum: EmotionWindowSum;

    /**
     * 发色基准（ROUND-08 解冻：冻结类型 HairColor）
     *
     * 字段名 hairColor（冻结类型名的小驼峰派生）：
     * HANDOFF-ROUND-11 正式追认冻结。
     */
    hairColor: HairColor;
  };

  /** 输出：痕迹颜色 RGB 结构，类型为 TrailColor */
  output: TrailColor;
}
