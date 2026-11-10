/**
 * D · media
 * 媒体源、导入、裁剪、深度图与音频段的只读契约。
 * 不 import presentation / director / ledger；不碰 fs / Tauri。
 */

/** 媒体资产来源。 */
export interface MediaSource {
  readonly assetId: string;
  readonly kind: 'Video' | 'Audio' | 'Image' | 'Depth';
  readonly displayName: string;
  readonly relPath: string;
  readonly sha256: string;
  /** 转码前的源文件 hash；图片/深度与 sha256 相同。 */
  readonly sourceSha256: string | null;
  readonly bytes: number;
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly videoCodec: string | null;
  readonly audioCodec: string | null;
  readonly audioChannels: number;
  readonly sampleRate: number;
  readonly createdAt: number;
  readonly derivedFrom: string | null;
  readonly trim: { readonly startMs: number; readonly endMs: number } | null;
  /** 成对立体媒体标识；left/right/audio 共享。 */
  readonly stereoPairId?: string | null;
  /** 视频眼睛；音频为 null。 */
  readonly eye?: 'Left' | 'Right' | null;
  /** 音频声道语义；双声道 WAV 为 Stereo。 */
  readonly audioChannel?: 'Left' | 'Right' | 'Stereo' | null;
}

/** 导入结果。 */
export interface MediaImport {
  readonly asset: MediaSource;
  readonly deduped: boolean;
}

/** 裁剪结果。 */
export interface MediaTrim {
  readonly sourceAssetId: string;
  readonly asset: MediaSource;
}

/** 深度图资产描述。 */
export interface DepthMap {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly format: 'json' | 'png' | 'jpeg' | 'webp' | 'tiff';
}

/** 深度阈值。 */
export interface DepthThreshold {
  readonly near: number;
  readonly far: number;
}

/** 音频段（trim 结果的轻量描述）。 */
export interface AudioSegment {
  readonly assetId: string;
  readonly startMs: number;
  readonly endMs: number;
}

/** 音频标记。 */
export interface AudioMarker {
  readonly timeMs: number;
  readonly label: string;
}

/** 重拍。 */
export interface Downbeat {
  readonly timeMs: number;
  readonly index: number;
}
