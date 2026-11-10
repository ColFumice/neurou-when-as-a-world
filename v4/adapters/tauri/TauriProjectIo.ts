import {
  invoke as defaultInvoke,
  TauriInvokeError,
  type TauriInvokeFn,
} from './tauriInvoke';

/** X · Tauri project JSON adapter；路径相对 ActiveProjectRoot。 */
export class TauriProjectIo {
  constructor(private readonly invokeFn: TauriInvokeFn = defaultInvoke) {}

  async openWorkspaceRoot(path: string): Promise<void> {
    await this.call<void>('workspace_open_root', { path });
  }

  async getWorkspaceRoot(): Promise<string> {
    return this.call<string>('workspace_get_root');
  }

  async readWorkspaceJson(relPath: string): Promise<unknown | null> {
    return this.call<unknown | null>('workspace_read_json', { relPath });
  }

  async writeWorkspaceJsonAtomic(relPath: string, data: unknown): Promise<void> {
    await this.call<void>('workspace_write_json_atomic', { relPath, value: data });
  }

  async ensureWorkspaceDir(relPath: string): Promise<void> {
    await this.call<void>('workspace_ensure_dir', { relPath });
  }

  async listWorkspaceDir(
    relPath: string,
  ): Promise<readonly { readonly name: string; readonly kind: string }[]> {
    return this.call<readonly { readonly name: string; readonly kind: string }[]>(
      'workspace_list_dir',
      { relPath },
    );
  }

  async moveWorkspaceToTrash(relPath: string): Promise<string> {
    return this.call<string>('workspace_move_to_trash', { relPath });
  }

  async restoreWorkspaceFromTrash(trashRelPath: string, relPath: string): Promise<void> {
    await this.call<void>('workspace_restore_from_trash', { trashRelPath, relPath });
  }

  async openProjectRoot(path: string): Promise<void> {
    await this.call<void>('project_open_root', { path });
  }

  async ensureLayout(): Promise<void> {
    await this.call<void>('project_ensure_layout');
  }

  async readProjectJson(): Promise<unknown> {
    return this.call<unknown | null>('project_read_json', { relPath: 'project.json' });
  }

  async writeProjectJson(data: unknown): Promise<void> {
    await this.call<void>('project_write_json_atomic', {
      relPath: 'project.json',
      value: data,
    });
  }

  /** 编辑器文档等任意 project-relative JSON；路径受限由 Rust 侧保证。 */
  async readProjectFile(relPath: string): Promise<unknown | null> {
    return this.call<unknown | null>('project_read_json', { relPath });
  }

  async writeProjectFile(relPath: string, data: unknown): Promise<void> {
    await this.call<void>('project_write_json_atomic', { relPath, value: data });
  }

  async deleteProjectFile(relPath: string): Promise<void> {
    await this.call<void>('project_delete_file', { relPath });
  }

  async readEventTreeJson(): Promise<unknown> {
    return this.call<unknown | null>('project_read_json', { relPath: 'event-tree.json' });
  }

  async writeEventTreeJson(data: unknown): Promise<void> {
    await this.call<void>('project_write_json_atomic', {
      relPath: 'event-tree.json',
      value: data,
    });
  }

  private async call<T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    const result = await this.invokeFn<T>(command, args);
    if (!result.ok) throw new TauriInvokeError(result.code, result.message);
    return result.value;
  }
}
