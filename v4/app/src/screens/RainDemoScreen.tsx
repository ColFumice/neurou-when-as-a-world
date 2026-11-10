import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  RainIntensity,
  RainModeState,
} from '@core/world/types';
import { NoteLogoGlow } from '@core/presentation/rain/NoteLogoGlow';
import { RainTintSource } from '@core/presentation/rain/RainTintSource';
import { RainLayer } from '../game/rain/RainLayer';
import { RainAudio } from '../game/rain/RainAudio';
import './rain-demo.css';

interface RainDemoScreenProps {
  readonly onBack: () => void;
}

type RainLevel = RainIntensity | null;

const LEVELS: readonly { readonly label: string; readonly value: RainLevel }[] = [
  { label: 'None', value: null },
  { label: 'Light', value: RainIntensity.Light },
  { label: 'Moderate', value: RainIntensity.Moderate },
  { label: 'Heavy', value: RainIntensity.Heavy },
];

function statusText(level: RainLevel): string {
  return level === null ? 'NONE' : `RAIN ${level.toUpperCase()}`;
}

/** R4e.2b 临时预览；不接 GameScreen，不请求天气 API。 */
export function RainDemoScreen({ onBack }: RainDemoScreenProps) {
  const [level, setLevel] = useState<RainLevel>(null);
  const audio = useMemo(() => new RainAudio(), []);

  useEffect(() => {
    const unlock = (): void => {
      if (audio.enabled) void audio.resume();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audio.dispose();
    };
  }, [audio]);

  const select = (next: RainLevel): void => {
    setLevel(next);
    if (next === null) {
      audio.setEnabled(false);
      return;
    }
    audio.setIntensity(next);
    audio.setEnabled(true);
    void audio.resume();
  };

  const rainModeState = level === null
    ? null
    : new RainModeState({
      active: true,
      intensity: level,
      lastResolvedAt: Date.now(),
      source: 'Manual',
    });

  const style = {
    '--rain-demo-tint': RainTintSource.forThemeColor('#607684'),
    '--rain-demo-tint-opacity': level === null ? '0' : level === RainIntensity.Heavy ? '0.34' : '0.22',
    '--rain-logo-glow': level === null ? 'none' : NoteLogoGlow.forIntensity(level),
  } as CSSProperties;

  return (
    <section className={`rain-demo${level === null ? '' : ' is-rain'}`} style={style}>
      <div className="rain-demo__stage">
        <div className="rain-demo__horizon" />
        <div className="rain-demo__grid" aria-hidden="true" />
        <div className="rain-demo__logo game-note-logo--rain" aria-hidden="true">N</div>
        <div className="rain-demo__copy">
          <span>NEUROU / RAIN</span>
          <strong>PRECIPITATION STUDY</strong>
          <small>IP weather → RainModeState → CSS layers</small>
        </div>
        <RainLayer rainModeState={rainModeState} worldTint="#607684" />
      </div>

      <button className="rain-demo__back" type="button" onClick={onBack}>
        ← 返回
      </button>

      <aside className="rain-demo__panel">
        <p className="rain-demo__eyebrow">R4e.2b / RAIN PREVIEW</p>
        <h1>天气视觉验证</h1>
        <p className="rain-demo__hint">
          手动强度预览；不接入 IP / 天气 API，不修改游戏 rAF。
        </p>

        <div className="rain-demo__levels" role="group" aria-label="Rain intensity">
          {LEVELS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={level === item.value ? 'is-active' : ''}
              aria-pressed={level === item.value}
              onClick={() => select(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rain-demo__status" role="status">
          <span>CURRENT</span>
          <strong>{statusText(level)}</strong>
        </div>

        <div className="rain-demo__meta">
          <span>AUDIO</span>
          <b>{level === null ? 'SILENT' : 'NOISE / BANDPASS'}</b>
          <span>MOTION</span>
          <b>PREFERS-REDUCED-MOTION RESPECTED</b>
          <span>TINT</span>
          <b>{RainTintSource.mixBlendMode} / 38%</b>
        </div>
      </aside>
    </section>
  );
}
