import { EditorWorldFile } from '@core/editor/EditorWorldFile';
import { ChartKeyframe } from '@core/editor/keyframe';
import type { ChartKeyframe as ChartKeyframeType } from '@core/editor/keyframe';
import { DEMO_PROJECT_ROOT } from '../game/projectRoot';

export const DEFAULT_EDITOR_PROJECT_ROOT = DEMO_PROJECT_ROOT;

/** R5c-A.0：默认恢复用户 head-logo；DSH mark 仅通过 VITE_NEUROU_LOGO_PATH 显式启用。 */
const ENV_LOGO = import.meta.env?.VITE_NEUROU_LOGO_PATH;

export const GAME_LOGO_PATH =
  typeof ENV_LOGO === 'string' && ENV_LOGO.trim().length > 0
    ? ENV_LOGO.trim()
    : 'D:\\Project\\A_New_Begin\\Neurou_official\\assets\\resources\\guidance\\head-logo.png';

export const FRAME_DURATION_MS = 1000 / 24;

export function editorChartId(worldId: string): string {
  return `chart-${worldId}`;
}

export function editorDocumentId(worldId: string): string {
  return `editor-${worldId}`;
}

export function editorRelPath(worldId: string): string {
  return `charts/${editorChartId(worldId)}.editor.json`;
}

export function makeLogo(
  keyframeId: string,
  x: number,
  y: number,
  size = 0.18,
): NonNullable<ChartKeyframeType['logo']> {
  return {
    logoId: `${keyframeId}-logo`,
    assetId: 'builtin:head-logo',
    x,
    y,
    size,
    stretch: 1,
    appearEffect: 'FadeDown',
    disappearEffect: 'FadeUp',
    easing: 'EaseInOut',
  };
}

export function ensureLogo(
  keyframe: ChartKeyframeType,
): NonNullable<ChartKeyframeType['logo']> {
  return keyframe.logo ?? makeLogo(keyframe.keyframeId, 0.5, 0.52);
}

export function allKeyframes(file: EditorWorldFile): readonly ChartKeyframeType[] {
  return file.tracks
    .flatMap((track) => track.keyframes)
    .slice()
    .sort(ChartKeyframe.compare);
}

export function selectedKeyframe(file: EditorWorldFile): ChartKeyframeType | null {
  const selected = file.selection.selectedKeyframeId;
  return selected ? file.getKeyframe(selected)?.keyframe ?? null : null;
}

export function nearestKeyframe(
  keyframes: readonly ChartKeyframeType[],
  timeMs: number,
): ChartKeyframeType | null {
  let best: ChartKeyframeType | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const keyframe of keyframes) {
    const next = Math.abs(keyframe.timeMs - timeMs);
    if (next < distance) {
      distance = next;
      best = keyframe;
    }
  }
  return best;
}

/** 新建一个可编辑的 fixture 文档；真实项目可 save/load 覆盖。 */
export function createEditorFixture(worldId: string): EditorWorldFile {
  const file = EditorWorldFile.create({
    documentId: editorDocumentId(worldId),
    chartId: editorChartId(worldId),
    durationMs: 8_000,
    stageWidth: 1280,
    stageHeight: 720,
    seed: 20261023,
  });

  const a = file.addKeyframe(
    { timeMs: 0, durationMs: 240, chartLayerIndex: 1, parallaxFactor: 0.4 },
    { snap: false },
  );
  const b = file.addKeyframe(
    { timeMs: 1_600, durationMs: 0, chartLayerIndex: 2, gridCellId: 2, parallaxFactor: -0.8 },
    { snap: false },
  );
  const c = file.addKeyframe(
    { timeMs: 3_200, durationMs: 360, chartLayerIndex: 1, parallaxFactor: 1.6 },
    { snap: false },
  );
  const d = file.addKeyframe(
    { timeMs: 4_400, durationMs: 0, chartLayerIndex: 3, parallaxFactor: -1.4 },
    { snap: false },
  );
  const e = file.addKeyframe(
    { timeMs: 5_800, durationMs: 300, chartLayerIndex: 2, gridCellId: 5, parallaxFactor: 0.9 },
    { snap: false },
  );
  const f = file.addKeyframe(
    { timeMs: 7_200, durationMs: 0, chartLayerIndex: 1, parallaxFactor: 0.2 },
    { snap: false },
  );

  file.setLogo(a.keyframeId, makeLogo(a.keyframeId, 0.28, 0.56, 0.2));
  file.setLogo(c.keyframeId, makeLogo(c.keyframeId, 0.56, 0.42, 0.24));
  file.setLogo(f.keyframeId, makeLogo(f.keyframeId, 0.74, 0.58, 0.17));
  for (const key of [b, d, e]) {
    file.updateKeyframe(key.keyframeId, { logo: null });
  }
  file.clearSelection();
  return file;
}
