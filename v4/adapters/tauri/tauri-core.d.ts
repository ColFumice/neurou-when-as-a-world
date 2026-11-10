declare module '@tauri-apps/api/core' {
  export function invoke<T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T>;

  /** 本地 asset protocol URL；Demo 用来挂载 project/media 下的视频与 WAV。 */
  export function convertFileSrc(filePath: string, protocol?: string): string;
}
