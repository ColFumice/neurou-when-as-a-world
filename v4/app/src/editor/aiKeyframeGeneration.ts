import type { AIKeyframeGeneration } from '../../../core/editor/types';
import type { AITaskResult } from '../../../core/ai/types';
import type { EditorWorldFile } from '../../../core/editor/EditorWorldFile';
import type { ChartKeyframe } from '../../../core/editor/keyframe';

export interface AIKeyframeProposal {
  readonly timeMs: number;
  readonly durationMs: number;
  readonly chartLayerIndex: number;
  readonly gridCellId: number | null;
  readonly chartPadKind: 'Light' | 'Heavy' | 'TopMost';
  readonly chartKeyId: string | null;
}

interface V2NoteLike {
  readonly timeMs: number;
  readonly durationMs?: number;
  readonly chartLayerIndex: number;
  readonly gridCellId?: number;
  readonly chartKeyId?: string;
  readonly chartPadKind?: 'Light' | 'Heavy' | 'TopMost';
}

const MAX_PROPOSALS = 64;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function integer(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= min
    && value <= max
    ? value
    : null;
}

function validPad(value: unknown): value is 'Light' | 'Heavy' | 'TopMost' {
  return value === 'Light' || value === 'Heavy' || value === 'TopMost';
}

function parseProposal(raw: unknown): AIKeyframeProposal | null {
  const value = record(raw);
  if (!value) return null;
  const timeMs = integer(value.timeMs, 0, Number.MAX_SAFE_INTEGER);
  const durationMs = integer(value.durationMs ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const chartLayerIndex = integer(value.chartLayerIndex, 1, 32);
  if (timeMs === null || durationMs === null || chartLayerIndex === null) return null;
  const gridCellId = value.gridCellId === undefined || value.gridCellId === null
    ? null
    : integer(value.gridCellId, 1, 8);
  const chartPadKind = value.chartPadKind;
  if (!validPad(chartPadKind)) return null;
  if (chartLayerIndex === 1 && (gridCellId !== null || chartPadKind !== 'TopMost')) return null;
  if (chartLayerIndex === 2 && (gridCellId === null || (chartPadKind !== 'Light' && chartPadKind !== 'Heavy'))) {
    return null;
  }
  if (chartLayerIndex >= 3 && (gridCellId !== null || chartPadKind !== 'Light')) return null;
  const chartKeyId = value.chartKeyId;
  if (chartKeyId !== undefined && chartKeyId !== null && typeof chartKeyId !== 'string') return null;
  return {
    timeMs,
    durationMs,
    chartLayerIndex,
    gridCellId,
    chartPadKind,
    chartKeyId: typeof chartKeyId === 'string' ? chartKeyId : null,
  };
}

/** 解析 provider 的 JSON 文本；不接受 Template 的模板文本。 */
export function parseAIKeyframeProposals(content: string): readonly AIKeyframeProposal[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return [];
  }
  const data = record(parsed);
  const raw = data?.keyframes;
  if (!Array.isArray(raw)) return [];
  const proposals: AIKeyframeProposal[] = [];
  for (const item of raw.slice(0, MAX_PROPOSALS)) {
    const proposal = parseProposal(item);
    if (proposal) proposals.push(proposal);
  }
  return proposals;
}

/** Template 兜底：从现有 v2 notes 取确定性的候选，不修改轨道。 */
export function templateKeyframeProposals(
  notes: readonly V2NoteLike[],
): readonly AIKeyframeProposal[] {
  return notes.slice(0, MAX_PROPOSALS).map((note) => {
    const chartLayerIndex = note.chartLayerIndex;
    const defaultPad: 'Light' | 'Heavy' | 'TopMost' = chartLayerIndex === 1
      ? 'TopMost'
      : chartLayerIndex === 2
        ? 'Light'
        : 'Light';
    return {
      timeMs: note.timeMs,
      durationMs: note.durationMs ?? 0,
      chartLayerIndex,
      gridCellId: chartLayerIndex === 2 ? note.gridCellId ?? 1 : null,
      chartPadKind: note.chartPadKind ?? defaultPad,
      chartKeyId: note.chartKeyId ?? null,
    };
  });
}

/** 确认后一次 batch 提交；整批只产生一条 Undo。 */
export function applyAIKeyframeProposals(
  file: EditorWorldFile,
  proposals: readonly AIKeyframeProposal[],
): readonly ChartKeyframe[] {
  return file.addKeyframes(proposals);
}

export function generationStatus(
  result: AITaskResult,
  proposals: readonly AIKeyframeProposal[],
): AIKeyframeGeneration {
  const fallback = result.fallbackUsed || result.provider === 'Template';
  return {
    status: fallback ? 'Fallback' : 'Ready',
    reason: result.reason ?? undefined,
    provider: result.provider,
    fallbackUsed: result.fallbackUsed,
    proposals,
  };
}
