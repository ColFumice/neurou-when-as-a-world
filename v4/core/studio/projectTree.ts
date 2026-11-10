/**
 * S · studio / projecttree
 * Workspace → ProjectFolder → Project 的 schema v2 纯数据层。
 * 不 import fs / Tauri / React / Pixi；只做类型、校验与树派生。
 */

export type ProjectId = string;

export const ProjectId = {
  isValid(value: unknown): value is ProjectId {
    return typeof value === 'string' && /^\d{8}$/.test(value);
  },

  format(value: ProjectId): string {
    if (!ProjectId.isValid(value)) {
      throw new TypeError('projectId must contain exactly 8 digits');
    }
    return `${value.slice(0, 4)} ${value.slice(4)}`;
  },

  parse(display: string): ProjectId | null {
    const match = /^(\d{4})\s?(\d{4})$/.exec(display.trim());
    return match ? `${match[1]}${match[2]}` : null;
  },

  /**
   * 由调用方传入 SHA256 hex（S 不 import crypto）。
   * 取前 8 个 hex 映射到 8 位十进制，冲突时线性重试。
   */
  fromDigest(digestHex: string, taken: Iterable<ProjectId> = []): ProjectId {
    const hex = digestHex.replace(/[^0-9a-f]/gi, '').slice(0, 8);
    if (hex.length !== 8) {
      throw new TypeError('digest must contain at least 8 hex characters');
    }

    const used = new Set(taken);
    const base = 10_000_000;
    const span = 90_000_000;
    let cursor = base + (Number.parseInt(hex, 16) % span);
    for (let attempt = 0; attempt < span; attempt += 1) {
      const candidate = String(cursor).padStart(8, '0');
      if (!used.has(candidate)) return candidate;
      cursor = base + ((cursor - base + 1) % span);
    }
    throw new Error('no projectId available');
  },
};

export type ProjectFolderId = string;

export const ProjectFolderId = {
  isValid(value: unknown): value is ProjectFolderId {
    return typeof value === 'string' && /^pf-\d{4}$/.test(value);
  },

  format(value: ProjectFolderId): string {
    if (!ProjectFolderId.isValid(value)) {
      throw new TypeError('folderId must look like pf-0001');
    }
    return value.slice(3);
  },

  parse(display: string): ProjectFolderId | null {
    const trimmed = display.trim();
    if (/^\d{4}$/.test(trimmed)) return `pf-${trimmed}`;
    return /^pf-\d{4}$/.test(trimmed) ? trimmed : null;
  },

  next(taken: Iterable<ProjectFolderId> = []): ProjectFolderId {
    const used = new Set(taken);
    for (let index = 1; index <= 9999; index += 1) {
      const candidate = `pf-${String(index).padStart(4, '0')}`;
      if (!used.has(candidate)) return candidate;
    }
    throw new Error('no folderId available');
  },
};

export interface ProjectTheme {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export const ProjectTheme = {
  validate(value: unknown): value is ProjectTheme {
    if (typeof value !== 'object' || value === null) return false;
    const theme = value as Partial<ProjectTheme>;
    return [theme.r, theme.g, theme.b].every(
      (channel) => typeof channel === 'number'
        && Number.isInteger(channel)
        && channel >= 0
        && channel <= 255,
    );
  },

  average(themes: readonly ProjectTheme[]): ProjectTheme {
    if (themes.length === 0) return { r: 64, g: 72, b: 88 };
    const total = themes.reduce(
      (sum, theme) => ({ r: sum.r + theme.r, g: sum.g + theme.g, b: sum.b + theme.b }),
      { r: 0, g: 0, b: 0 },
    );
    return {
      r: Math.round(total.r / themes.length),
      g: Math.round(total.g / themes.length),
      b: Math.round(total.b / themes.length),
    };
  },

  toHex(theme: ProjectTheme): string {
    return `#${[theme.r, theme.g, theme.b]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`;
  },
};

export interface ProjectPrologue {
  readonly title: string;
  readonly lines: readonly string[];
}

export const ProjectPrologue = {
  empty(): ProjectPrologue {
    return { title: '', lines: [] };
  },

  validate(value: unknown): value is ProjectPrologue {
    if (typeof value !== 'object' || value === null) return false;
    const prologue = value as Partial<ProjectPrologue>;
    return typeof prologue.title === 'string'
      && Array.isArray(prologue.lines)
      && prologue.lines.every((line) => typeof line === 'string');
  },
};

export interface ProjectMeta {
  readonly schemaVersion: 2;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly author: string;
  readonly createdAt: number;
  readonly completedAt: number | null;
  readonly theme: ProjectTheme;
  readonly prologue: ProjectPrologue;
  readonly worldIds: readonly string[];
  /** 仅 v1 迁移时写入。 */
  readonly legacyProjectId?: string;
}

export const ProjectMeta = {
  validate(value: unknown): value is ProjectMeta {
    if (typeof value !== 'object' || value === null) return false;
    const meta = value as Partial<ProjectMeta>;
    return meta.schemaVersion === 2
      && ProjectId.isValid(meta.projectId)
      && typeof meta.projectName === 'string'
      && meta.projectName.length > 0
      && typeof meta.author === 'string'
      && typeof meta.createdAt === 'number'
      && Number.isFinite(meta.createdAt)
      && meta.createdAt >= 0
      && (meta.completedAt === null
        || (typeof meta.completedAt === 'number' && Number.isFinite(meta.completedAt)))
      && ProjectTheme.validate(meta.theme)
      && ProjectPrologue.validate(meta.prologue)
      && Array.isArray(meta.worldIds)
      && meta.worldIds.every((worldId) => typeof worldId === 'string')
      && new Set(meta.worldIds).size === meta.worldIds.length
      && (meta.legacyProjectId === undefined || typeof meta.legacyProjectId === 'string');
  },
};

export interface ProjectFolder {
  readonly schemaVersion: 2;
  readonly folderId: ProjectFolderId;
  readonly folderName: string;
  readonly projectIds: readonly ProjectId[];
}

export const ProjectFolder = {
  validate(value: unknown): value is ProjectFolder {
    if (typeof value !== 'object' || value === null) return false;
    const folder = value as Partial<ProjectFolder>;
    return folder.schemaVersion === 2
      && ProjectFolderId.isValid(folder.folderId)
      && typeof folder.folderName === 'string'
      && folder.folderName.length > 0
      && Array.isArray(folder.projectIds)
      && folder.projectIds.every((projectId) => ProjectId.isValid(projectId))
      && new Set(folder.projectIds).size === folder.projectIds.length;
  },

  create(
    folderId: ProjectFolderId,
    folderName: string,
    projectIds: readonly ProjectId[] = [],
  ): ProjectFolder {
    const folder: ProjectFolder = {
      schemaVersion: 2,
      folderId,
      folderName,
      projectIds,
    };
    if (!ProjectFolder.validate(folder)) {
      throw new TypeError('invalid ProjectFolder');
    }
    return folder;
  },
};

export interface Project {
  readonly meta: ProjectMeta;
  readonly folderId: ProjectFolderId;
}

export const Project = {
  validate(value: unknown): value is Project {
    if (typeof value !== 'object' || value === null) return false;
    const project = value as Partial<Project>;
    return ProjectMeta.validate(project.meta)
      && ProjectFolderId.isValid(project.folderId);
  },
};

export type ProjectTreeNode =
  | {
      readonly nodeId: string;
      readonly kind: 'Folder';
      readonly folderId: ProjectFolderId;
      readonly offset?: { readonly x: number; readonly y: number; readonly z: number };
    }
  | {
      readonly nodeId: string;
      readonly kind: 'Project';
      readonly projectId: ProjectId;
      readonly folderId: ProjectFolderId;
      readonly offset?: { readonly x: number; readonly y: number; readonly z: number };
    };

export interface ProjectTreeEdge {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  /** 只存显式链接；包含边由 deriveContainment 派生。 */
  readonly kind: 'Link';
}

export interface ProjectTree {
  readonly schemaVersion: 2;
  readonly nodes: readonly ProjectTreeNode[];
  readonly edges: readonly ProjectTreeEdge[];
}

interface DerivedContainmentEdge {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly kind: 'Contains';
}

function folderNodeId(folderId: ProjectFolderId): string {
  return `folder:${folderId}`;
}

function projectNodeId(projectId: ProjectId): string {
  return `project:${projectId}`;
}

function isOffset(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null) return false;
  const offset = value as { x?: unknown; y?: unknown; z?: unknown };
  return [offset.x, offset.y, offset.z].every(
    (axis) => typeof axis === 'number' && Number.isFinite(axis),
  );
}

function validateTree(
  tree: ProjectTree,
  folders: readonly ProjectFolder[],
  projects: readonly Project[],
): boolean {
  if (tree.schemaVersion !== 2) return false;
  if (!Array.isArray(tree.nodes) || !Array.isArray(tree.edges)) return false;

  const folderById = new Map(folders.map((folder) => [folder.folderId, folder]));
  const projectById = new Map(projects.map((project) => [project.meta.projectId, project]));
  if (folderById.size !== folders.length || projectById.size !== projects.length) return false;
  if (!folders.every((folder) => ProjectFolder.validate(folder))) return false;
  if (!projects.every((project) => Project.validate(project))) return false;

  const nodeIds = new Set<string>();
  const folderNodes = new Set<string>();
  const projectNodes = new Set<string>();
  for (const node of tree.nodes) {
    if (typeof node.nodeId !== 'string' || node.nodeId.length === 0) return false;
    if (nodeIds.has(node.nodeId)) return false;
    nodeIds.add(node.nodeId);
    if (!isOffset(node.offset)) return false;

    if (node.kind === 'Folder') {
      if (!ProjectFolderId.isValid(node.folderId)) return false;
      if (node.nodeId !== folderNodeId(node.folderId)) return false;
      if (!folderById.has(node.folderId)) return false;
      if (folderNodes.has(node.folderId)) return false;
      folderNodes.add(node.folderId);
    } else if (node.kind === 'Project') {
      if (!ProjectId.isValid(node.projectId)) return false;
      if (!ProjectFolderId.isValid(node.folderId)) return false;
      if (node.nodeId !== projectNodeId(node.projectId)) return false;
      const project = projectById.get(node.projectId);
      if (!project || project.folderId !== node.folderId) return false;
      if (!folderById.has(node.folderId)) return false;
      if (projectNodes.has(node.projectId)) return false;
      projectNodes.add(node.projectId);
    } else {
      return false;
    }
  }

  if (folderNodes.size !== folders.length || projectNodes.size !== projects.length) return false;

  for (const folder of folders) {
    if (!folderNodes.has(folder.folderId)) return false;
    for (const projectId of folder.projectIds) {
      const project = projectById.get(projectId);
      if (!project || project.folderId !== folder.folderId) return false;
    }
  }
  for (const project of projects) {
    const folder = folderById.get(project.folderId);
    if (!folder || !folder.projectIds.includes(project.meta.projectId)) return false;
  }

  const edgeIds = new Set<string>();
  for (const edge of tree.edges) {
    if (typeof edge.edgeId !== 'string' || edge.edgeId.length === 0) return false;
    if (edgeIds.has(edge.edgeId)) return false;
    edgeIds.add(edge.edgeId);
    if (edge.kind !== 'Link') return false;
    if (edge.fromNodeId === edge.toNodeId) return false;
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) return false;
  }

  return true;
}

export const ProjectTree = {
  folderNodeId,
  projectNodeId,

  create(
    folders: readonly ProjectFolder[],
    projects: readonly Project[],
    links: readonly {
      readonly edgeId: string;
      readonly fromNodeId: string;
      readonly toNodeId: string;
    }[] = [],
  ): ProjectTree {
    const tree: ProjectTree = {
      schemaVersion: 2,
      nodes: [
        ...folders.map((folder) => ({
          nodeId: folderNodeId(folder.folderId),
          kind: 'Folder' as const,
          folderId: folder.folderId,
        })),
        ...projects.map((project) => ({
          nodeId: projectNodeId(project.meta.projectId),
          kind: 'Project' as const,
          projectId: project.meta.projectId,
          folderId: project.folderId,
        })),
      ],
      edges: links.map((link) => ({
        edgeId: link.edgeId,
        fromNodeId: link.fromNodeId,
        toNodeId: link.toNodeId,
        kind: 'Link' as const,
      })),
    };
    if (!validateTree(tree, folders, projects)) {
      throw new TypeError('invalid ProjectTree');
    }
    return tree;
  },

  validate(
    tree: ProjectTree,
    folders: readonly ProjectFolder[],
    projects: readonly Project[],
  ): boolean {
    return validateTree(tree, folders, projects);
  },

  deriveContainment(
    folders: readonly ProjectFolder[],
    projects: readonly Project[],
  ): readonly DerivedContainmentEdge[] {
    const projectById = new Map(projects.map((project) => [project.meta.projectId, project]));
    const edges: DerivedContainmentEdge[] = [];
    for (const folder of folders) {
      for (const projectId of folder.projectIds) {
        const project = projectById.get(projectId);
        if (!project || project.folderId !== folder.folderId) continue;
        edges.push({
          edgeId: `contains:${folder.folderId}:${projectId}`,
          fromNodeId: folderNodeId(folder.folderId),
          toNodeId: projectNodeId(projectId),
          kind: 'Contains',
        });
      }
    }
    return edges;
  },
};
