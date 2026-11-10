import {
  invoke as defaultInvoke,
  TauriInvokeError,
  type TauriInvokeFn,
} from './tauriInvoke';
import type { MediaSource, MediaTrim } from '../../core/media/types';

/** media_probe 的返回；属于 X 层，不是 NAMEBOOK A 类。 */
export interface MediaProbe {
  readonly kind: 'Video' | 'Audio' | 'Image' | 'Depth';
  readonly formatName: string;
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly videoCodec: string | null;
  readonly audioCodec: string | null;
  readonly audioChannels: number;
  readonly sampleRate: number;
  readonly bytes: number;
}

/** media_extract_frames 的返回；属于 X 层，不是 NAMEBOOK A 类。 */
export interface MediaFrame {
  readonly timeMs: number;
  readonly relPath: string;
  readonly width: number;
  readonly height: number;
}

/** 立体对 manifest 关联；属于 X 层，不是 NAMEBOOK A 类。 */
export interface MediaStereoPair {
  readonly stereoPairId: string;
  readonly leftAssetId: string;
  readonly rightAssetId: string;
  readonly audioAssetId: string;
  readonly createdAt: number;
  readonly pseudoStereo?: boolean;
  readonly derivedFrom?: string | null;
  readonly offsetMs?: number | null;
  readonly offsetFrames?: number | null;
}

/** media_import_stereo 的返回；三份文件 + pair 关联。 */
export interface MediaStereoImport {
  readonly pair: MediaStereoPair;
  readonly left: MediaSource;
  readonly right: MediaSource;
  readonly audio: MediaSource;
  readonly deduped: boolean;
}

/** X · Tauri 媒体导入适配器；所有输出路径由 Rust 生成。 */
export class TauriMediaImporter {
  constructor(private readonly invokeFn: TauriInvokeFn = defaultInvoke) {}

  async probe(sourcePath: string): Promise<MediaProbe> {
    return this.call<MediaProbe>('media_probe', { sourcePath });
  }

  /** Q1：只允许成对视频导入；单目命令已从后端移除。 */
  async importStereo(leftPath: string, rightPath: string): Promise<MediaStereoImport> {
    return this.call<MediaStereoImport>('media_import_stereo', { leftPath, rightPath });
  }

  /** R5c-A.3：单源伪双目；offsetMs 按整数帧量化，实际值见 pair.offsetMs。 */
  async importMonoStereo(sourcePath: string, offsetMs: number): Promise<MediaStereoImport> {
    return this.call<MediaStereoImport>('media_import_mono_stereo', { sourcePath, offsetMs });
  }

  /**
   * @deprecated Q1 起单目导入不可用；保留方法只为显式报错，调用请改用 importStereo。
   */
  async importMono(
    _sourcePath: string,
    _displayName?: string,
    _kindHint?: 'Auto' | 'Video' | 'Audio' | 'Image' | 'Depth',
  ): Promise<never> {
    throw new TauriInvokeError(
      'MonoImportDisabled',
      'single-eye media import is disabled; use importStereo(leftPath, rightPath)',
    );
  }

  /**
   * Demo 用：读取 media/ 下文件字节，供 blob: 视频纹理。
   * 只允许 media/ 相对路径；Rust 侧限制 256 MiB。
   */
  async readMediaFile(relPath: string): Promise<Uint8Array> {
    const bytes = await this.call<number[]>('media_read_file', { relPath });
    return Uint8Array.from(bytes);
  }

  async trim(assetId: string, startMs: number, endMs: number): Promise<MediaTrim> {
    return this.call<MediaTrim>('media_trim', { assetId, startMs, endMs });
  }

  async extractFrames(
    assetId: string,
    timesMs: readonly number[],
    maxWidth?: number,
  ): Promise<readonly MediaFrame[]> {
    const args: Record<string, unknown> = {
      assetId,
      timesMs: [...timesMs],
    };
    if (maxWidth !== undefined) args.maxWidth = maxWidth;
    return this.call<MediaFrame[]>('media_extract_frames', args);
  }

  private async call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    const result = await this.invokeFn<T>(command, args);
    if (!result.ok) throw new TauriInvokeError(result.code, result.message);
    return result.value;
  }
}
