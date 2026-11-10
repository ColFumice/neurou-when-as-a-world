import type { StudioProject } from './types';

/**
 * S · studio / ProjectStore
 * 项目存储端口；构造注入 io，不直接碰 fs。
 * R2 的 event-tree 为 unknown 占位，R3 G 模块落地后替换为 EventTreeDocument。
 */

const EMPTY_EVENT_TREE = Object.freeze({
  schemaVersion: 1,
  nodes: Object.freeze([]),
  edges: Object.freeze([]),
  rootNodeId: null,
});

/** 项目存储端口；构造注入 io，不直接碰 fs。 */
export class ProjectStore {
  private constructor(
    private readonly io: {
      readProjectJson(): Promise<unknown>;
      writeProjectJson(data: unknown): Promise<void>;
      ensureLayout(): Promise<void>;
      readEventTreeJson(): Promise<unknown>;
      writeEventTreeJson(data: unknown): Promise<void>;
    },
    private readonly project: StudioProject | null,
    private readonly eventTree: unknown,
  ) {}

  /**
   * 创建项目：ensureLayout + 空 event-tree 占位。
   * 可选 project 一次写入 project.json（AC4-02）；不传时仅建布局与 event-tree。
   */
  static async create(
    io: {
      readProjectJson(): Promise<unknown>;
      writeProjectJson(data: unknown): Promise<void>;
      ensureLayout(): Promise<void>;
      readEventTreeJson(): Promise<unknown>;
      writeEventTreeJson(data: unknown): Promise<void>;
    },
    project?: StudioProject,
  ): Promise<ProjectStore> {
    await io.ensureLayout();
    if (project !== undefined) {
      await io.writeProjectJson(project);
    }
    await io.writeEventTreeJson(EMPTY_EVENT_TREE);
    return new ProjectStore(io, project ?? null, EMPTY_EVENT_TREE);
  }

  /** 打开项目：读 project.json 与 event-tree.json。 */
  static async open(io: {
    readProjectJson(): Promise<unknown>;
    writeProjectJson(data: unknown): Promise<void>;
    ensureLayout(): Promise<void>;
    readEventTreeJson(): Promise<unknown>;
    writeEventTreeJson(data: unknown): Promise<void>;
  }): Promise<ProjectStore> {
    const project = await io.readProjectJson();
    if (!isStudioProject(project)) {
      throw new Error('project.json is not a valid StudioProject');
    }
    const eventTree = await io.readEventTreeJson();
    return new ProjectStore(io, project, eventTree);
  }

  getProject(): StudioProject {
    if (this.project === null) {
      throw new Error('project.json has not been loaded');
    }
    return this.project;
  }

  getEventTree(): unknown {
    return this.eventTree;
  }
}

function isStudioProject(value: unknown): value is StudioProject {
  if (typeof value !== 'object' || value === null) return false;
  const project = value as Partial<StudioProject>;
  return (
    project.schemaVersion === 1
    && typeof project.projectId === 'string'
    && typeof project.projectName === 'string'
    && typeof project.createdAt === 'number'
    && Number.isFinite(project.createdAt)
    && Array.isArray(project.worldIds)
    && project.worldIds.every((worldId) => typeof worldId === 'string')
  );
}
