/**
 * R5c-B · Cutscene schema v1 parser。
 *
 * 纯 TS；不读文件、不依赖 Tauri。B4 loader 负责读 cutscenes/<id>.json，
 * 失败只回 HUD warning，不阻断 Explore。
 */

export const CUTSCENE_SCHEMA_VERSION = 1;

export type CutsceneEndAction = 'ReturnToExplore';

export interface CutsceneAssetRef {
  readonly assetId?: string;
  readonly relPath?: string;
}

export interface CutsceneSubtitle {
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
}

export interface CutsceneDefinition {
  readonly schemaVersion: 1;
  readonly cutsceneId: string;
  readonly durationMs: number;
  readonly video: CutsceneAssetRef | null;
  readonly audio: CutsceneAssetRef | null;
  readonly subtitles: readonly CutsceneSubtitle[];
  readonly skippable: boolean;
  readonly skipAfterMs: number;
  readonly endAction: CutsceneEndAction;
}

export class CutsceneParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CutsceneParseError';
  }
}

function fail(message: string): never {
  throw new CutsceneParseError(message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${label}.${key} is not allowed`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function integer(value: unknown, label: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    fail(`${label} must be an integer >= ${min}`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`);
  return value;
}

function assetRef(raw: unknown, label: string): CutsceneAssetRef | null {
  if (raw === undefined || raw === null) return null;
  const value = record(raw, label);
  exactKeys(value, ['assetId', 'relPath'], label);
  const assetId = value.assetId === undefined ? null : text(value.assetId, `${label}.assetId`);
  const relPath = value.relPath === undefined ? null : text(value.relPath, `${label}.relPath`);
  if ((assetId === null) === (relPath === null)) {
    fail(`${label} must have exactly one of assetId/relPath`);
  }
  if (relPath !== null) {
    const normalized = relPath.replace(/\\/g, '/');
    if (normalized.startsWith('/')
      || normalized.split('/').some((part) => part === '..' || part === '')
      || !(normalized.startsWith('media/') || normalized.startsWith('assets/'))) {
      fail(`${label}.relPath must be a project-relative media/assets path`);
    }
    return { relPath: normalized };
  }
  return { assetId: assetId as string };
}

function subtitle(raw: unknown, index: number): CutsceneSubtitle {
  const value = record(raw, `subtitles[${index}]`);
  exactKeys(value, ['startMs', 'endMs', 'text'], `subtitles[${index}]`);
  const startMs = integer(value.startMs, `subtitles[${index}].startMs`);
  const endMs = integer(value.endMs, `subtitles[${index}].endMs`);
  const label = text(value.text, `subtitles[${index}].text`);
  if (endMs <= startMs) fail(`subtitles[${index}] endMs must be > startMs`);
  return { startMs, endMs, text: label };
}

export function parseCutscene(
  raw: unknown,
  expectedId?: string,
): CutsceneDefinition {
  const value = record(raw, 'cutscene');
  exactKeys(
    value,
    [
      'schemaVersion',
      'cutsceneId',
      'durationMs',
      'video',
      'audio',
      'subtitles',
      'skippable',
      'skipAfterMs',
      'endAction',
    ],
    'cutscene',
  );
  if (value.schemaVersion !== CUTSCENE_SCHEMA_VERSION) {
    fail(`cutscene.schemaVersion must be ${CUTSCENE_SCHEMA_VERSION}`);
  }
  const cutsceneId = text(value.cutsceneId, 'cutscene.cutsceneId');
  if (expectedId !== undefined && cutsceneId !== expectedId) {
    fail(`cutscene.cutsceneId must match ${expectedId}`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(cutsceneId)) {
    fail('cutscene.cutsceneId contains unsupported characters');
  }
  const durationMs = integer(value.durationMs, 'cutscene.durationMs');
  const video = assetRef(value.video, 'cutscene.video');
  const audio = assetRef(value.audio, 'cutscene.audio');

  const subtitlesRaw = value.subtitles ?? [];
  if (!Array.isArray(subtitlesRaw)) fail('cutscene.subtitles must be an array');
  const subtitles = subtitlesRaw.map((entry, index) => subtitle(entry, index));
  for (let index = 0; index < subtitles.length; index += 1) {
    if (index > 0 && subtitles[index].startMs < subtitles[index - 1].endMs) {
      fail('cutscene.subtitles must be sorted and non-overlapping');
    }
    if (subtitles[index].endMs > durationMs) {
      fail('cutscene.subtitles must end within durationMs');
    }
  }
  if (video === null && audio === null && subtitles.length === 0) {
    fail('cutscene must define video, audio, or subtitles');
  }

  const skippable = value.skippable === undefined
    ? true
    : boolean(value.skippable, 'cutscene.skippable');
  const skipAfterMs = value.skipAfterMs === undefined
    ? 0
    : integer(value.skipAfterMs, 'cutscene.skipAfterMs');
  if (skipAfterMs > durationMs) fail('cutscene.skipAfterMs must be <= durationMs');
  const endAction = value.endAction === undefined
    ? 'ReturnToExplore'
    : text(value.endAction, 'cutscene.endAction');
  if (endAction !== 'ReturnToExplore') {
    fail('cutscene.endAction must be ReturnToExplore');
  }

  return {
    schemaVersion: 1,
    cutsceneId,
    durationMs,
    video,
    audio,
    subtitles,
    skippable,
    skipAfterMs,
    endAction,
  };
}
