/**
 * E · editor / types
 * 编辑模式与 AI 关键帧生成的占位契约。
 * 不 import React / Tauri / fs；E 层只依赖 K 的值导入。
 */

/**
 * 谱面编辑模式。
 * - Notes：按音符/节奏点查看与编辑；
 * - Keyframes：时间轴关键帧编辑；
 * - Logo：预览区选位与动效；
 * - Layers：图层/轨道视图。
 */
export type ChartEditMode = 'Notes' | 'Keyframes' | 'Logo' | 'Layers';

/**
 * AI 关键帧生成状态。
 * R3.5b 只显示 Unavailable；R4e.1b 起可进入 Running / Ready / Fallback。
 * proposals 只是预览，不自动写入轨道。
 */
export type AIKeyframeGeneration = {
  readonly status: 'Unavailable' | 'Running' | 'Ready' | 'Fallback';
  readonly reason?: string;
  readonly provider?: string;
  readonly fallbackUsed?: boolean;
  readonly proposals?: readonly {
    readonly timeMs: number;
    readonly durationMs: number;
    readonly chartLayerIndex: number;
    readonly gridCellId: number | null;
    readonly chartPadKind: 'Light' | 'Heavy' | 'TopMost';
    readonly chartKeyId: string | null;
  }[];
};
