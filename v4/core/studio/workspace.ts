import {
  ProjectFolder,
  ProjectId,
  ProjectMeta,
  ProjectPrologue,
  ProjectTheme,
  ProjectTree,
  ProjectFolderId,
  type Project,
  type ProjectFolder as ProjectFolderType,
  type ProjectId as ProjectIdType,
  type ProjectMeta as ProjectMetaType,
  type ProjectTree as ProjectTreeType,
} from './projectTree';

/**
 * S · studio / workspace
 * Workspace 根、schema v2 聚合、v1 迁移与 trash 纯编排。
 * 不 import fs / Tauri / React / Pixi；文件能力通过端口注入。
 */

export type WorkspaceRoot = string;

export const WorkspaceRoot = {
  validate(value: unknown): value is WorkspaceRoot {
    return typeof value === 'string' && value.trim().length > 0;
  },
};

export interface Workspace {
  readonly schemaVersion: 2;
  readonly root: WorkspaceRoot;
  readonly folders: readonly ProjectFolderType[];
  readonly projects: readonly Project[];
  readonly tree: ProjectTreeType;
}

interface LegacySourcePort {
  readJson(relPath: string): Promise<unknown>;
  listFiles(relPath: string): Promise<readonly string[]>;
  readBytes(relPath: string): Promise<Uint8Array>;
  hashFile(relPath: string): Promise<string>;
}

interface WorkspaceTargetPort {
  readJson(relPath: string): Promise<unknown>;
  writeJsonAtomic(relPath: string, value: unknown): Promise<void>;
  ensureDir(relPath: string): Promise<void>;
  writeBytes(relPath: string, data: Uint8Array): Promise<void>;
  hashFile(relPath: string): Promise<string>;
  removeDir(relPath: string): Promise<void>;
}

interface TrashPort {
  moveToTrash(relPath: string): Promise<string>;
}

interface RestorePort {
  restoreFromTrash(trashRelPath: string, relPath: string): Promise<void>;
}

interface LegacyProjectV1 {
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly projectName: string;
  readonly createdAt: number;
  readonly worldIds: readonly string[];
}

interface WorkspaceManifest {
  readonly schemaVersion: 2;
  readonly folders: readonly ProjectFolderType[];
  readonly projectIds: readonly ProjectIdType[];
  readonly tree: ProjectTreeType;
}

interface MigrationOptions {
  readonly legacyDigest: string;
  readonly author?: string;
  readonly folderName?: string;
  readonly folderId?: ProjectFolderId;
  readonly projectName?: string;
  readonly theme?: ProjectTheme;
}

type MigrationResult =
  | {
      readonly status: 'Migrated';
      readonly folderId: ProjectFolderId;
      readonly projectId: ProjectIdType;
      readonly copiedFiles: number;
    }
  | {
      readonly status: 'AlreadyMigrated';
      readonly folderId: ProjectFolderId;
      readonly projectId: ProjectIdType;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeRelativePath(value: string): boolean {
  if (value.length === 0) return false;
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  if (/^[a-zA-Z]:/.test(value)) return false;
  if (value.includes('\\')) return false;
  return !value.split('/').some((part) => part === '' || part === '..');
}

function isLegacyProject(value: unknown): value is LegacyProjectV1 {
  if (!isPlainObject(value)) return false;
  return value.schemaVersion === 1
    && typeof value.projectId === 'string'
    && typeof value.projectName === 'string'
    && typeof value.createdAt === 'number'
    && Number.isFinite(value.createdAt)
    && Array.isArray(value.worldIds)
    && value.worldIds.every((worldId) => typeof worldId === 'string');
}

function themeFromDigest(digestHex: string): ProjectTheme {
  const hex = digestHex.replace(/[^0-9a-f]/gi, '');
  const source = `${hex}000000`.slice(0, 6);
  return {
    r: Number.parseInt(source.slice(0, 2), 16),
    g: Number.parseInt(source.slice(2, 4), 16),
    b: Number.parseInt(source.slice(4, 6), 16),
  };
}

function readManifest(value: unknown): WorkspaceManifest | null {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) throw new TypeError('workspace.json is not an object');
  if (value.schemaVersion !== 2) throw new TypeError('workspace.json schemaVersion must be 2');
  if (!Array.isArray(value.folders) || !value.folders.every(ProjectFolder.validate)) {
    throw new TypeError('workspace.json folders are invalid');
  }
  if (!Array.isArray(value.projectIds) || !value.projectIds.every(ProjectId.isValid)) {
    throw new TypeError('workspace.json projectIds are invalid');
  }
  if (!isPlainObject(value.tree) || value.tree.schemaVersion !== 2) {
    throw new TypeError('workspace.json tree is invalid');
  }
  return {
    schemaVersion: 2,
    folders: value.folders,
    projectIds: value.projectIds,
    tree: value.tree as unknown as ProjectTreeType,
  };
}

function validateWorkspace(
  root: WorkspaceRoot,
  folders: readonly ProjectFolderType[],
  projects: readonly Project[],
  tree: ProjectTreeType,
): boolean {
  if (!WorkspaceRoot.validate(root)) return false;
  if (new Set(folders.map((folder) => folder.folderId)).size !== folders.length) return false;
  if (new Set(projects.map((project) => project.meta.projectId)).size !== projects.length) return false;
  if (!folders.every(ProjectFolder.validate)) return false;
  if (!projects.every((project) => ProjectMeta.validate(project.meta))) return false;

  const folderIds = new Set(folders.map((folder) => folder.folderId));
  const projectIds = new Set(projects.map((project) => project.meta.projectId));
  for (const project of projects) {
    if (!folderIds.has(project.folderId) || !projectIds.has(project.meta.projectId)) return false;
  }
  for (const folder of folders) {
    for (const projectId of folder.projectIds) {
      if (!projectIds.has(projectId)) return false;
    }
  }
  return ProjectTree.validate(tree, folders, projects);
}

async function loadProjects(
  target: WorkspaceTargetPort,
  folders: readonly ProjectFolderType[],
): Promise<readonly Project[]> {
  const projects: Project[] = [];
  for (const folder of folders) {
    for (const projectId of folder.projectIds) {
      const raw = await target.readJson(`${folder.folderId}/${projectId}/project.json`);
      if (!ProjectMeta.validate(raw)) {
        throw new TypeError(`invalid project.json for ${projectId}`);
      }
      projects.push({ meta: raw, folderId: folder.folderId });
    }
  }
  return projects;
}

function findLegacyProject(
  projects: readonly Project[],
  legacyProjectId: string,
): Project | null {
  return projects.find((project) => project.meta.legacyProjectId === legacyProjectId) ?? null;
}

async function writeWorkspaceManifest(
  target: WorkspaceTargetPort,
  folders: readonly ProjectFolderType[],
  projects: readonly Project[],
  tree: ProjectTreeType,
): Promise<void> {
  const manifest: WorkspaceManifest = {
    schemaVersion: 2,
    folders,
    projectIds: projects.map((project) => project.meta.projectId),
    tree,
  };
  await target.writeJsonAtomic('workspace.json', manifest);
}

export const Workspace = {
  validate(value: unknown): value is Workspace {
    if (!isPlainObject(value)) return false;
    return value.schemaVersion === 2
      && Array.isArray(value.folders)
      && Array.isArray(value.projects)
      && isPlainObject(value.tree)
      && validateWorkspace(
        value.root as WorkspaceRoot,
        value.folders as readonly ProjectFolderType[],
        value.projects as readonly Project[],
        value.tree as unknown as ProjectTreeType,
      );
  },

  create(
    root: WorkspaceRoot,
    folders: readonly ProjectFolderType[],
    projects: readonly Project[],
    links: readonly {
      readonly edgeId: string;
      readonly fromNodeId: string;
      readonly toNodeId: string;
    }[] = [],
  ): Workspace {
    const tree = ProjectTree.create(folders, projects, links);
    if (!validateWorkspace(root, folders, projects, tree)) {
      throw new TypeError('invalid Workspace');
    }
    return {
      schemaVersion: 2,
      root,
      folders,
      projects,
      tree,
    };
  },

  /**
   * 将 schema v2 的 workspace/folder/project 元数据落盘。
   * 不写世界内容/媒体；用于 R3.6a 数据层 fixture 与后续 UI 初始化。
   */
  async materialize(
    target: WorkspaceTargetPort,
    root: WorkspaceRoot,
    folders: readonly ProjectFolderType[],
    projects: readonly Project[],
    links: readonly {
      readonly edgeId: string;
      readonly fromNodeId: string;
      readonly toNodeId: string;
    }[] = [],
  ): Promise<Workspace> {
    const workspace = Workspace.create(root, folders, projects, links);
    for (const folder of folders) {
      await target.ensureDir(folder.folderId);
      await target.writeJsonAtomic(`${folder.folderId}/folder.json`, folder);
    }
    for (const project of projects) {
      const projectDir = `${project.folderId}/${project.meta.projectId}`;
      await target.ensureDir(projectDir);
      await target.ensureDir(`${projectDir}/worlds`);
      await target.ensureDir(`${projectDir}/media`);
      await target.ensureDir(`${projectDir}/drafts`);
      await target.writeJsonAtomic(`${projectDir}/project.json`, project.meta);
    }
    await writeWorkspaceManifest(target, folders, projects, workspace.tree);
    return workspace;
  },

  async migrateLegacy(
    source: LegacySourcePort,
    target: WorkspaceTargetPort,
    options: MigrationOptions,
  ): Promise<MigrationResult> {
    const legacy = await source.readJson('project.json');
    if (!isLegacyProject(legacy)) {
      throw new TypeError('source is not a schemaVersion 1 project');
    }
    if (options.legacyDigest.trim().length < 8) {
      throw new TypeError('legacyDigest must be a SHA256 hex string');
    }

    const existingManifest = readManifest(await target.readJson('workspace.json'));
    const existingFolders = existingManifest?.folders ?? [];
    const existingProjects = existingManifest
      ? await loadProjects(target, existingManifest.folders)
      : [];
    const existing = findLegacyProject(existingProjects, legacy.projectId);
    if (existing) {
      return {
        status: 'AlreadyMigrated',
        folderId: existing.folderId,
        projectId: existing.meta.projectId,
      };
    }

    const takenProjectIds = existingProjects.map((project) => project.meta.projectId);
    const projectId = ProjectId.fromDigest(options.legacyDigest, takenProjectIds);
    const folderId = options.folderId ?? ProjectFolderId.next(existingFolders.map((folder) => folder.folderId));
    if (!ProjectFolderId.isValid(folderId)) {
      throw new TypeError('folderId must look like pf-0001');
    }

    const folderName = options.folderName ?? legacy.projectName;
    const existingFolder = existingFolders.find((folder) => folder.folderId === folderId);
    const folder = existingFolder
      ? ProjectFolder.create(
          folderId,
          existingFolder.folderName,
          [...existingFolder.projectIds, projectId],
        )
      : ProjectFolder.create(folderId, folderName, [projectId]);

    const meta: ProjectMetaType = {
      schemaVersion: 2,
      projectId,
      projectName: options.projectName ?? legacy.projectName,
      author: options.author ?? '',
      createdAt: legacy.createdAt,
      completedAt: null,
      theme: options.theme ?? themeFromDigest(options.legacyDigest),
      prologue: ProjectPrologue.empty(),
      worldIds: legacy.worldIds,
      legacyProjectId: legacy.projectId,
    };
    if (!ProjectMeta.validate(meta)) throw new TypeError('migrated ProjectMeta is invalid');

    const project: Project = { meta, folderId };
    const folders = existingFolder
      ? existingFolders.map((item) => (item.folderId === folderId ? folder : item))
      : [...existingFolders, folder];
    const projects = [...existingProjects, project];
    const tree = ProjectTree.create(
      folders,
      projects,
      existingManifest?.tree.edges ?? [],
    );

    const projectDir = `${folderId}/${projectId}`;
    const createdFolder = existingFolder === undefined;
    let copiedFiles = 0;
    let folderWritten = false;
    try {
      await target.ensureDir(projectDir);
      await target.writeJsonAtomic(`${projectDir}/project.json`, meta);

      const files = await source.listFiles('');
      for (const file of files) {
        if (!isSafeRelativePath(file)) {
          throw new TypeError(`unsafe legacy path: ${file}`);
        }
        if (file === 'project.json' || file === 'workspace.json' || file === 'folder.json') continue;
        const bytes = await source.readBytes(file);
        const destination = `${projectDir}/${file}`;
        await target.writeBytes(destination, bytes);
        const sourceHash = await source.hashFile(file);
        const targetHash = await target.hashFile(destination);
        if (sourceHash !== targetHash) {
          throw new Error(`hash mismatch after copying ${file}`);
        }
        copiedFiles += 1;
      }

      await target.writeJsonAtomic(`${folderId}/folder.json`, folder);
      folderWritten = true;
      await writeWorkspaceManifest(target, folders, projects, tree);
      return { status: 'Migrated', folderId, projectId, copiedFiles };
    } catch (error) {
      // 回滚本次新建目录；已有 folder 的 folder.json 也要恢复。
      try {
        await target.removeDir(projectDir);
        if (createdFolder) {
          await target.removeDir(folderId);
        } else if (folderWritten && existingFolder) {
          await target.writeJsonAtomic(`${folderId}/folder.json`, existingFolder);
        }
      } catch {
        // 回滚失败不覆盖原始错误；由调用方只读诊断。
      }
      throw error;
    }
  },

  async trash(io: TrashPort, relPath: string): Promise<string> {
    if (!isSafeRelativePath(relPath) || relPath === '.trash' || relPath.startsWith('.trash/')) {
      throw new TypeError('trash path must be a safe workspace-relative path');
    }
    return io.moveToTrash(relPath);
  },

  async restoreTrash(io: RestorePort, trashRelPath: string, relPath: string): Promise<void> {
    if (!trashRelPath.startsWith('.trash/') || !isSafeRelativePath(trashRelPath)) {
      throw new TypeError('trashRelPath must be under .trash/');
    }
    if (!isSafeRelativePath(relPath) || relPath.startsWith('.trash/')) {
      throw new TypeError('restore destination must be a safe workspace-relative path');
    }
    await io.restoreFromTrash(trashRelPath, relPath);
  },
};
