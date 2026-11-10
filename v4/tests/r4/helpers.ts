import { ChartSnapshot } from '../../core/chart/judge';
import { BlindMode } from '../../core/chart/blind';
import { FullScreenJudgementLayer } from '../../core/chart/layer';
import type { ChartLayer } from '../../core/chart/layer';
import { GridNote, HoldGridLine } from '../../core/chart/note';
import { ChartPadKind } from '../../core/chart/types';
import type { GridCellId } from '../../core/chart/types';

export function layers(count = 3): readonly ChartLayer[] {
  const result: ChartLayer[] = [];
  for (let index = 1; index <= Math.max(1, count); index += 1) {
    if (index === 1) result.push({ index, kind: 'TopMost' });
    else if (index === 2) result.push({ index, kind: 'Grid' });
    else result.push({
      index,
      kind: 'FullScreen',
      fullScreenInput: FullScreenJudgementLayer.Pointer,
    });
  }
  return result;
}

export function note(input: {
  readonly noteIndex?: number;
  readonly timeMs?: number;
  readonly durationMs?: number;
  readonly chartLayerIndex?: number;
  readonly gridCellId?: GridCellId | null;
  readonly chartKeyId?: string | null;
  readonly chartPadKind?: ChartPadKind;
  readonly holdGridLines?: readonly HoldGridLine[];
} = {}): GridNote {
  const layer = input.chartLayerIndex ?? 2;
  const pad = input.chartPadKind
    ?? (layer === 1 ? ChartPadKind.TopMost : ChartPadKind.Light);
  return new GridNote({
    noteIndex: input.noteIndex ?? 0,
    timeMs: input.timeMs ?? 1000,
    durationMs: input.durationMs ?? 0,
    chartLayerIndex: layer,
    gridCellId: input.gridCellId ?? (layer === 2 ? 1 : null),
    chartKeyId: input.chartKeyId ?? null,
    chartPadKind: pad,
    holdGridLines: input.holdGridLines,
  });
}

export function snapshot(
  notes: readonly GridNote[],
  options: {
    readonly durationMs?: number;
    readonly layerCount?: number;
    readonly blindMode?: BlindMode;
  } = {},
): ChartSnapshot {
  return new ChartSnapshot({
    durationMs: options.durationMs ?? 10_000,
    layers: layers(options.layerCount ?? 3),
    notes,
    blindMode: options.blindMode,
  });
}

export function down(input: {
  readonly timeMs: number;
  readonly chartKeyId?: string;
  readonly gridCellId?: number;
  readonly source?: 'Keyboard' | 'Pointer';
}): {
  timeMs: number;
  chartKeyId?: string;
  gridCellId?: number;
  phase: 'Down';
  source: 'Keyboard' | 'Pointer';
} {
  return {
    timeMs: input.timeMs,
    ...(input.chartKeyId === undefined ? {} : { chartKeyId: input.chartKeyId }),
    ...(input.gridCellId === undefined ? {} : { gridCellId: input.gridCellId }),
    phase: 'Down',
    source: input.source ?? 'Keyboard',
  };
}

export function up(input: {
  readonly timeMs: number;
  readonly chartKeyId?: string;
  readonly gridCellId?: number;
}): {
  timeMs: number;
  chartKeyId?: string;
  gridCellId?: number;
  phase: 'Up';
  source: 'Keyboard';
} {
  return {
    timeMs: input.timeMs,
    ...(input.chartKeyId === undefined ? {} : { chartKeyId: input.chartKeyId }),
    ...(input.gridCellId === undefined ? {} : { gridCellId: input.gridCellId }),
    phase: 'Up',
    source: 'Keyboard',
  };
}
