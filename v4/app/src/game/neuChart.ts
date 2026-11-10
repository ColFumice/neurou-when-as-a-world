import type { EditorWorldFile } from '../../../core/editor/EditorWorldFile';
import type {
  EditorBinding,
  EditorEffectInterface,
  NeuModule,
} from '../../../core/editor/runtime/types';

/** 游戏运行时需要的 NEU 蓝图切片；纯数据，不依赖 Tauri / React。 */
export interface GameNeuChartData {
  readonly neuModules: readonly NeuModule[];
  readonly neuEffects: readonly EditorEffectInterface[];
  readonly neuBindings: readonly EditorBinding[];
  readonly editorSeed: number;
}

export const NO_NEU_GRAPH_WARNING = '无 NEU 图';

export const EMPTY_GAME_NEU_CHART: GameNeuChartData = Object.freeze({
  neuModules: Object.freeze([]) as readonly NeuModule[],
  neuEffects: Object.freeze([]) as readonly EditorEffectInterface[],
  neuBindings: Object.freeze([]) as readonly EditorBinding[],
  editorSeed: 0,
});

/**
 * chartLoader 的 NEU 扩展点：只搬运 editor.json 已校验过的四组数据。
 * Live 模式下 editorSeed 仅作遥测，不参与随机。
 */
export function neuChartFromEditor(editor: EditorWorldFile | null): GameNeuChartData {
  if (!editor) return EMPTY_GAME_NEU_CHART;
  return {
    neuModules: editor.neuModules,
    neuEffects: editor.effects,
    neuBindings: editor.bindings,
    editorSeed: editor.seed,
  };
}

/** editor.json 缺失/解析失败/无模块时给 HUD 的提示。 */
export function neuChartHudWarning(data: GameNeuChartData): string | null {
  return data.neuModules.length === 0 ? NO_NEU_GRAPH_WARNING : null;
}
