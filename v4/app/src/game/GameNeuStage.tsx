import {
  composeStageEffects,
  composeStageLights,
} from '@core/editor/runtime/EffectCompositor';
import type { ActiveLight } from '@core/editor/runtime/EffectCompositor';
import type { GameMedia } from './chartLoader';
import type {
  GamePlaybackSink,
  GameResourceOverlay,
} from './gameSignalSink';
import { GameStage } from './GameStage';

interface GameNeuStageProps {
  readonly sink: GamePlaybackSink | null;
  readonly media: GameMedia | null;
  readonly playheadMs: number;
  readonly playing: boolean;
  readonly fallbackImageUrl?: string | null;
}

function resourceFade(resource: GameResourceOverlay, playheadMs: number): number {
  const elapsed = playheadMs - resource.startMs;
  return Math.min(1, Math.max(0, (resource.durationMs - elapsed) / 260));
}

function ResourceOverlay({
  resource,
  playheadMs,
  localLights,
}: {
  readonly resource: GameResourceOverlay;
  readonly playheadMs: number;
  readonly localLights: readonly ActiveLight[];
}) {
  const matchingLights = localLights.filter(
    (light) => light.targetAssetId === resource.assetId,
  );
  const local = composeStageLights(matchingLights);
  const style = {
    opacity: resource.opacity * resourceFade(resource, playheadMs),
    filter: local.filter || undefined,
    maskImage: matchingLights.length > 0
      ? 'radial-gradient(ellipse at center, #000 52%, transparent 78%)'
      : undefined,
    WebkitMaskImage: matchingLights.length > 0
      ? 'radial-gradient(ellipse at center, #000 52%, transparent 78%)'
      : undefined,
  };

  return (
    <div
      className={`game-neu-resource game-neu-resource--${resource.kind}`}
      style={style}
      data-asset-id={resource.assetId ?? ''}
    >
      {resource.kind === 'image' ? (
        <img src={resource.src} alt="" draggable={false} />
      ) : (
        <video
          src={resource.src}
          muted
          playsInline
          preload="auto"
          autoPlay={resource.kind === 'video'}
          loop={resource.kind === 'video'}
          ref={(element) => {
            if (!element || resource.kind !== 'videoStatic') return;
            element.pause();
            try {
              element.currentTime = 0;
            } catch {
              // metadata not ready; frozen first frame still acceptable.
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * R4b.2 最小视觉 Sink：
 * - EffectCompositor 作用在 GameStage 外壳；
 * - 全屏 Light 合成 filter + overlay；
 * - Local Light 只作用于匹配的 Resource overlay；
 * - Resource / Subtitle 最小 DOM 覆盖层。
 * 不修改 R4a 的 GameStage.tsx。
 */
export function GameNeuStage({
  sink,
  media,
  playheadMs,
  playing,
  fallbackImageUrl = null,
}: GameNeuStageProps) {
  const effects = sink?.activeEffectsAt(playheadMs) ?? [];
  const effectState = composeStageEffects(effects);
  const lights = sink?.activeLightsAt(playheadMs) ?? [];
  const fullLights = lights.filter((light) => light.mode !== 'Local');
  const localLights = lights.filter((light) => light.mode === 'Local');
  const lightState = composeStageLights(fullLights);
  const combinedFilter = [effectState.filter, lightState.filter]
    .filter(Boolean)
    .join(' ');
  const resources = sink?.activeResourcesAt(playheadMs) ?? [];
  const subtitle = sink?.currentSubtitle(playheadMs) ?? null;

  return (
    <>
      <div
        className="game-neu-stage"
        style={{
          transform: effectState.transform || undefined,
          filter: combinedFilter || undefined,
          opacity: effectState.opacity,
          clipPath: effectState.clipPath || undefined,
        }}
      >
        <GameStage
          media={media}
          playheadMs={playheadMs}
          playing={playing}
          fallbackImageUrl={fallbackImageUrl}
        />
      </div>

      <div className="game-neu-resources" aria-hidden="true">
        {resources.map((resource) => (
          <ResourceOverlay
            key={resource.overlayId}
            resource={resource}
            playheadMs={playheadMs}
            localLights={localLights}
          />
        ))}
      </div>

      {media !== null ? (
        <div className="game-neu-lights" aria-hidden="true">
          {lightState.overlays.map((overlay, index) => (
            <span
              key={`${overlay.id}-${index}`}
              className={`game-neu-light game-neu-light--${overlay.kind}`}
              style={{ opacity: overlay.opacity }}
            />
          ))}
        </div>
      ) : null}

      {subtitle ? (
        <div className="game-neu-subtitle" role="status">
          {subtitle.text}
        </div>
      ) : null}
    </>
  );
}
