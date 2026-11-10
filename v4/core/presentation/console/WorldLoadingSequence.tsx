import { useEffect, useRef, useState } from 'react';
import { WorldEnterTransition } from './WorldEnterTransition';
import { WorldLoadProgressBar } from './WorldLoadProgressBar';
import { WorldPixelZoom } from './WorldPixelZoom';

interface WorldLoadingSequenceProps {
  worldName: string;
  prologue: string;
  onComplete: () => void;
}

export function WorldLoadingSequence({
  worldName,
  prologue,
  onComplete,
}: WorldLoadingSequenceProps) {
  const [stage, setStage] = useState(0);
  const [startBlur, setStartBlur] = useState(true);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const timers = [
      // 崩坏开始的前 2 秒：全屏逐渐模糊到很高程度。
      window.setTimeout(() => setStartBlur(false), 2000),
      window.setTimeout(() => setStage(1), 700),
      window.setTimeout(() => setStage(2), 1400),
      window.setTimeout(() => setStage(3), 4400),
      window.setTimeout(() => {
        setStage(4);
        completeRef.current();
      }, 5200),
    ];
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="console-loading-sequence" role="status" aria-live="polite">
      <WorldLoadProgressBar active={stage === 0} />
      <WorldPixelZoom active={stage === 1} />
      <WorldEnterTransition
        active={stage >= 2}
        flash={stage >= 3}
        worldName={worldName}
        prologue={prologue}
      />
      {startBlur ? <div className="console-loading-final-blur" aria-hidden="true" /> : null}
    </div>
  );
}
