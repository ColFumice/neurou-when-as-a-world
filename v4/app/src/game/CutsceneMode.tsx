import { useEffect, useRef, useState } from 'react';
import type { LoadedCutscene } from './cutsceneLoader';

interface CutsceneModeProps {
  readonly data: LoadedCutscene;
  readonly onDone: (skipped: boolean) => void;
}

export function CutsceneMode({ data, onDone }: CutsceneModeProps) {
  const { definition, videoUrl, audioUrl, warnings } = data;
  const [elapsedMs, setElapsedMs] = useState(0);
  const [canSkip, setCanSkip] = useState(definition.skipAfterMs <= 0);
  const doneRef = useRef(false);
  const startedAtRef = useRef(performance.now());

  const finish = (skipped: boolean): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(skipped);
  };

  useEffect(() => {
    startedAtRef.current = performance.now();
    const tick = window.setInterval(() => {
      const next = performance.now() - startedAtRef.current;
      setElapsedMs(next);
      if (definition.skippable) {
        setCanSkip(next >= definition.skipAfterMs);
      }
      if (next >= definition.durationMs) {
        finish(false);
      }
    }, 80);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.cutsceneId, definition.durationMs, definition.skipAfterMs, definition.skippable]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === 'Escape' && definition.skippable && canSkip) {
        event.preventDefault();
        event.stopPropagation();
        finish(true);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSkip, definition.skippable]);

  const subtitle = definition.subtitles.find(
    (item) => elapsedMs >= item.startMs && elapsedMs < item.endMs,
  ) ?? null;

  return (
    <div className="game-cutscene" data-cutscene-id={definition.cutsceneId}>
      <div className="game-cutscene__backdrop" aria-hidden="true" />
      {videoUrl ? (
        <video
          className="game-cutscene__video"
          src={videoUrl}
          autoPlay
          playsInline
          muted
          onEnded={() => finish(false)}
          onError={() => finish(false)}
        />
      ) : null}
      {audioUrl ? (
        <audio
          className="game-cutscene__audio"
          src={audioUrl}
          autoPlay
          onEnded={() => finish(false)}
          onError={() => undefined}
        />
      ) : null}
      <div className="game-cutscene__copy">
        <p className="game-cutscene__eyebrow">NEUROU / CUTSCENE</p>
        <h1>{definition.cutsceneId}</h1>
        {subtitle ? <p className="game-cutscene__subtitle">{subtitle.text}</p> : null}
        {warnings.length > 0 ? (
          <p className="game-cutscene__warning">{warnings.join(' · ')}</p>
        ) : null}
        <div className="game-cutscene__footer">
          <span>{(elapsedMs / 1000).toFixed(1)}s</span>
          {definition.skippable ? (
            <button
              type="button"
              className="game-overlay__button game-cutscene__skip"
              disabled={!canSkip}
              onClick={() => finish(true)}
            >
              {canSkip ? 'SKIP / ESC' : '...'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
