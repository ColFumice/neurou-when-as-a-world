import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import type { ProjectTheme } from '../../studio/projectTree';
import type { Workspace } from '../../studio/workspace';
import { ProjectTreeLayout } from './ProjectTreeLayout';
import { ThemeBackground } from './ThemeBackground';
import { FisheyeEffect } from './FisheyeEffect';
import { VignetteEffect } from './VignetteEffect';
import { DesaturationEffect } from './DesaturationEffect';
import { InvertRipple } from './InvertRipple';
import './projecttree.css';

interface ProjectTreeViewProps {
  readonly workspace: Workspace;
  readonly worldThemes?: ReadonlyMap<string, readonly ProjectTheme[]>;
  readonly onExit?: () => void;
  readonly onCreateFolder?: () => void;
  readonly onOpenProject?: (projectId: string, origin: { x: number; y: number }) => void;
}

interface NodeView {
  readonly nodeId: string;
  readonly kind: 'Folder' | 'Project';
  readonly container: PIXI.Container;
  readonly glow: PIXI.Graphics;
  readonly box: PIXI.Graphics;
  readonly label: PIXI.Text;
  readonly image: PIXI.Sprite;
  textureKey: string | null;
  displayScale: number;
  displayX: number;
  displayY: number;
  reveal: number;
  initialized: boolean;
}

interface RippleState {
  readonly x: number;
  readonly y: number;
  readonly startedAt: number;
}

interface ZoomState {
  readonly nodeId: string;
  readonly image: string;
  readonly from: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  readonly expanded: boolean;
}

const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 540;

function colorNumber(theme: ProjectTheme): number {
  return (theme.r << 16) | (theme.g << 8) | theme.b;
}

function colorCss(theme: ProjectTheme): string {
  return `rgb(${theme.r}, ${theme.g}, ${theme.b})`;
}

/** 解绑 stage/子节点的 filter，避免 destroy 时 shader 仍绑定 TextureSource。 */
function detachFilters(container: PIXI.Container): void {
  (container as unknown as { filters: PIXI.Filter[] | null }).filters = null;
  for (const child of container.children) {
    if (child instanceof PIXI.Container) detachFilters(child);
  }
}

type GlitchTone = 'cool' | 'warm' | 'neutral';

function glitchToneForTheme(theme: ProjectTheme): GlitchTone {
  const warmth = theme.r - theme.b;
  if (warmth > 14) return 'warm';
  if (warmth < -14) return 'cool';
  return 'neutral';
}

function emitGlitchTone(tone: GlitchTone): void {
  window.dispatchEvent(new CustomEvent('neurou:glitch-tone', { detail: tone }));
}
function themeForNode(workspace: Workspace, nodeId: string): ProjectTheme {
  const node = workspace.tree.nodes.find((item) => item.nodeId === nodeId);
  if (!node) return { r: 64, g: 72, b: 88 };
  if (node.kind === 'Project') {
    return workspace.projects.find(
      (project) => project.meta.projectId === node.projectId,
    )?.meta.theme ?? { r: 64, g: 72, b: 88 };
  }
  const themes = workspace.folders.find(
    (folder) => folder.folderId === node.folderId,
  )?.projectIds
    .map((projectId) => workspace.projects.find(
      (project) => project.meta.projectId === projectId,
    )?.meta.theme)
    .filter((theme): theme is ProjectTheme => theme !== undefined) ?? [];
  if (themes.length === 0) return { r: 128, g: 128, b: 128 };
  return {
    r: Math.round(themes.reduce((sum, theme) => sum + theme.r, 0) / themes.length),
    g: Math.round(themes.reduce((sum, theme) => sum + theme.g, 0) / themes.length),
    b: Math.round(themes.reduce((sum, theme) => sum + theme.b, 0) / themes.length),
  };
}

export function ProjectTreeView({
  workspace,
  worldThemes,
  onExit,
  onCreateFolder,
  onOpenProject,
}: ProjectTreeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ripple, setRipple] = useState<RippleState | null>(null);
  const [rippleProgress, setRippleProgress] = useState(0);
  const [desaturating, setDesaturating] = useState(false);
  const [cssFallback, setCssFallback] = useState(false);
  const [fps, setFps] = useState(0);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<ReadonlySet<string>>(new Set());
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomState, setZoomState] = useState<ZoomState | null>(null);
  const selectedRef = useRef<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const layoutRef = useRef<ProjectTreeLayout | null>(null);
  const loggedFolderWander = useRef<Set<string>>(new Set());
  const pinnedWanderRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const collapsedRef = useRef<ReadonlySet<string>>(collapsedFolders);
  const createFolderRef = useRef(onCreateFolder);
  const workspaceRef = useRef(workspace);
  const worldThemesRef = useRef(worldThemes);
  const appRef = useRef<PIXI.Application | null>(null);
  const syncSceneRef = useRef<(() => void) | null>(null);
  workspaceRef.current = workspace;
  worldThemesRef.current = worldThemes;

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    emitGlitchTone('neutral');
    return () => emitGlitchTone('neutral');
  }, []);

  useEffect(() => {
    collapsedRef.current = collapsedFolders;
  }, [collapsedFolders]);

  useEffect(() => {
    createFolderRef.current = onCreateFolder;
  }, [onCreateFolder]);

  useEffect(() => {
    if (!zoomState || zoomState.expanded) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        setZoomState((previous) => (previous ? { ...previous, expanded: true } : null));
      });
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [zoomState]);

  useEffect(() => {
    hoveredRef.current = hoveredId;
  }, [hoveredId]);

  useEffect(() => {
    if (!ripple) return;
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - ripple.startedAt;
      setRippleProgress(Math.min(1, elapsed / 700));
      if (elapsed >= 700) {
        setRipple(null);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [ripple]);

  useEffect(() => {
    if (!desaturating) return;
    const timer = window.setTimeout(() => setDesaturating(false), 380);
    return () => window.clearTimeout(timer);
  }, [desaturating]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let app: PIXI.Application | null = null;
    let fisheye: FisheyeEffect | null = null;
    const background = new ThemeBackground();
    const textureCache = new Map<string, PIXI.Texture>();
    const nodeViews = new Map<string, NodeView>();
    const edgeGraphics = new PIXI.Graphics();
    const nodeLayer = new PIXI.Container();
    const backgroundLayer = new PIXI.Container();

    let pointerX = STAGE_WIDTH / 2;
    let pointerY = STAGE_HEIGHT / 2;
    let wheelDelta = 0;
    let camera = { panX: 0, panY: 0, dolly: 1 };
    let lastFpsAt = performance.now();
    let frames = 0;
    let currentTextureKey = '';
    let currentBackground: PIXI.Sprite | null = null;
    let nextBackground: PIXI.Sprite | null = null;
    let backgroundFade = 1;
    const imageCache = new Map<string, string>();

    const textureFor = (theme: ProjectTheme, seed: string): PIXI.Texture => {
      const key = `${seed}:${theme.r}:${theme.g}:${theme.b}`;
      const cached = textureCache.get(key);
      if (cached) return cached;

      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = 1920;
      colorCanvas.height = 1080;
      const context = colorCanvas.getContext('2d');
      if (context) {
        background.render(
          context as unknown as Parameters<ThemeBackground['render']>[0],
          theme,
          seed,
        );
      }
      const texture = PIXI.Texture.from(colorCanvas);
      textureCache.set(key, texture);
      return texture;
    };

    const imageFor = (theme: ProjectTheme, seed: string): string => {
      const key = `${seed}:${theme.r}:${theme.g}:${theme.b}`;
      const cached = imageCache.get(key);
      if (cached) return cached;

      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = 1920;
      colorCanvas.height = 1080;
      const context = colorCanvas.getContext('2d');
      if (context) {
        background.render(
          context as unknown as Parameters<ThemeBackground['render']>[0],
          theme,
          seed,
        );
      }
      const dataUrl = colorCanvas.toDataURL('image/png');
      imageCache.set(key, dataUrl);
      return dataUrl;
    };

    const setBackground = (nodeId: string): void => {
      if (!app) return;
      const key = nodeId;
      if (key === currentTextureKey) return;
      currentTextureKey = key;
      const theme = themeForNode(workspaceRef.current, nodeId);
      const texture = textureFor(theme, nodeId);
      if (!currentBackground) {
        currentBackground = new PIXI.Sprite(texture);
        currentBackground.anchor.set(0.5);
        backgroundLayer.addChild(currentBackground);
        backgroundFade = 1;
      } else {
        if (nextBackground) nextBackground.destroy();
        nextBackground = new PIXI.Sprite(texture);
        nextBackground.anchor.set(0.5);
        nextBackground.alpha = 0;
        backgroundLayer.addChild(nextBackground);
        backgroundFade = 0;
      }
    };

    const createNodes = (): void => {
      if (!app) return;
      const currentWorkspace = workspaceRef.current;
      for (const node of currentWorkspace.tree.nodes) {
        const theme = themeForNode(currentWorkspace, node.nodeId);
        const width = 190;
        const height = 112;
        const container = new PIXI.Container();
        container.eventMode = 'static';
        container.cursor = 'pointer';

        const image = new PIXI.Sprite();
        image.anchor.set(0.5);
        image.width = width;
        image.height = height;
        image.visible = false;
        container.addChild(image);

        const glow = new PIXI.Graphics();
        glow
          .roundRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, 10)
          .stroke({ color: 0xffffff, width: 5, alpha: 0.22 });
        glow.visible = false;
        container.addChild(glow);

        const box = new PIXI.Graphics();
        box
          .roundRect(-width / 2, -height / 2, width, height, 8)
          .fill({ color: colorNumber(theme), alpha: 0.2 })
          .stroke({ color: 0xffffff, width: 1.5, alpha: 0.92 });
        container.addChild(box);

        const label = new PIXI.Text({
          text: node.kind === 'Folder'
            ? currentWorkspace.folders.find((folder) => folder.folderId === node.folderId)?.folderName ?? node.nodeId
            : currentWorkspace.projects.find((project) => project.meta.projectId === node.projectId)?.meta.projectName ?? node.nodeId,
          style: {
            fill: 0xffffff,
            fontFamily: 'Consolas, monospace',
            fontSize: 14,
            fontWeight: '600',
          },
        });
        label.anchor.set(0.5);
        container.addChild(label);

        const view: NodeView = {
          nodeId: node.nodeId,
          kind: node.kind,
          container,
          glow,
          box,
          label,
          image,
          textureKey: null,
          displayScale: 1,
          displayX: 0,
          displayY: 0,
          reveal: 1,
          initialized: false,
        };
        nodeViews.set(node.nodeId, view);
        nodeLayer.addChild(container);

        container.on('pointerover', () => {
          setHoveredId(node.nodeId);
          hoveredRef.current = node.nodeId;
          setBackground(node.nodeId);
        });
        container.on('pointerout', () => {
          setHoveredId(null);
          hoveredRef.current = null;
        });
        container.on('pointertap', (event) => {
          event.stopPropagation();
          const wasSelected = selectedRef.current === node.nodeId;
          const currentNode = layoutRef.current?.nodes.find((item) => item.nodeId === node.nodeId);
          pinnedWanderRef.current = currentNode
            ? { nodeId: node.nodeId, x: currentNode.wanderX, y: currentNode.wanderY }
            : { nodeId: node.nodeId, x: 0, y: 0 };
          setSelectedId(node.nodeId);
          selectedRef.current = node.nodeId;
          setBackground(node.nodeId);
          emitGlitchTone(glitchToneForTheme(theme));

          if (node.kind === 'Folder') {
            // 文件夹不走 1.5× 放大，只切换子项目展开/收起。
            setZoomState(null);
            setZoomActive(false);
            setCollapsedFolders((previous) => {
              const next = new Set(previous);
              if (next.has(node.folderId)) next.delete(node.folderId);
              else next.add(node.folderId);
              collapsedRef.current = next;
              return next;
            });
            return;
          }

          if (wasSelected) {
            const selectedView = nodeViews.get(node.nodeId);
            if (!selectedView) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / STAGE_WIDTH;
            const scaleY = rect.height / STAGE_HEIGHT;
            const fromWidth = 190 * selectedView.container.scale.x;
            const fromHeight = 112 * selectedView.container.scale.y;
            const origin = {
              x: rect.left + selectedView.container.x * scaleX,
              y: rect.top + selectedView.container.y * scaleY,
            };
            setZoomState({
              nodeId: node.nodeId,
              image: imageFor(theme, node.nodeId),
              from: {
                left: rect.left + (selectedView.container.x - fromWidth / 2) * scaleX,
                top: rect.top + (selectedView.container.y - fromHeight / 2) * scaleY,
                width: fromWidth * scaleX,
                height: fromHeight * scaleY,
              },
              expanded: false,
            });
            setZoomActive(true);
            // DOM 放大 700ms 后再切 ProjectConsole；保留全屏白边过渡。
            window.setTimeout(() => {
              if (selectedRef.current === node.nodeId) onOpenProject?.(node.projectId, origin);
            }, 720);
          } else {
            setZoomState(null);
            setZoomActive(false);
          }
        });
      }
    };

    const update = (): void => {
      try {
      if (!app) return;
      const layout = ProjectTreeLayout.compute({
        workspace: workspaceRef.current,
        timeMs: performance.now(),
        width: app.screen.width,
        height: app.screen.height,
        mouseX: pointerX,
        mouseY: pointerY,
        wheelDelta,
        previousCamera: camera,
        worldThemes: worldThemesRef.current,
        selectedNodeId: selectedRef.current,
        pinnedWander: pinnedWanderRef.current,
      });
      camera = layout.camera;
      layoutRef.current = layout;
      wheelDelta = 0;

      if (currentBackground) {
        const scale = 1.05 + Math.sin(performance.now() / 20_000 * Math.PI * 2) * 0.025;
        currentBackground.width = app.screen.width * scale;
        currentBackground.height = app.screen.height * scale;
        currentBackground.x = app.screen.width / 2;
        currentBackground.y = app.screen.height / 2;
      }
      if (nextBackground) {
        nextBackground.width = app.screen.width;
        nextBackground.height = app.screen.height;
        nextBackground.x = app.screen.width / 2;
        nextBackground.y = app.screen.height / 2;
        backgroundFade = Math.min(1, backgroundFade + 0.045);
        nextBackground.alpha = backgroundFade;
        if (backgroundFade >= 1) {
          currentBackground?.destroy();
          currentBackground = nextBackground;
          nextBackground = null;
          currentBackground.alpha = 1;
        }
      }

      const selected = selectedRef.current;
      const selectedNode = selected
        ? workspaceRef.current.tree.nodes.find((node) => node.nodeId === selected)
        : undefined;
      const selectedFolderId = selectedNode?.kind === 'Folder'
        ? selectedNode.folderId
        : null;
      const layoutById = new Map(layout.nodes.map((node) => [node.nodeId, node]));
      for (const node of layout.nodes) {
        const view = nodeViews.get(node.nodeId);
        if (!view) continue;
        if (node.kind === 'Folder' && !loggedFolderWander.current.has(node.nodeId)) {
          loggedFolderWander.current.add(node.nodeId);
          console.log('[projecttree] folder wander', node.nodeId, node.wanderX, node.wanderY);
        }

        const folderId = node.kind === 'Project'
          ? workspaceRef.current.projects.find((project) => project.meta.projectId === node.projectId)?.folderId
          : undefined;
        const collapsed = folderId ? collapsedRef.current.has(folderId) : false;
        const folderNode = folderId ? layoutById.get(`folder:${folderId}`) : undefined;
        const targetX = collapsed && folderNode ? folderNode.screenX : node.screenX;
        const targetY = collapsed && folderNode ? folderNode.screenY : node.screenY;
        const targetReveal = collapsed ? 0 : 1;
        const targetScale = node.scale * (node.kind === 'Project' && node.nodeId === selected ? 1.5 : 1);

        if (!view.initialized) {
          // 新建节点必须在创建后立即拿到当前 layout，而不是从 (0,0) 漂移。
          view.displayX = targetX;
          view.displayY = targetY;
          view.displayScale = targetScale;
          view.reveal = targetReveal;
          view.initialized = true;
        } else {
          view.displayX += (targetX - view.displayX) * 0.16;
          view.displayY += (targetY - view.displayY) * 0.16;
          view.displayScale += (targetScale - view.displayScale) * 0.18;
          view.reveal += (targetReveal - view.reveal) * 0.16;
        }

        const isSelected = node.nodeId === selected;
        const isSelectedFolderChild = selectedFolderId !== null
          && node.kind === 'Project'
          && node.folderId === selectedFolderId;
        const externalAlpha = isSelected || isSelectedFolderChild
          ? 1
          : selected ? 0.1 : 0.92;
        view.container.x = view.displayX;
        view.container.y = view.displayY;
        view.container.zIndex = isSelected ? 10_000 : -node.depth;
        view.container.scale.set(view.displayScale);
        view.container.alpha = externalAlpha * (node.kind === 'Project' ? view.reveal : 1);
        view.container.visible = node.kind !== 'Project' || view.reveal > 0.01;
        view.glow.visible = isSelected || (node.kind === 'Folder' && !collapsed);
        view.label.alpha = isSelected ? 1 : 0.88;
        if (isSelected && node.kind === 'Project') {
          if (view.textureKey !== node.nodeId) {
            view.image.texture = textureFor(node.color, node.nodeId);
            view.textureKey = node.nodeId;
          }
          view.image.visible = true;
          view.image.alpha = 0.38;
        } else {
          view.image.visible = false;
        }
      }

      edgeGraphics.clear();
      for (const folder of workspaceRef.current.folders) {
        const from = nodeViews.get(`folder:${folder.folderId}`);
        if (!from) continue;
        for (const projectId of folder.projectIds) {
          const to = nodeViews.get(`project:${projectId}`);
          if (!to || to.reveal < 0.25) continue;
          edgeGraphics.moveTo(from.container.x, from.container.y)
            .lineTo(to.container.x, to.container.y);
        }
      }
      for (const edge of workspaceRef.current.tree.edges) {
        const from = nodeViews.get(edge.fromNodeId);
        const to = nodeViews.get(edge.toNodeId);
        if (!from || !to || from.reveal < 0.25 || to.reveal < 0.25) continue;
        edgeGraphics.moveTo(from.container.x, from.container.y)
          .lineTo(to.container.x, to.container.y);
      }
      edgeGraphics.stroke({ color: 0xffffff, width: 1, alpha: 0.28 });

      frames += 1;
      const now = performance.now();
      if (now - lastFpsAt >= 500) {
        setFps(Math.round((frames * 1000) / (now - lastFpsAt)));
        frames = 0;
        lastFpsAt = now;
      }
      } catch (error) {
        setRuntimeError(error instanceof Error ? error.stack ?? error.message : String(error));
      }
    };

    const rebuildScene = (): void => {
      if (!app) return;
      nodeLayer.removeChildren();
      nodeViews.clear();
      backgroundLayer.removeChildren();
      currentBackground = null;
      nextBackground = null;
      currentTextureKey = '';
      backgroundFade = 1;
      edgeGraphics.clear();
      hoveredRef.current = null;
      setHoveredId(null);
      createNodes();

      // 重建后立即应用一次最新布局，避免新节点在 ticker 第一帧前停在 (0,0)。
      const initial = ProjectTreeLayout.compute({
        workspace: workspaceRef.current,
        timeMs: performance.now(),
        width: app.screen.width,
        height: app.screen.height,
        mouseX: pointerX,
        mouseY: pointerY,
        previousCamera: camera,
        worldThemes: worldThemesRef.current,
        selectedNodeId: selectedRef.current,
        pinnedWander: pinnedWanderRef.current,
      });
      camera = initial.camera;
      layoutRef.current = initial;
      for (const node of initial.nodes) {
        const view = nodeViews.get(node.nodeId);
        if (!view) continue;
        view.displayX = node.screenX;
        view.displayY = node.screenY;
        view.displayScale = node.scale;
        view.reveal = 1;
        view.initialized = true;
        view.container.x = node.screenX;
        view.container.y = node.screenY;
        view.container.scale.set(node.scale);
      }
      setBackground(workspaceRef.current.tree.nodes[0]?.nodeId ?? '');
    };
    syncSceneRef.current = rebuildScene;

    const mount = async (): Promise<void> => {
      const pixi = new PIXI.Application();
      await pixi.init({
        canvas,
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        background: 0x05070a,
        antialias: true,
      });
      if (disposed) {
        pixi.destroy(false, { children: true, texture: false, textureSource: false });
        return;
      }
      app = pixi;
      appRef.current = pixi;
      app.stage.addChild(backgroundLayer);
      app.stage.addChild(edgeGraphics);
      app.stage.addChild(nodeLayer);
      nodeLayer.sortableChildren = true;

      try {
        fisheye = new FisheyeEffect();
        app.stage.filters = [fisheye.filter];
      } catch {
        setCssFallback(true);
      }

      rebuildScene();
      app.ticker.add(update);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width) * STAGE_WIDTH;
      pointerY = ((event.clientY - rect.top) / rect.height) * STAGE_HEIGHT;
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      wheelDelta += event.deltaY;
    };
    const onDoubleClick = (event: MouseEvent): void => {
      if (hoveredRef.current) return;
      const rect = canvas.getBoundingClientRect();
      setSelectedId(null);
      selectedRef.current = null;
      pinnedWanderRef.current = null;
      emitGlitchTone('neutral');
      setRippleProgress(0);
      setRipple({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        startedAt: performance.now(),
      });
      createFolderRef.current?.();
    };
    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
      if (hoveredRef.current) return;
      setDesaturating(true);
    };
    const onCanvasClick = (): void => {
      if (!hoveredRef.current) {
        setZoomState(null);
        setZoomActive(false);
        setSelectedId(null);
        selectedRef.current = null;
        pinnedWanderRef.current = null;
        emitGlitchTone('neutral');
      }
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('click', onCanvasClick);
    void mount();

    return () => {
      disposed = true;
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('click', onCanvasClick);
      if (app) {
        app.ticker.remove(update);
        // 先解绑所有 filter，再移除 stage 子节点；最后 destroy 且不销毁
        // texture/textureSource。Pixi 8 的 TexturePool 不能在 GLSL 仍绑定
        // 纹理时清理 source，否则会卡死 WebGL 上下文。
        detachFilters(app.stage);
        app.stage.removeChildren();
        app.destroy(false, {
          children: true,
          texture: false,
          textureSource: false,
        });
      }
      appRef.current = null;
      syncSceneRef.current = null;
      // 不调用 textureCache.clear() / imageCache.clear()；
      // cache 是 effect 局部变量，离开作用域交给 GC。
      fisheye = null;
    };
  }, []);

  // 长驻 Application：workspace 变化只重建 stage 内容，不销毁 app。
  useEffect(() => {
    syncSceneRef.current?.();
  }, [workspace, worldThemes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (zoomState) {
        setZoomState(null);
        setZoomActive(false);
        return;
      }
      onExit?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit, zoomState]);

  return (
    <section className="project-tree" aria-label="项目树">
      <div
        className="project-tree__stage"
        style={{
          filter: DesaturationEffect.filter(desaturating),
          transition: DesaturationEffect.transition(desaturating),
        }}
      >
        <canvas
          ref={canvasRef}
          className="project-tree__canvas"
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          aria-label="项目树画布"
        />
        {!zoomActive ? (
          <div className="project-tree__vignette" style={VignetteEffect.style()} />
        ) : null}
        {ripple ? (
          <>
            <div
              className="project-tree__ripple"
              style={InvertRipple.style(
                ripple.x,
                ripple.y,
                rippleProgress,
                STAGE_WIDTH,
                STAGE_HEIGHT,
              )}
            />
            {rippleProgress > 0.8 ? (
              <div
                style={InvertRipple.exposure((rippleProgress - 0.8) / 0.2)}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {zoomState ? (
        <div
          className="project-tree__zoom"
          role="dialog"
          aria-label="放大主题图"
          onClick={() => {
            setZoomState(null);
            setZoomActive(false);
          }}
          style={{
            position: 'fixed',
            left: zoomState.expanded ? 0 : zoomState.from.left,
            top: zoomState.expanded ? 0 : zoomState.from.top,
            width: zoomState.expanded ? '100vw' : zoomState.from.width,
            height: zoomState.expanded ? '100vh' : zoomState.from.height,
            border: '3px solid #ffffff',
            boxSizing: 'border-box',
            boxShadow: '0 0 28px rgba(255,255,255,0.32)',
            backgroundColor: '#05070a',
            backgroundImage: `url("${zoomState.image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            cursor: 'zoom-out',
            zIndex: 2000,
            transition: 'left 700ms cubic-bezier(0.4, 0, 0.2, 1), top 700ms cubic-bezier(0.4, 0, 0.2, 1), width 700ms cubic-bezier(0.4, 0, 0.2, 1), height 700ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            className="project-tree__zoom-black"
            style={{ opacity: zoomState.expanded ? 1 : 0 }}
          />
        </div>
      ) : null}
    </section>
  );
}
