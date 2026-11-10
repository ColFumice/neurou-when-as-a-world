import type { RainModeState } from '../../world/types';
import { ConsoleEffect } from './ConsoleEffect';
import rainSettingsView from './rainSettingsModel';

interface SettingsConsoleProps {
  effect: ConsoleEffect;
  onChange: (effect: ConsoleEffect) => void;
  onClose: () => void;
  readonly rainEnabled?: boolean;
  readonly rainState?: RainModeState | null;
  readonly onRainEnabledChange?: (enabled: boolean) => void;
  readonly onRainRefresh?: () => void;
}

export function SettingsConsole({
  effect,
  onChange,
  onClose,
  rainEnabled = false,
  rainState = null,
  onRainEnabledChange = () => undefined,
  onRainRefresh = () => undefined,
}: SettingsConsoleProps) {
  const rain = rainSettingsView(rainEnabled, rainState);

  return (
    <section
      className="console-settings"
      role="dialog"
      aria-label="console 设置"
    >
      <header className="console-settings__header">
        <span>SETTINGS / CONSOLE</span>
        <button type="button" role="button" onClick={onClose} aria-label="关闭设置">
          ×
        </button>
      </header>

      <div className="console-settings__group">
        <p className="console-settings__label">ConsoleEffect</p>
        <div className="console-settings__effects">
          {Object.values(ConsoleEffect).map((value) => (
            <button
              key={value}
              type="button"
              role="button"
              className={value === effect ? 'is-active' : ''}
              aria-pressed={value === effect}
              onClick={() => onChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="console-settings__group console-settings__rain">
        <p className="console-settings__label">Rain</p>
        <div className="console-settings__rain-row">
          <span>Rain follow IP weather</span>
          <button
            type="button"
            role="switch"
            aria-checked={rainEnabled}
            className={rainEnabled ? 'is-active' : ''}
            onClick={() => onRainEnabledChange(!rainEnabled)}
          >
            {rainEnabled ? 'DISABLE' : 'ENABLE'}
          </button>
        </div>
        <div className={`console-settings__rain-status is-${rain.status.toLowerCase().replaceAll(' ', '-')}`}>
          <span>{rain.status}</span>
          {rain.reason ? <small>DEGRADED / {rain.reason}</small> : null}
        </div>
        <div className="console-settings__rain-actions">
          <button type="button" onClick={onRainRefresh}>Manual Refresh</button>
          <button type="button" onClick={() => onRainEnabledChange(!rainEnabled)}>
            {rainEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      <div className="console-settings__group console-settings__placeholder">
        <p className="console-settings__label">其他设置</p>
        <p>R3.3b-2 占位；后续接主题、字体与输入映射。</p>
      </div>
    </section>
  );
}
