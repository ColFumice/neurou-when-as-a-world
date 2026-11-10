/**
 * S · studio
 * 单机 profile 与项目清单；不 import adapters / fs。
 */

/**
 * 单机身份。一个安装 = 一个 profile；
 * 不参与权限、归属、里程碑、账本判定。
 */
export class StudioProfile {
  static readonly instance: StudioProfile = new StudioProfile();

  readonly displayName: string;
  readonly interfaceLanguage: string;
  readonly defaultExportDirectory: string;

  private constructor() {
    this.displayName = '';
    this.interfaceLanguage = 'zh-CN';
    this.defaultExportDirectory = '';
  }
}

/** 项目清单。 */
export interface StudioProject {
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly projectName: string;
  readonly createdAt: number;
  readonly worldIds: readonly string[];
}
