import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CycleWarning } from '@core/eventgraph/RandomMode';
import { neuModuleLabel } from './types';
import type { NeuModule, NeuModuleType } from './types';

/** 只有 target 能沿图回到 source 的边才算循环路径；R→L 作为隐式回接参与搜索。 */
function collectCycleEdges(modules: readonly NeuModule[]): Set<string> {
  const byId = new Map(modules.map((module) => [module.moduleId, module]));
  const adjacency = new Map<string, string[]>();
  for (const module of modules) {
    const targets: string[] = [];
    for (const output of module.outputs) {
      for (const target of output.targets) {
        if (byId.has(target.moduleId)) targets.push(target.moduleId);
      }
    }
    const idMatch = /^channel-right-(\d+)$/.exec(module.moduleId);
    if (module.type === 'Channel' && idMatch) {
      const leftId = `channel-left-${idMatch[1]}`;
      if (byId.has(leftId)) targets.push(leftId);
    }
    adjacency.set(module.moduleId, targets);
  }

  const canReach = (start: string, goal: string): boolean => {
    const stack = [start];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (id === goal) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const next of adjacency.get(id) ?? []) stack.push(next);
    }
    return false;
  };

  const result = new Set<string>();
  for (const module of modules) {
    for (const output of module.outputs) {
      for (const target of output.targets) {
        if (!byId.has(target.moduleId)) continue;
        if (canReach(target.moduleId, module.moduleId)) {
          result.add(`${module.moduleId}->${target.moduleId}`);
        }
      }
    }
  }
  return result;
}

interface EventBlueprintProps {
  readonly modules: readonly NeuModule[];
  readonly selectedModuleId: string | null;
  readonly onMoveModule: (moduleId: string, x: number, y: number) => void;
  readonly onDragEnd: (moduleId: string) => void;
  readonly onDeleteModule: (moduleId: string) => void;
  readonly onRemoveConnection: (sourceModuleId: string, targetModuleId: string) => void;
  readonly onSelectModule: (moduleId: string) => void;
  readonly onOpenInspector: (moduleId: string) => void;
  readonly onDropModule: (type: NeuModuleType, label: string, x: number, y: number) => void;
  readonly onBlankClick: () => void;
  readonly panX: number;
  readonly selectedAssetId: string | null;
  readonly activeModuleIds: readonly string[];
  readonly onConnect: (sourceModuleId: string, targetModuleId: string) => void;
  readonly onConnectChannel: (side: 'left' | 'right', port: number, moduleId: string) => void;
  readonly cycleWarnings: readonly CycleWarning[];
}

function assetPayload(assetId: string): { type: NeuModuleType; label: string } | null {
  const map: Record<string, { type: NeuModuleType; label: string }> = {
    'asset:audio:main': { type: 'Audio', label: 'theme.wav' },
    'asset:video:foreground': { type: 'Video', label: 'rain-night-right-loop.mp4 / 时间驱动' },
    'asset:guidance:head-logo': { type: 'Image', label: 'head-logo' },
    'asset:event:interface': { type: 'AND', label: '事件接口' },
    'asset:subtitle:default': { type: 'Subtitle', label: '字幕' },
    'asset:mark:trace': { type: 'AND', label: '痕 / Trace' },
  };
  return map[assetId] ?? null;
}


function kindFromTransfer(value: string): { type: NeuModuleType; label: string } | null {
  const map: Record<string, { type: NeuModuleType; label: string }> = {
    'neu:rhythm': { type: 'RhythmPoint', label: '节奏点' },
    'neu:video': { type: 'Video', label: '视频 / 时间驱动' },
    'neu:videostatic': { type: 'VideoStatic', label: '视频 / 冻结帧' },
    'neu:image': { type: 'Image', label: '图片' },
    'neu:audio': { type: 'Audio', label: '音频' },
    'neu:subtitle': { type: 'Subtitle', label: '字幕' },
    'neu:and': { type: 'AND', label: '与 / AND' },
    'neu:or': { type: 'OR', label: '或 / OR' },
    'neu:not': { type: 'NOT', label: '非 / NOT' },
    'neu:delay': { type: 'Delay', label: '延时 / Delay' },
    'neu:random': { type: 'Random', label: '随机 / Random' },
    'neu:effect': { type: 'Effect', label: '动效' },
    'neu:light': { type: 'Light', label: '光效' },
  };
  return map[value] ?? null;
}

/** NEU 事件蓝图：左右接口列 + 可拖动模块 + 顺序曲线。 */
export function EventBlueprint({
  modules,
  selectedModuleId,
  onMoveModule,
  onDragEnd,
  onDeleteModule,
  onRemoveConnection,
  onSelectModule,
  onOpenInspector,
  onDropModule,
  onBlankClick,
  panX,
  selectedAssetId,
  activeModuleIds,
  onConnect,
  onConnectChannel,
  cycleWarnings,
}: EventBlueprintProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [connection, setConnection] = useState<{
    fromId: string;
    side: 'in' | 'out';
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const connectionRef = useRef<{
    fromId: string;
    side: 'in' | 'out';
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const connectionCleanupRef = useRef<(() => void) | null>(null);
  const lastModuleClickRef = useRef<{ id: string; at: number } | null>(null);
  const openInspectorTimerRef = useRef<number | null>(null);

  const clearOpenInspector = (): void => {
    if (openInspectorTimerRef.current !== null) {
      window.clearTimeout(openInspectorTimerRef.current);
      openInspectorTimerRef.current = null;
    }
  };

  useEffect(() => () => clearOpenInspector(), []);
  const [drag, setDrag] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const [channelScrollTop, setChannelScrollTop] = useState(0);
  const scrollExtent = 4200;
  const channelPorts = Array.from(
    {
      length: Math.max(6, Math.ceil((channelScrollTop + 360) / 62)),
    },
    (_, index) => index + 1,
  );
  const [moduleBoxes, setModuleBoxes] = useState<Record<string, {
    left: number;
    right: number;
    y: number;
    inX: number;
    inY: number;
    outX: number;
    outY: number;
  }>>({});
  const cycleEdges = useMemo(() => collectCycleEdges(modules), [modules]);

  useLayoutEffect(() => {
    const measure = (): void => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const boxes: Record<string, {
        left: number;
        right: number;
        y: number;
        inX: number;
        inY: number;
        outX: number;
        outY: number;
      }> = {};
      canvas.querySelectorAll<HTMLElement>('[data-channel-id]').forEach((element) => {
        const rect = element.getBoundingClientRect();
        const x = ((rect.left + rect.width / 2 - canvas.getBoundingClientRect().left) / canvas.getBoundingClientRect().width) * 100;
        const y = ((rect.top + rect.height / 2 - canvas.getBoundingClientRect().top) / canvas.getBoundingClientRect().height) * 100;
        boxes[element.dataset.channelId ?? ''] = {
          left: x, right: x, y,
          inX: x, inY: y, outX: x, outY: y,
        };
      });
      canvas.querySelectorAll<HTMLElement>('[data-module-id]').forEach((element) => {
        const moduleRect = element.getBoundingClientRect();
        const inputRect = element.querySelector<HTMLElement>('[data-port-in]')?.getBoundingClientRect();
        const outputRect = element.querySelector<HTMLElement>('[data-port-out]')?.getBoundingClientRect();
        const percentX = (value: number): number => ((value - rect.left) / rect.width) * 100;
        const percentY = (value: number): number => ((value - rect.top) / rect.height) * 100;
        boxes[element.dataset.moduleId ?? ''] = {
          left: percentX(moduleRect.left),
          right: percentX(moduleRect.right),
          y: percentY(moduleRect.top + moduleRect.height / 2),
          inX: inputRect ? percentX(inputRect.left + inputRect.width / 2) : percentX(moduleRect.left),
          inY: inputRect ? percentY(inputRect.top + inputRect.height / 2) : percentY(moduleRect.top + moduleRect.height / 2),
          outX: outputRect ? percentX(outputRect.left + outputRect.width / 2) : percentX(moduleRect.right),
          outY: outputRect ? percentY(outputRect.top + outputRect.height / 2) : percentY(moduleRect.top + moduleRect.height / 2),
        };
      });
      setModuleBoxes(boxes);
    };
    const frame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frame);
  }, [modules, panX]);

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent): void => {
      if (!dragMovedRef.current
        && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) {
        return;
      }
      if (!dragMovedRef.current) {
        dragMovedRef.current = true;
        setDrag((current) => (current ? { ...current, moved: true } : current));
      }
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = event.clientX - drag.offsetX;
      const top = event.clientY - drag.offsetY;
      onMoveModule(
        drag.id,
        Math.min(0.92, Math.max(0.08, (left - rect.left - panX) / rect.width)),
        Math.min(0.9, Math.max(0.1, (top - rect.top) / rect.height)),
      );
    };
    const up = (): void => {
      const id = drag.id;
      const moved = dragMovedRef.current;
      dragMovedRef.current = false;
      setDrag(null);
      if (moved) {
        clearOpenInspector();
        onDragEnd(id);
        return;
      }
      clearOpenInspector();
      openInspectorTimerRef.current = window.setTimeout(() => {
        openInspectorTimerRef.current = null;
        onOpenInspector(id);
      }, 500);
    };
    const cancel = (): void => {
      clearOpenInspector();
      dragMovedRef.current = false;
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [drag, onMoveModule, onDragEnd, onOpenInspector, panX]);

  const startConnection = (
    fromId: string,
    event: ReactPointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
    side: 'in' | 'out' = 'out',
  ): void => {
    event.stopPropagation();
    event.preventDefault();
    if (connectionRef.current) return;
    try {
      const pointerEvent = event as ReactPointerEvent<HTMLElement>;
      if ('setPointerCapture' in event.currentTarget && pointerEvent.pointerId !== undefined) {
        event.currentTarget.setPointerCapture(pointerEvent.pointerId);
      }
    } catch {
      // capture is optional
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const next = {
      fromId,
      side,
      startX: event.clientX,
      startY: event.clientY,
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
      moved: false,
    };
    connectionCleanupRef.current?.();
    connectionRef.current = next;
    setConnection(next);
    let finished = false;
    const move = (moveEvent: PointerEvent | MouseEvent): void => {
      const current = connectionRef.current;
      if (!canvas || !current) return;
      const currentRect = canvas.getBoundingClientRect();
      const moved = {
        ...current,
        x: ((moveEvent.clientX - currentRect.left) / currentRect.width) * 100,
        y: ((moveEvent.clientY - currentRect.top) / currentRect.height) * 100,
        moved: current.moved
          || Math.hypot(moveEvent.clientX - current.startX, moveEvent.clientY - current.startY) > 4,
      };
      connectionRef.current = moved;
      setConnection(moved);
    };
    const up = (upEvent: PointerEvent | MouseEvent): void => {
      if (finished) return;
      finished = true;
      const current = connectionRef.current;
      const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
      const hitModule = target?.closest<HTMLElement>('[data-module-id]')
        ?? Array.from(document.querySelectorAll<HTMLElement>('[data-module-id]')).find((element) => {
          const rect = element.getBoundingClientRect();
          return upEvent.clientX >= rect.left && upEvent.clientX <= rect.right
            && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom;
        });
      const hitChannel = target?.closest<HTMLElement>('[data-channel-id]')
        ?? Array.from(document.querySelectorAll<HTMLElement>('[data-channel-id]')).find((element) => {
          const rect = element.getBoundingClientRect();
          return upEvent.clientX >= rect.left && upEvent.clientX <= rect.right
            && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom;
        });
      const targetId = hitModule?.dataset.moduleId;
      if (!current) {
        return;
      }
      if (current.moved && hitChannel?.dataset.channelId && !/^channel-/.test(current.fromId)) {
        const channelMatch = /^channel-(left|right)-(\d+)$/.exec(hitChannel.dataset.channelId);
        if (channelMatch) {
          onConnectChannel(
            channelMatch[1] as 'left' | 'right',
            Number(channelMatch[2]),
            current.fromId,
          );
        }
      } else if (current.moved && targetId && targetId !== current.fromId) {
        const channelMatch = /^channel-(left|right)-(\d+)$/.exec(current.fromId);
        if (channelMatch) {
          onConnectChannel(
            channelMatch[1] as 'left' | 'right',
            Number(channelMatch[2]),
            targetId,
          );
        } else if (current.side === 'out') onConnect(current.fromId, targetId);
        else onConnect(targetId, current.fromId);
      }
      connectionRef.current = null;
      connectionCleanupRef.current = null;
      setConnection(null);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('mouseup', up, true);
    };
    connectionCleanupRef.current = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('mouseup', up, true);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('mouseup', up, true);
  };

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const payload = kindFromTransfer(event.dataTransfer.getData('application/x-neu-module'))
      ?? assetPayload(
        event.dataTransfer.getData('application/x-neurou-asset')
        || event.dataTransfer.getData('text/plain'),
      );
    if (!payload) return;
    onDropModule(
      payload.type,
      payload.label,
      Math.min(0.92, Math.max(0.08, (event.clientX - rect.left - panX) / rect.width)),
      Math.min(0.9, Math.max(0.1, (event.clientY - rect.top) / rect.height)),
    );
  };

  return (
    <section className="editor-blueprint" aria-label="NEU event blueprint">
      <div className="editor-blueprint__head">
        <span>NEU / EVENT BLUEPRINT</span>
        <span>拖入模块 · 顺序连线</span>
      </div>
      <div
        ref={canvasRef}
        className="editor-blueprint__canvas"
        style={{ '--blueprint-pan': `${panX}px` } as React.CSSProperties}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          clearOpenInspector();
          onBlankClick();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={onDrop}
        data-drop-blueprint
        onScroll={(event) => {
          setChannelScrollTop(event.currentTarget.scrollTop);
        }}
      >
        <div className="editor-blueprint__ports editor-blueprint__ports--in">
          {channelPorts.map((port) => (
            <button
              key={port}
              type="button"
              className="editor-blueprint__channel"
              data-channel-id={`channel-left-${port}`}
              title={`总通道 L${port} · 拖到模块连线`}
              onPointerDown={(event) => startConnection(`channel-left-${port}`, event, 'out')}
            >
              {port}
            </button>
          ))}
        </div>
        <div className="editor-blueprint__ports editor-blueprint__ports--out">
          {channelPorts.map((port) => (
            <button
              key={port}
              type="button"
              className="editor-blueprint__channel"
              data-channel-id={`channel-right-${port}`}
              title={`总通道 R${port} · 拖到模块连线`}
              onPointerDown={(event) => startConnection(`channel-right-${port}`, event, 'out')}
            >
              {port}
            </button>
          ))}
        </div>

        <svg className="editor-blueprint__curves" viewBox="0 0 100 100" preserveAspectRatio="none">
          {modules.flatMap((module) => module.outputs.flatMap((output) => (
            output.targets.map((target) => {
              const next = modules.find((item) => item.moduleId === target.moduleId);
              if (!next) return null;
              const from = moduleBoxes[module.moduleId];
              const to = moduleBoxes[next.moduleId];
              const x1 = from?.outX ?? (module.x * 100 + 8);
              const y1 = from?.outY ?? (module.y * 100);
              const x2 = to?.inX ?? (next.x * 100 - 2);
              const y2 = to?.inY ?? (next.y * 100);
              const active = cycleEdges.has(`${module.moduleId}->${next.moduleId}`)
                && activeModuleIds.includes(module.moduleId);
              return (
                <g key={`${module.moduleId}-${output.port}-${target.moduleId}-${target.port}`}>
                <path
                  className={`editor-blueprint__curve${active ? ' is-active' : ''}`}
                  d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={active ? 'rgba(245, 252, 255, 0.96)' : 'rgba(196, 228, 255, 0.55)'}
                  strokeWidth={active ? '1.8' : '0.8'}
                  vectorEffect="non-scaling-stroke"
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onRemoveConnection(module.moduleId, next.moduleId);
                  }}
                />
                <path
                  d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onRemoveConnection(module.moduleId, next.moduleId);
                  }}
                />
                </g>
              );
            })
          )))}
          {connection?.moved ? (() => {
            const source = moduleBoxes[connection.fromId];
            const x1 = connection.side === 'out' ? (source?.outX ?? 0) : (source?.inX ?? 0);
            const y1 = connection.side === 'out' ? (source?.outY ?? 0) : (source?.inY ?? 0);
            return (
              <path
                d={`M ${x1} ${y1} C ${(x1 + connection.x) / 2} ${y1}, ${(x1 + connection.x) / 2} ${connection.y}, ${connection.x} ${connection.y}`}
                fill="none"
                stroke="rgba(245, 252, 255, 0.92)"
                strokeWidth="1.1"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            );
          })() : null}
        </svg>

        {modules.filter((module) => module.type !== 'Channel').map((module, index) => {
          const cycleWarning = cycleWarnings.some((warning) => warning.moduleId === module.moduleId);
          return (
          <div
            key={module.moduleId}
            className={`editor-neu-module editor-neu-module--${module.type === 'RhythmPoint' ? 'rhythm' : module.type === 'Light' ? (module.params.mode === 'Local' ? 'lightlocal' : 'lightfull') : module.type.toLowerCase()}${selectedModuleId === module.moduleId ? ' is-selected' : ''}${activeModuleIds.includes(module.moduleId) ? ' is-active' : ''}${cycleWarning ? ' is-cycle-warning' : ''}${drag?.id === module.moduleId && drag.moved ? ' is-dragging' : ''}`}
            data-module-id={module.moduleId}
            style={{ left: `${module.x * 100}%`, top: `${module.y * 100}%` }}
            onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
              event.stopPropagation();
              event.preventDefault();
              if ((event.target as HTMLElement).closest('[data-port-in], [data-port-out]')) {
                return;
              }
              const now = performance.now();
              clearOpenInspector();
              const last = lastModuleClickRef.current;
              if (last && last.id === module.moduleId && now - last.at < 700) {
                lastModuleClickRef.current = null;
                onDeleteModule(module.moduleId);
                return;
              }
              lastModuleClickRef.current = { id: module.moduleId, at: now };
              dragMovedRef.current = false;
              onSelectModule(module.moduleId);
              const rect = event.currentTarget.getBoundingClientRect();
              setDrag({
                id: module.moduleId,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
              });
            }}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              if ((event.target as HTMLElement).closest('[data-port-in], [data-port-out]')) {
                return;
              }
              event.stopPropagation();
              clearOpenInspector();
              onDeleteModule(module.moduleId);
            }}
          >
            <button
              type="button"
              data-port-in
              className="editor-neu-module__port editor-neu-module__port--in"
              aria-label="input"
              onPointerDown={(event) => startConnection(module.moduleId, event, 'in')}
              onMouseDown={(event) => startConnection(module.moduleId, event, 'in')}
            />
            <span className="editor-neu-module__index">{String(index + 1).padStart(2, '0')}</span>
            <span className="editor-neu-module__label">{neuModuleLabel(module)}</span>
            <span className="editor-neu-module__kind">{module.type}</span>
            {module.type === 'NOT' ? (
              <span className="editor-neu-module__hint">本 tick 无输入时触发下游</span>
            ) : null}
            {cycleWarning ? (
              <span className="editor-neu-module__warning">CYCLE ×100</span>
            ) : null}
            {activeModuleIds.includes(module.moduleId) ? (
              <>
                <span className="editor-neu-module__activity" />
              </>
            ) : null}
            <button
              type="button"
              data-port-out
              className={`editor-neu-module__port editor-neu-module__port--out${connection?.moved && connection.fromId === module.moduleId ? ' is-pending' : ''}`}
              aria-label="output"
              onPointerDown={(event) => startConnection(module.moduleId, event)}
              onMouseDown={(event) => startConnection(module.moduleId, event)}
            />
          </div>
          );
        })}

        {connection?.moved ? (
          <div className="editor-blueprint__link-hint">拖到目标模块松开以连线</div>
        ) : null}
        <div
          className="editor-blueprint__scroll-space"
          style={{ height: scrollExtent }}
          aria-hidden="true"
        />
        {modules.length === 0 ? (
          <div className="editor-blueprint__empty">
            <span>EVENT GRAPH</span>
            <strong>从右栏 Modules 拖入模块</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}
