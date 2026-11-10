/**
 * R5a.1 · 音频 hash（X 层）。
 *
 * 裁定：hash 原始音频文件字节，而不是 WebAudio decode 后的 PCM。
 * 这样不同设备/采样率解码不会让 sidecar 无谓失效。
 */
import { TauriProjectIo } from '../../../adapters/tauri/TauriProjectIo';
import { TauriMediaImporter } from '../../../adapters/tauri/TauriMediaImporter';

interface SubtleLike {
  digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer>;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = (globalThis as unknown as {
    readonly crypto?: { readonly subtle?: SubtleLike };
  }).crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** 读取 project 内媒体文件并计算文件字节 hash。 */
export async function hashAudioFile(
  projectRoot: string,
  audioRelPath: string,
): Promise<string> {
  const io = new TauriProjectIo();
  await io.openProjectRoot(projectRoot);
  const bytes = await new TauriMediaImporter().readMediaFile(audioRelPath);
  return sha256Hex(bytes);
}
