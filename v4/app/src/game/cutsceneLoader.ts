import { convertFileSrc } from '@tauri-apps/api/core';
import { TauriProjectIo } from '@adapters/tauri/TauriProjectIo';
import type { CutsceneAssetRef, CutsceneDefinition } from './cutscene';
import { parseCutscene } from './cutscene';
import type { LoadedGameChart } from './chartLoader';

export interface LoadedCutscene {
  readonly definition: CutsceneDefinition;
  readonly videoUrl: string | null;
  readonly audioUrl: string | null;
  readonly warnings: readonly string[];
}

export class CutsceneLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CutsceneLoadError';
  }
}

function pathJoin(root: string, relPath: string): string {
  const base = root.trim().replace(/[\\/]+$/, '');
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base}${separator}${relPath.replace(/\//g, separator)}`;
}

function resolveRef(
  ref: CutsceneAssetRef | null,
  projectRoot: string,
  loaded: LoadedGameChart,
): string | null {
  if (ref === null) return null;
  if (ref.relPath !== undefined) {
    return convertFileSrc(pathJoin(projectRoot, ref.relPath));
  }
  const assetId = ref.assetId as string;
  switch (assetId) {
    case 'asset:video:background':
    case 'asset:video:left':
      return loaded.media?.background ?? null;
    case 'asset:video:foreground':
    case 'asset:video:right':
      return loaded.media?.foreground ?? null;
    case 'asset:audio:main':
      return loaded.media?.audio ?? null;
    default:
      return loaded.audioAssets.get(assetId) ?? null;
  }
}

/** B4 · 读取 cutscenes/<id>.json；失败由 caller HUD 告警。 */
export async function loadCutscene(
  projectRoot: string,
  cutsceneId: string,
  loaded: LoadedGameChart,
): Promise<LoadedCutscene> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(cutsceneId)) {
    throw new CutsceneLoadError(`非法 cutsceneId：${cutsceneId}`);
  }
  let raw: unknown | null;
  try {
    const io = new TauriProjectIo();
    raw = await io.readProjectFile(`cutscenes/${cutsceneId}.json`);
  } catch (error) {
    throw new CutsceneLoadError(
      `读取 cutscene 失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (raw === null) {
    throw new CutsceneLoadError(`cutscene 未定义：${cutsceneId}`);
  }
  let definition: CutsceneDefinition;
  try {
    definition = parseCutscene(raw, cutsceneId);
  } catch (error) {
    throw new CutsceneLoadError(
      `cutscene schema 非法：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const warnings: string[] = [];
  const videoUrl = resolveRef(definition.video, projectRoot, loaded);
  const audioUrl = resolveRef(definition.audio, projectRoot, loaded);
  if (definition.video !== null && videoUrl === null) {
    warnings.push(`cutscene ${cutsceneId} 视频不可解析`);
  }
  if (definition.audio !== null && audioUrl === null) {
    warnings.push(`cutscene ${cutsceneId} 音频不可解析`);
  }
  return { definition, videoUrl, audioUrl, warnings };
}
