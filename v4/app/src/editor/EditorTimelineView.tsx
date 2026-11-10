import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { EditorWorldFile } from '@core/editor/EditorWorldFile';
import type { BeatsSidecar } from '../audio/beatsSidecar';

interface EditorTimelineViewProps {
  readonly file: EditorWorldFile;
  readonly tick: number;
  readonly playheadMs: number;
  readonly selectedIds: readonly string[];
  readonly beats: BeatsSidecar | null;
  readonly beatSnap: boolean;
  readonly onBeatSnapChange: (enabled: boolean) => void;
  readonly audioAssets: readonly { readonly id: string; readonly label: string }[];
  readonly layerAudio: Readonly<Record<string, string | null>>;
  readonly onLayerAudioClear: (layerIndex: number) => void;
  readonly onSelect: (
    keyframeId: string,
    mode?: 'replace' | 'add' | 'range',
  ) => void;
  readonly onSelectMany: (keyframeIds: readonly string[], additive?: boolean) => void;
  readonly onBindAsset: (keyframeId: string, assetId: string) => void;
  readonly onDropAsset: (layerIndex: number, timeMs: number, assetId: string) => void;
  readonly selectedAssetId: string | null;
  readonly onSeek: (timeMs: number) => void;
  readonly onAdd: (layerIndex: number, timeMs: number) => void;
  readonly onChange: () => void;
}

const LANE_WIDTH = 1000;
const ROWS = [1, 2, 3] as const;

function layerLabel(layer: number): string {
  return layer === 3 ? 'LAYER 3+' : `LAYER ${layer}`;
}

/**
 * DOM 时间轴：E 层 EditorTimeline 负责时间↔x、缩放、吸附、拖拽阈值。
 * 这里只做 lane 坐标归一化与视觉渲染。
 */
export function EditorTimelineView({
  file,
  tick,
  playheadMs,
  selectedIds,
  beats,
  beatSnap,
  onBeatSnapChange,
  audioAssets,
  layerAudio,
  onLayerAudioClear,
  onSelect,
  onSelectMany,
  onBindAsset,
  onDropAsset,
  selectedAssetId,
  onSeek,
  onAdd,
  onChange,
}: EditorTimelineViewProps) {
  const timeline = file.timeline;
  const beatTimes = beats?.beatsMs ?? [];
  const downbeatTimes = new Set(beats?.downbeatsMs ?? []);
  const snapTime = (timeMs: number): number => {
    const base = timeline.snap(timeMs);
    if (!beatSnap || beatTimes.length === 0) return base;
    let nearest = beatTimes[0] ?? base;
    let distance = Math.abs(nearest - base);
    for (const beat of beatTimes) {
      const nextDistance = Math.abs(beat - base);
      if (nextDistance < distance) {
        nearest = beat;
        distance = nextDistance;
      }
    }
    return distance <= 120 ? nearest : base;
  };
  const frameTime = (keyframeId: string, fallback: number): number => (
    dragPreviews.get(keyframeId)
    ?? (dragPreview?.id === keyframeId ? dragPreview.timeMs : fallback)
  );
  const audioLabel = (assetId: string | null): string => {
    if (!assetId) return 'DROP AUDIO';
    return audioAssets.find((asset) => asset.id === assetId)?.label ?? assetId;
  };
  const railRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; timeMs: number } | null>(null);
  const [dragGroup, setDragGroup] = useState(false);
  const [dragPreviews, setDragPreviews] = useState<ReadonlyMap<string, number>>(new Map());
  const [assetOverLayer, setAssetOverLayer] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeActive = marquee !== null;

  const laneX = (clientX: number): number => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return ((clientX - rect.left) / rect.width) * LANE_WIDTH;
  };

  const seekFromEvent = (event: { clientX: number }): void => {
    const timeMs = snapTime(timeline.timeAtX(laneX(event.clientX)));
    timeline.setPlayhead(timeMs);
    onSeek(timeMs);
  };

  useEffect(() => {
    if (!dragId) return;
    const onMove = (event: PointerEvent): void => {
      try {
        const rect = railRef.current?.getBoundingClientRect();
        if (rect) {
          if (event.clientX < rect.left + 28) timeline.panForDrag(-80);
          else if (event.clientX > rect.right - 28) timeline.panForDrag(80);
        }
        if (dragGroup) {
          const result = file.updateKeyframeGroupDrag(
            { x: laneX(event.clientX), y: event.clientY },
            {
              altKey: event.altKey,
              frameDurationMs: 1000 / 24,
              snapTargetMs: snapTime(timeline.timeAtX(laneX(event.clientX))),
            },
          );
          if (result) {
            setDragPreviews(new Map(
              [...result.previews.entries()].map(([id, keyframe]) => [id, keyframe.timeMs]),
            ));
            setDragPreview({ id: dragId, timeMs: result.primaryTimeMs });
          }
          onChange();
          return;
        }
        const result = file.updateKeyframeDrag(
          { x: laneX(event.clientX), y: event.clientY },
          {
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            // 时间轴拖拽只取 X；不因纵向移动换轨，避免拖动被打断。
            targetLayerIndex: null,
            frameDurationMs: 1000 / 24,
            snapTargetMs: snapTime(timeline.timeAtX(laneX(event.clientX))),
          },
        );
        if (result) setDragPreview({ id: dragId, timeMs: result.timeMs });
        onChange();
      } catch {
        // 越界或瞬时非法时间由 E 层拒绝；保留当前预览。
      }
    };
    const finish = (): void => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    const onUp = (): void => {
      if (dragGroup) file.commitKeyframeGroupDrag();
      else file.commitKeyframeDrag();
      setDragId(null);
      setDragPreview(null);
      setDragGroup(false);
      setDragPreviews(new Map());
      finish();
      onChange();
    };
    const onCancel = (): void => {
      if (dragGroup) file.cancelKeyframeGroupDrag();
      else file.cancelKeyframeDrag();
      setDragId(null);
      setDragPreview(null);
      setDragGroup(false);
      setDragPreviews(new Map());
      finish();
      onChange();
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      finish();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [dragGroup, dragId, file, onChange]);

  useEffect(() => {
    if (!marqueeActive) return;
    const onMove = (event: PointerEvent): void => {
      const rect = tracksRef.current?.getBoundingClientRect();
      const start = marqueeStartRef.current;
      if (!rect || !start) return;
      setMarquee({
        startX: start.x,
        startY: start.y,
        x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
        y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
      });
    };
    const onUp = (event: PointerEvent): void => {
      const rect = tracksRef.current?.getBoundingClientRect();
      const start = marqueeStartRef.current;
      if (rect && start) {
        const endX = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
        const endY = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
        const minX = Math.min(start.x, endX);
        const maxX = Math.max(start.x, endX);
        const minY = Math.min(start.y, endY);
        const maxY = Math.max(start.y, endY);
        const timeStart = timeline.timeAtX((minX / rect.width) * LANE_WIDTH);
        const timeEnd = timeline.timeAtX((maxX / rect.width) * LANE_WIDTH);
        const layerStart = Math.min(...ROWS.filter((_, index) => (
          (index + 1) * 54 >= minY
        )));
        const layerEnd = Math.max(...ROWS.filter((_, index) => (
          index * 54 <= maxY
        )));
        const ids = file.tracks
          .filter((track) => track.layerIndex >= layerStart && track.layerIndex <= layerEnd)
          .flatMap((track) => track.keyframes)
          .filter((keyframe) => (
            keyframe.timeMs >= timeStart && keyframe.timeMs <= timeEnd
          ))
          .map((keyframe) => keyframe.keyframeId);
        onSelectMany(ids, event.shiftKey);
      }
      marqueeStartRef.current = null;
      setMarquee(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [marqueeActive, file, onSelectMany, timeline]);

  const beginDrag = (event: ReactPointerEvent, keyframeId: string): void => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const group = selectedIds.length > 1 && selectedIds.includes(keyframeId);
    if (!group) {
      onSelect(
        keyframeId,
        event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey ? 'add' : 'replace'),
      );
    }
    if (group) {
      file.beginKeyframeGroupDrag(selectedIds, {
        x: laneX(event.clientX),
        y: event.clientY,
      });
      setDragPreviews(new Map(selectedIds.map((id) => [
        id,
        file.getKeyframe(id)?.keyframe.timeMs ?? 0,
      ])));
    } else {
      file.beginKeyframeDrag(keyframeId, {
        x: laneX(event.clientX),
        y: event.clientY,
      });
    }
    setDragGroup(group);
    setDragId(keyframeId);
    onChange();
  };

  const ticks = Array.from({ length: 11 }, (_, index) => {
    const ratio = index / 10;
    const timeMs = timeline.viewStart + (timeline.viewEnd - timeline.viewStart) * ratio;
    return {
      index,
      timeMs,
      left: `${ratio * 100}%`,
      label: `${(timeMs / 1000).toFixed(1)}s`,
    };
  });

  const onWheel = (event: ReactWheelEvent): void => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const anchor = laneX(event.clientX);
      const next = timeline.pxPerMs * Math.exp(-event.deltaY * 0.0015);
      timeline.zoomAt(anchor, next);
      onChange();
      return;
    }
    // 新编辑器约定：滚轮移动时间戳；Ctrl+滚轮才缩放。
    const direction = event.deltaY > 0 ? 1 : -1;
    onSeek(Math.min(
      timeline.durationMs,
      Math.max(0, playheadMs + direction * (event.shiftKey ? 500 : 100)),
    ));
  };

  return (
    <section className="editor-timeline" aria-label="Editor timeline" onWheel={onWheel}>
      <header className="editor-timeline__bar">
        <div>
          <span className="editor-eyebrow">TIMELINE</span>
          <strong>{(playheadMs / 1000).toFixed(2)}s</strong>
        </div>
        <div className="editor-timeline__meta">
          <span>A/D · ←→ MOVE · WHEEL SEEK</span>
          <span>{timeline.pxPerMs.toFixed(3)} px/ms</span>
          {dragPreview ? (
            <span className="editor-timeline__snap">
              SNAP {Math.round(dragPreview.timeMs)}ms
            </span>
          ) : null}
          <button
            type="button"
            className={`editor-timeline__beat-snap${beatSnap ? ' is-active' : ''}`}
            onClick={() => onBeatSnapChange(!beatSnap)}
          >
            BEAT SNAP {beatSnap ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            className="editor-timeline__add"
            onClick={() => onAdd(1, playheadMs)}
          >
            + KEY
          </button>
        </div>
      </header>

      <div
        ref={railRef}
        className="editor-timeline__ruler"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          seekFromEvent(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) seekFromEvent(event);
        }}
      >
        {ticks.map((tickItem) => (
          <span key={tickItem.index} className="editor-timeline__tick" style={{ left: tickItem.left }}>
            <i />
            <em>{tickItem.label}</em>
          </span>
        ))}
        <span
          className="editor-timeline__playhead"
          style={{
            left: `${(timeline.xAtTime(playheadMs) / LANE_WIDTH) * 100}%`,
          }}
        >
          <i />
        </span>
      </div>

      <div className="editor-timeline__labels">
        {ROWS.map((layer) => {
          const bound = layerAudio[String(layer)] ?? null;
          return (
            <span
              key={layer}
              className="editor-timeline__layer-label"
              data-layer-audio-drop={layer}
              title={bound ? `Layer Audio: ${audioLabel(bound)}` : '拖入音频资产绑定该层'}
            >
              <b>{layerLabel(layer)}</b>
              <em>{audioLabel(bound)}</em>
              {bound ? (
                <button
                  type="button"
                  aria-label={`清除 Layer ${layer} 音频`}
                  onClick={() => onLayerAudioClear(layer)}
                >
                  ×
                </button>
              ) : null}
            </span>
          );
        })}
      </div>

      <div ref={tracksRef} className="editor-timeline__tracks">
        {beatTimes.length > 0 ? (
          <div className="editor-timeline__beat-grid" aria-hidden="true">
            {beatTimes.map((time, index) => (
              <i
                key={`${time}-${index}`}
                className={downbeatTimes.has(time) ? 'is-downbeat' : ''}
                style={{ left: `${(timeline.xAtTime(time) / LANE_WIDTH) * 100}%` }}
              />
            ))}
          </div>
        ) : null}
        {ROWS.map((layer) => {
          const track = file.trackForLayer(layer);
          const keyframes = track?.keyframes ?? [];
          return (
            <div
              key={layer}
              className={`editor-timeline__track editor-timeline__track--l${layer}${assetOverLayer === layer ? ' is-asset-over' : ''}`}
              data-track-layer={layer}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
                setAssetOverLayer(layer);
              }}
              onDragLeave={() => setAssetOverLayer(null)}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setAssetOverLayer(null);
                const assetId = event.dataTransfer.getData('application/x-neurou-asset')
                  || event.dataTransfer.getData('text/plain');
                if (!assetId) return;
                const timeMs = snapTime(timeline.timeAtX(laneX(event.clientX)));
                onDropAsset(layer, timeMs, assetId);
              }}
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) return;
                const rect = tracksRef.current?.getBoundingClientRect();
                if (!rect) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                const start = {
                  x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
                  y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
                };
                marqueeStartRef.current = start;
                setMarquee({ startX: start.x, startY: start.y, x: start.x, y: start.y });
              }}
              onDoubleClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const timeMs = snapTime(timeline.timeAtX(laneX(event.clientX)));
                onAdd(layer, timeMs);
              }}
            >
              {keyframes.map((keyframe) => (
                <span
                  key={`${keyframe.keyframeId}-bar`}
                  className="editor-keyframe__bar"
                  style={{
                    left: `${(timeline.xAtTime(
                      frameTime(keyframe.keyframeId, keyframe.timeMs),
                    ) / LANE_WIDTH) * 100}%`,
                    width: `${((timeline.xAtTime(
                      frameTime(keyframe.keyframeId, keyframe.timeMs) + keyframe.durationMs,
                    ) - timeline.xAtTime(
                      frameTime(keyframe.keyframeId, keyframe.timeMs),
                    )) / LANE_WIDTH) * 100}%`,
                  }}
                />
              ))}
              {keyframes.slice(0, -1).map((keyframe, index) => {
                const next = keyframes[index + 1];
                const start = timeline.xAtTime(
                  frameTime(keyframe.keyframeId, keyframe.timeMs),
                );
                const end = timeline.xAtTime(
                  frameTime(next.keyframeId, next.timeMs),
                );
                return (
                  <span
                    key={`${keyframe.keyframeId}-link`}
                    className="editor-keyframe__link"
                    style={{
                      left: `${(start / LANE_WIDTH) * 100}%`,
                      width: `${((end - start) / LANE_WIDTH) * 100}%`,
                    }}
                  />
                );
              })}
              {keyframes.map((keyframe) => (
                <button
                  key={keyframe.keyframeId}
                  type="button"
                  className={`editor-keyframe editor-keyframe--l${layer}${selectedIds.includes(keyframe.keyframeId) ? ' is-selected' : ''}`}
                  data-keyframe-id={keyframe.keyframeId}
                  style={{
                    left: `${Math.max(0.6, (timeline.xAtTime(
                      frameTime(keyframe.keyframeId, keyframe.timeMs),
                    ) / LANE_WIDTH) * 100)}%`,
                  }}
                  title={`${(keyframe.timeMs / 1000).toFixed(2)}s · layer ${layer}`}
                  onPointerDown={(event) => beginDrag(event, keyframe.keyframeId)}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (selectedAssetId) {
                      onBindAsset(keyframe.keyframeId, selectedAssetId);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const assetId = event.dataTransfer.getData('text/plain');
                    if (assetId) onBindAsset(keyframe.keyframeId, assetId);
                  }}
                >
                  <i />
                </button>
              ))}
            </div>
          );
        })}
        {marquee ? (
          <span
            className="editor-timeline__marquee"
            style={{
              left: Math.min(marquee.startX, marquee.x),
              top: Math.min(marquee.startY, marquee.y),
              width: Math.abs(marquee.x - marquee.startX),
              height: Math.abs(marquee.y - marquee.startY),
            }}
          />
        ) : null}
        <span
          className="editor-timeline__playhead editor-timeline__playhead--body"
          style={{
            left: `${(timeline.xAtTime(playheadMs) / LANE_WIDTH) * 100}%`,
          }}
        />
      </div>
    </section>
  );
}
