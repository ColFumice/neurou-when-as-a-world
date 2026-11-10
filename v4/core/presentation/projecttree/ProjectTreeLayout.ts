import type {
  Project,
  ProjectTheme,
  ProjectTreeNode,
} from '../../studio/projectTree';
import type { Workspace } from '../../studio/workspace';

/** P · projecttree：纯 3D 投影布局；不 import React/Pixi，不读 DOM。 */

interface LayoutCamera {
  readonly panX: number;
  readonly panY: number;
  readonly dolly: number;
}

interface LayoutNode {
  readonly nodeId: string;
  readonly kind: 'Folder' | 'Project';
  readonly projectId?: string;
  readonly folderId?: string;
  readonly screenX: number;
  readonly screenY: number;
  readonly wanderX: number;
  readonly wanderY: number;
  readonly scale: number;
  readonly depth: number;
  readonly color: ProjectTheme;
}

export interface ProjectTreeLayout {
  readonly nodes: readonly LayoutNode[];
  readonly camera: LayoutCamera;
}

interface LayoutInput {
  readonly workspace: Workspace;
  readonly timeMs: number;
  readonly width: number;
  readonly height: number;
  readonly mouseX: number;
  readonly mouseY: number;
  readonly wheelDelta?: number;
  readonly previousCamera?: LayoutCamera;
  readonly worldThemes?: ReadonlyMap<string, readonly ProjectTheme[]>;
  readonly selectedNodeId?: string | null;
  readonly pinnedWander?: {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
  } | null;
}

const SPAN_X = 900;
const SPAN_Y = 400;
const Z_NEAR = 600;
const Z_RANGE = 700;
const FOCAL = 900;
const PAN_MAX_X = 140;
const PAN_MAX_Y = 90;
const SMOOTH = 0.08;
const WANDER_PERIOD_MS = 16_000;

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function jitter(projectId: string, axis: string): number {
  const value = hashString(`${projectId}:${axis}`) % 1000;
  return (value / 1000 - 0.5) * 24;
}

function phase(projectId: string): number {
  return (hashString(projectId) % 10_000) / 10_000;
}

function rgbToBase(theme: ProjectTheme): { x: number; y: number; z: number } {
  const nr = theme.r / 255;
  const ng = theme.g / 255;
  const nb = theme.b / 255;
  return {
    x: (nr - 0.5) * 2 * SPAN_X,
    y: (ng - 0.5) * 2 * SPAN_Y,
    z: Z_NEAR + (1 - nb) * Z_RANGE,
  };
}

function averageTheme(themes: readonly ProjectTheme[]): ProjectTheme {
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
}

function catmullRom(
  points: readonly { readonly x: number; readonly y: number }[],
  t: number,
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const scaled = ((t % 1) + 1) % 1 * points.length;
  const index = Math.floor(scaled);
  const local = scaled - index;
  const p0 = points[(index - 1 + points.length) % points.length];
  const p1 = points[index % points.length];
  const p2 = points[(index + 1) % points.length];
  const p3 = points[(index + 2) % points.length];

  const t2 = local * local;
  const t3 = t2 * local;
  return {
    x: 0.5 * (
      (2 * p1.x)
      + (-p0.x + p2.x) * local
      + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
      + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),
    y: 0.5 * (
      (2 * p1.y)
      + (-p0.y + p2.y) * local
      + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
      + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    ),
  };
}

function wanderForProject(
  project: Project,
  projectTheme: ProjectTheme,
  timeMs: number,
  worldThemes: readonly ProjectTheme[] | undefined,
): { x: number; y: number } {
  const base = rgbToBase(projectTheme);
  const themes = worldThemes && worldThemes.length > 0 ? worldThemes : [projectTheme];
  const local = themes.map((theme) => {
    const position = rgbToBase(theme);
    return {
      x: (position.x - base.x) * 0.25,
      y: (position.y - base.y) * 0.25,
    };
  });

  const unique = new Set(local.map((point) => `${point.x.toFixed(1)}:${point.y.toFixed(1)}`));
  const t = (timeMs / WANDER_PERIOD_MS + phase(project.meta.projectId)) % 1;

  if (unique.size <= 1) {
    const angle = t * Math.PI * 2;
    return { x: Math.cos(angle) * 24, y: Math.sin(angle) * 24 };
  }
  return catmullRom(local, t);
}

function folderTheme(workspace: Workspace, folderId: string): ProjectTheme {
  const projectIds = workspace.folders.find((folder) => folder.folderId === folderId)?.projectIds
    ?? [];
  const themes = projectIds
    .map((projectId) => workspace.projects.find(
      (project) => project.meta.projectId === projectId,
    )?.meta.theme)
    .filter((theme): theme is ProjectTheme => theme !== undefined);
  return themes.length === 0 ? { r: 128, g: 128, b: 128 } : averageTheme(themes);
}

function nodePosition(
  workspace: Workspace,
  node: ProjectTreeNode,
  timeMs: number,
  worldThemes: ReadonlyMap<string, readonly ProjectTheme[]> | undefined,
): { base: { x: number; y: number; z: number }; color: ProjectTheme; wander: { x: number; y: number } } {
  if (node.kind === 'Folder') {
    const color = folderTheme(workspace, node.folderId);
    const folder = workspace.folders.find((item) => item.folderId === node.folderId);
    const empty = (folder?.projectIds.length ?? 0) === 0;
    let base = rgbToBase(color);
    if (empty) {
      const emptyFolders = workspace.folders.filter((item) => item.projectIds.length === 0);
      const index = emptyFolders.findIndex((item) => item.folderId === node.folderId);
      const ringAngle = Math.PI / 2
        + (index / Math.max(1, emptyFolders.length)) * Math.PI * 2;
      base = {
        x: Math.cos(ringAngle) * 260,
        y: Math.sin(ringAngle) * 150,
        z: 950,
      };
    }
    const angle = ((timeMs / 6_000 + phase(node.folderId)) % 1) * Math.PI * 2;
    return {
      base,
      color,
      wander: { x: Math.cos(angle) * 24, y: Math.sin(angle) * 24 },
    };
  }

  const project = workspace.projects.find(
    (item) => item.meta.projectId === node.projectId,
  );
  const color = project?.meta.theme ?? { r: 64, g: 72, b: 88 };
  const base = rgbToBase(color);
  const projectId = node.projectId;
  const wander = project
    ? wanderForProject(project, color, timeMs, worldThemes?.get(projectId))
    : { x: 0, y: 0 };
  return { base, color, wander };
}

export const ProjectTreeLayout = {
  compute(input: LayoutInput): ProjectTreeLayout {
    const width = Math.max(1, input.width);
    const height = Math.max(1, input.height);
    const previous = input.previousCamera ?? { panX: 0, panY: 0, dolly: 1 };
    const selected = input.selectedNodeId ?? null;
    const targetPanX = selected
      ? 0
      : ((input.mouseX - width / 2) / (width / 2)) * PAN_MAX_X;
    const targetPanY = selected
      ? 0
      : ((input.mouseY - height / 2) / (height / 2)) * PAN_MAX_Y;
    const panX = previous.panX + (targetPanX - previous.panX) * SMOOTH;
    const panY = previous.panY + (targetPanY - previous.panY) * SMOOTH;
    const targetDolly = Math.min(
      1.6,
      Math.max(0.7, previous.dolly - (input.wheelDelta ?? 0) * 0.0008),
    );
    const dolly = previous.dolly + (targetDolly - previous.dolly) * SMOOTH;

    const nodes: LayoutNode[] = [];
    for (const node of input.workspace.tree.nodes) {
      const { base, color, wander } = nodePosition(
        input.workspace,
        node,
        input.timeMs,
        input.worldThemes,
      );
      const pinned = selected === node.nodeId
        ? (input.pinnedWander?.nodeId === node.nodeId
          ? input.pinnedWander
          : { x: 0, y: 0 })
        : null;
      const appliedWander = pinned ?? wander;
      const offset = node.offset ?? { x: 0, y: 0, z: 0 };
      const baseX = base.x + jitter(
        node.kind === 'Project' ? node.projectId : node.folderId,
        'x',
      ) + offset.x;
      const baseY = base.y + jitter(
        node.kind === 'Project' ? node.projectId : node.folderId,
        'y',
      ) + offset.y;
      const baseZ = base.z + offset.z;
      const depth = baseZ * dolly;
      const perspective = FOCAL / depth;
      const sizeScale = node.kind === 'Folder' ? 0.65 : 1;
      nodes.push({
        nodeId: node.nodeId,
        kind: node.kind,
        ...(node.kind === 'Project'
          ? { projectId: node.projectId, folderId: node.folderId }
          : { folderId: node.folderId }),
        screenX: width / 2 + (baseX + appliedWander.x + panX) * perspective,
        screenY: height / 2 + (baseY + appliedWander.y + panY) * perspective,
        wanderX: appliedWander.x,
        wanderY: appliedWander.y,
        scale: Math.min(1.5, Math.max(0.55, perspective)) * sizeScale,
        depth,
        color,
      });
    }

    return {
      nodes,
      camera: { panX, panY, dolly },
    };
  },
};
