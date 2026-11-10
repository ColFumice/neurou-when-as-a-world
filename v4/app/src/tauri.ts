import { invoke } from '@tauri-apps/api/core';

export interface AppInfo {
  name: string;
  version: string;
  tauriVersion: string;
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>('app_info');
}
