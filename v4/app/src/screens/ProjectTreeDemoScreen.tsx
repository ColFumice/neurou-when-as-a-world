import { useMemo, useState } from 'react';
import { ProjectFolder, ProjectFolderId } from '@core/studio/projectTree';
import type { Project, ProjectTheme } from '@core/studio/projectTree';
import { Workspace } from '@core/studio/workspace';
import type { Workspace as WorkspaceType } from '@core/studio/workspace';
import { ProjectTreeView } from '@core/presentation/projecttree/ProjectTreeView';
import { ProjectConsole } from '@core/presentation/console/WorldFolderConsole';
import { TimelineStateMachine } from '@core/timeline/types';
import { WorldKind } from '@core/world/types';
import type { RainModeState, WorldInstance } from '@core/world/types';

interface ProjectTreeDemoScreenProps {
  onExit: () => void;
  onEditWorld: (world: WorldInstance, projectName: string) => void;
  onEnterWorld?: (world: WorldInstance, projectName: string, projectRoot?: string) => void;
  projectRoot?: string;
  rainEnabled?: boolean;
  rainState?: RainModeState | null;
  onRainEnabledChange?: (enabled: boolean) => void;
  onRainRefresh?: () => void;
}

const CHROMATO_THEME: ProjectTheme = { r: 96, g: 118, b: 132 };
const PLASMATO_THEME: ProjectTheme = { r: 190, g: 132, b: 92 };

function fixtureWorld(
  worldId: string,
  theme: ProjectTheme,
  prologue: string,
): WorldInstance {
  return {
    worldId,
    kind: WorldKind.Primary,
    map: {},
    layers: [
      { index: 0, parallaxFactor: 0.1 },
      { index: 1, parallaxFactor: 0.5 },
      { index: 2, parallaxFactor: 1.5 },
    ],
    timeline: new TimelineStateMachine({ minMs: 0, maxMs: 12_000 }, { initialMs: 0 }),
    themeColor: theme,
    scale: {
      scaleRef: { pixelsPerWorldMeter: 32 },
      calibrationFactor: 1,
    },
    spawnPoints: [],
    spawnZones: [],
    folder: { folderId: 'pf-0001' },
    prologue,
  };
}

export const PROJECT_WORLDS: readonly WorldInstance[] = [
  fixtureWorld('w1', CHROMATO_THEME, '雨落在未完成的世界上。\n这是 chromato 的世界序言。'),
  fixtureWorld('w2', { r: 60, g: 84, b: 96 }, '潮汐退去后，城市仍在呼吸。\n这是第二个世界。'),
  fixtureWorld('w3', PLASMATO_THEME, '火焰没有名字，只有形状。\n这是 plasmato 的世界序言。'),
];

function fixtureProject(
  projectId: string,
  projectName: string,
  theme: ProjectTheme,
  worldIds: readonly string[],
): Project {
  return {
    folderId: 'pf-0001',
    meta: {
      schemaVersion: 2,
      projectId,
      projectName,
      author: '',
      createdAt: 1_700_000_000_000,
      completedAt: null,
      theme,
      prologue: {
        title: projectName,
        lines: [`${projectName} 的项目序言。`],
      },
      worldIds,
    },
  };
}

function createFixtureWorkspace(): WorkspaceType {
  const projects: Project[] = [
    fixtureProject('10000001', 'chromato', CHROMATO_THEME, ['w1', 'w2']),
    fixtureProject('10000002', 'plasmato', PLASMATO_THEME, ['w3']),
  ];
  const folder = ProjectFolder.create(
    'pf-0001',
    'A Try',
    projects.map((project) => project.meta.projectId),
  );
  return Workspace.create('fixture://project-tree', [folder], projects);
}

const memoryFiles = new Map<string, unknown>();
const memoryTarget = {
  readJson: async (relPath: string) => memoryFiles.get(relPath) ?? null,
  writeJsonAtomic: async (relPath: string, value: unknown) => {
    memoryFiles.set(relPath, value);
  },
  ensureDir: async () => undefined,
  writeBytes: async () => undefined,
  hashFile: async () => '',
  removeDir: async () => undefined,
};

export function ProjectTreeDemoScreen({
  onExit,
  onEditWorld,
  onEnterWorld,
  projectRoot,
  rainEnabled,
  rainState,
  onRainEnabledChange,
  onRainRefresh,
}: ProjectTreeDemoScreenProps) {
  const [workspace, setWorkspace] = useState<WorkspaceType>(createFixtureWorkspace);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [openOrigin, setOpenOrigin] = useState<{ x: number; y: number } | null>(null);
  const activeProject = activeProjectId
    ? workspace.projects.find((project) => project.meta.projectId === activeProjectId) ?? null
    : null;

  const worldThemes = useMemo(
    () => new Map<string, readonly ProjectTheme[]>([
      ['10000001', [
        CHROMATO_THEME,
        { r: 60, g: 84, b: 96 },
        { r: 112, g: 104, b: 88 },
      ]],
      ['10000002', [
        PLASMATO_THEME,
        { r: 120, g: 104, b: 94 },
      ]],
    ]),
    [],
  );

  const createFolder = () => {
    // 等涟漪动画结束再更新 workspace，避免 React 重建 ProjectTreeView 时
    // 与仍在渲染的 ripple/filter 生命周期相撞。
    window.setTimeout(() => {
      setWorkspace((previous) => {
        const folderId = ProjectFolderId.next(previous.folders.map((folder) => folder.folderId));
        const folder = ProjectFolder.create(folderId, `New Folder ${previous.folders.length + 1}`);
        const links = [
          ...previous.tree.edges,
          {
            edgeId: `link:${folderId}`,
            fromNodeId: 'folder:pf-0001',
            toNodeId: `folder:${folderId}`,
          },
        ];
        const next = Workspace.create(
          previous.root,
          [...previous.folders, folder],
          previous.projects,
          links,
        );
        void Workspace.materialize(
          memoryTarget,
          previous.root,
          next.folders,
          next.projects,
          next.tree.edges,
        );
        return next;
      });
    }, 760);
  };

  if (activeProject) {
    return (
      <ProjectConsole
        key={activeProject.meta.projectId}
        project={activeProject}
        worlds={PROJECT_WORLDS}
        origin={openOrigin ?? undefined}
        onExit={() => {
          setActiveProjectId(null);
          setOpenOrigin(null);
        }}
        onEditWorld={onEditWorld}
        onEnterWorld={onEnterWorld === undefined
          ? undefined
          : (world) => onEnterWorld(world, activeProject.meta.projectName, projectRoot)}
        rainEnabled={rainEnabled}
        rainState={rainState}
        onRainEnabledChange={onRainEnabledChange}
        onRainRefresh={onRainRefresh}
      />
    );
  }

  return (
    <ProjectTreeView
      workspace={workspace}
      worldThemes={worldThemes}
      onExit={onExit}
      onCreateFolder={createFolder}
      onOpenProject={(projectId, origin) => {
        setOpenOrigin(origin);
        setActiveProjectId(projectId);
      }}
    />
  );
}
