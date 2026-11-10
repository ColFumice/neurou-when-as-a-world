import type { ChartKeyframe } from '@core/editor/keyframe';
import type { EditorEffectInterface, EditorEffectKind } from '@core/editor/runtime/types';
import { EditorSelect } from './EditorSelect';

interface InspectorPatch {
  timeMs?: number;
  durationMs?: number;
  chartLayerIndex?: number;
  gridCellId?: number | null;
  parallaxFactor?: number;
  logo?: NonNullable<ChartKeyframe['logo']> | null;
}

interface EditorInspectorPanelProps {
  readonly keyframe: ChartKeyframe;
  readonly onChange: (patch: InspectorPatch) => void;
  readonly onClose: () => void;
  readonly onDelete: () => void;
  readonly onPickLogo: () => void;
  readonly onRandomLogo: () => void;
  readonly onRemoveLogo: () => void;
  readonly onFrameAnimation: () => void;
  readonly bindings: readonly string[];
  readonly assetOptions: readonly { readonly id: string; readonly label: string }[];
  readonly onBindAsset: (assetId: string) => void;
  readonly effects: readonly EditorEffectInterface[];
  readonly onAddEffect: (kind: EditorEffectKind) => void;
  readonly onUpdateEffect: (interfaceId: string, params: Record<string, number>) => void;
  readonly onRemoveEffect: (interfaceId: string) => void;
  readonly collapsed: boolean;
}

const EFFECTS = [
  'None',
  'FlashWhite',
  'FlashBlack',
  'Truncate',
  'FadeDown',
  'FadeUp',
  'Strobe',
  'Glitch',
] as const;
const EASINGS = ['Linear', 'EaseIn', 'EaseOut', 'EaseInOut'] as const;

function numberValue(value: string, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function NumberStepper({
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}) {
  const clamp = (next: number): number => {
    const rounded = Math.round(next * 100) / 100;
    return Math.min(max, Math.max(min, rounded));
  };
  return (
    <span className="editor-stepper">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(clamp(numberValue(event.target.value, value)))}
      />
      <span className="editor-stepper__buttons">
        <button type="button" aria-label="Increase" onClick={() => onChange(clamp(value + step))}>▲</button>
        <button type="button" aria-label="Decrease" onClick={() => onChange(clamp(value - step))}>▼</button>
      </span>
    </span>
  );
}

/** 右侧毛玻璃 Inspector；只发 patch，不直接改 E。 */
export function EditorInspectorPanel({
  keyframe,
  onChange,
  onClose,
  onDelete,
  onPickLogo,
  onRandomLogo,
  onRemoveLogo,
  onFrameAnimation,
  bindings,
  assetOptions,
  onBindAsset,
  effects,
  onAddEffect,
  onUpdateEffect,
  onRemoveEffect,
  collapsed,
}: EditorInspectorPanelProps) {
  const logo = keyframe.logo;
  return (
    <aside
      className={`editor-inspector${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Keyframe inspector"
    >
      <header className="editor-inspector__head">
        <div>
          <span className="editor-eyebrow">INSPECTOR</span>
          <strong>{keyframe.keyframeId}</strong>
        </div>
        <button type="button" className="editor-icon-button" onClick={onClose} aria-label="Close inspector">
          ×
        </button>
      </header>

      <div className="editor-inspector__body">
        <section className="editor-inspector__section">
          <h3>KEYFRAME</h3>
          <label>
            Time (ms)
            <input
              type="number"
              min={0}
              step={10}
              value={keyframe.timeMs}
              onChange={(event) => onChange({
                timeMs: Math.max(0, Math.round(numberValue(event.target.value, keyframe.timeMs))),
              })}
            />
          </label>
          <label>
            Duration (ms)
            <input
              type="number"
              min={0}
              step={10}
              value={keyframe.durationMs}
              onChange={(event) => onChange({
                durationMs: Math.max(0, Math.round(numberValue(event.target.value, keyframe.durationMs))),
              })}
            />
          </label>
          <div className="editor-inspector__actions">
            <button type="button" onClick={onFrameAnimation}>帧动画 → 下一节奏点</button>
          </div>
          <label>
            Layer
            <EditorSelect
              value={String(keyframe.chartLayerIndex)}
              options={[
                { value: '1', label: 'Layer 1' },
                { value: '2', label: 'Layer 2' },
                { value: '3', label: 'Layer 3+' },
              ]}
              onChange={(value) => onChange({ chartLayerIndex: Number(value) })}
            />
          </label>
          {keyframe.chartLayerIndex === 2 ? (
            <label>
              Grid
              <EditorSelect
                value={String(keyframe.gridCellId ?? 1)}
                options={Array.from({ length: 8 }, (_, index) => ({
                  value: String(index + 1),
                  label: `Cell ${index + 1}`,
                }))}
                onChange={(value) => onChange({ gridCellId: Number(value) })}
              />
            </label>
          ) : null}
          {bindings.length > 0 ? (
            <div className="editor-inspector__bindings">
              <span>BOUND</span>
              {bindings.map((binding) => (
                <b key={binding}>{binding.replace('asset:', '').replaceAll(':', ' / ')}</b>
              ))}
              <EditorSelect
                className="editor-inspector__bind-select"
                value=""
                placeholder="+ BIND"
                options={assetOptions.map((asset) => ({ value: asset.id, label: asset.label }))}
                onChange={(value) => onBindAsset(value)}
              />
            </div>
          ) : null}
          <label>
            ParallaxFactor
            <span className="editor-inspector__inline">
              <input
                type="range"
                min={-5}
                max={5}
                step={0.05}
                value={keyframe.parallaxFactor}
                onChange={(event) => onChange({ parallaxFactor: Number(event.target.value) })}
              />
              <NumberStepper
                value={keyframe.parallaxFactor}
                min={-5}
                max={5}
                step={0.05}
                onChange={(value) => onChange({ parallaxFactor: value })}
              />
            </span>
          </label>
        </section>

        <section className="editor-inspector__section">
          <div className="editor-inspector__section-head">
            <h3>EFFECTS</h3>
            <EditorSelect
              className="editor-inspector__add-effect"
              value=""
              placeholder="+ 动效"
              options={(['EaseIn', 'EaseOut', 'ScaleUp', 'ScaleDown', 'Glitch', 'ScrollOpen', 'ScrollClose', 'Bounce', 'Wander', 'Shake'] as const)
                .map((kind) => ({ value: kind, label: kind }))}
              onChange={(value) => onAddEffect(value as EditorEffectKind)}
            />
          </div>
          <div className="editor-inspector__effect-list">
            {effects.map((effect) => (
              <div key={effect.interfaceId} className="editor-inspector__effect-row">
                <div className="editor-inspector__effect-chip">
                  {effect.effectKind}
                  <button type="button" onClick={() => onRemoveEffect(effect.interfaceId)}>×</button>
                </div>
                <label>
                  Dur
                  <input
                    type="number"
                    min={80}
                    step={50}
                    value={effect.params.durationMs ?? 600}
                    onChange={(event) => onUpdateEffect(effect.interfaceId, {
                      durationMs: Math.max(80, Number(event.target.value) || 600),
                    })}
                  />
                </label>
                {effect.effectKind === 'Bounce' ? (
                  <>
                    <label>
                      Count
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={effect.params.bounceCount ?? 3}
                        onChange={(event) => onUpdateEffect(effect.interfaceId, {
                          bounceCount: Math.max(1, Number(event.target.value) || 3),
                        })}
                      />
                    </label>
                    <label>
                      Height
                      <input
                        type="number"
                        min={0}
                        step={2}
                        value={effect.params.initialHeight ?? 24}
                        onChange={(event) => onUpdateEffect(effect.interfaceId, {
                          initialHeight: Math.max(0, Number(event.target.value) || 0),
                        })}
                      />
                    </label>
                  </>
                ) : null}
                {effect.effectKind === 'Glitch' ? (
                  <label>
                    Offset
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={effect.params.glitchOffset ?? 9}
                      onChange={(event) => onUpdateEffect(effect.interfaceId, {
                        glitchOffset: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                ) : null}
                {effect.effectKind === 'ScaleUp' || effect.effectKind === 'ScaleDown' ? (
                  <label>
                    Scale
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={effect.params.scale ?? 1.5}
                      onChange={(event) => onUpdateEffect(effect.interfaceId, {
                        scale: Math.max(0.1, Number(event.target.value) || 1),
                      })}
                    />
                  </label>
                ) : null}
                {effect.effectKind === 'Shake' ? (
                  <label>
                    Amp
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={effect.params.shakeAmplitude ?? 8}
                      onChange={(event) => onUpdateEffect(effect.interfaceId, {
                        shakeAmplitude: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                ) : null}
                {effect.effectKind === 'Wander' ? (
                  <label>
                    Radius
                    <input
                      type="number"
                      min={0}
                      step={2}
                      value={effect.params.wanderRadius ?? 14}
                      onChange={(event) => onUpdateEffect(effect.interfaceId, {
                        wanderRadius: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                ) : null}
                {effect.effectKind === 'ScrollOpen' || effect.effectKind === 'ScrollClose' ? (
                  <label>
                    Amount
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={2}
                      value={effect.params.scrollAmount ?? 48}
                      onChange={(event) => onUpdateEffect(effect.interfaceId, {
                        scrollAmount: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                      })}
                    />
                  </label>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="editor-inspector__section">
          <div className="editor-inspector__section-head">
            <h3>LOGO</h3>
            {logo ? (
              <button type="button" className="editor-link-button" onClick={onRemoveLogo}>
                隐藏
              </button>
            ) : (
              <button
                type="button"
                className="editor-link-button"
                onClick={() => onChange({ logo: {
                  logoId: `${keyframe.keyframeId}-logo`,
                  assetId: 'builtin:head-logo',
                  x: 0.5,
                  y: 0.5,
                  size: 0.18,
                  stretch: 1,
                  appearEffect: 'FadeDown',
                  disappearEffect: 'FadeUp',
                  easing: 'EaseInOut',
                } })}
              >
                显示
              </button>
            )}
          </div>
          {logo ? (
            <>
              <div className="editor-inspector__two">
                <label>
                  X
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={logo.x.toFixed(2)}
                    onChange={(event) => onChange({
                      logo: { ...logo, x: Math.min(1, Math.max(0, numberValue(event.target.value, logo.x))) },
                    })}
                  />
                </label>
                <label>
                  Y
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={logo.y.toFixed(2)}
                    onChange={(event) => onChange({
                      logo: { ...logo, y: Math.min(1, Math.max(0, numberValue(event.target.value, logo.y))) },
                    })}
                  />
                </label>
              </div>
              <label>
                Size
                <input
                  type="range"
                  min={0.02}
                  max={1}
                  step={0.01}
                  value={logo.size}
                  onChange={(event) => onChange({
                    logo: { ...logo, size: Number(event.target.value) },
                  })}
                />
              </label>
              <label>
                Stretch
                <input
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={logo.stretch}
                  onChange={(event) => onChange({
                    logo: { ...logo, stretch: Number(event.target.value) },
                  })}
                />
              </label>
              <label>
                Appear
                <EditorSelect
                  value={logo.appearEffect}
                  options={EFFECTS.map((effect) => ({ value: effect, label: effect }))}
                  onChange={(value) => onChange({
                    logo: { ...logo, appearEffect: value as typeof logo.appearEffect },
                  })}
                />
              </label>
              <label>
                Disappear
                <EditorSelect
                  value={logo.disappearEffect}
                  options={EFFECTS.map((effect) => ({ value: effect, label: effect }))}
                  onChange={(value) => onChange({
                    logo: { ...logo, disappearEffect: value as typeof logo.disappearEffect },
                  })}
                />
              </label>
              <label>
                Easing
                <EditorSelect
                  value={logo.easing}
                  options={EASINGS.map((easing) => ({ value: easing, label: easing }))}
                  onChange={(value) => onChange({
                    logo: { ...logo, easing: value as typeof logo.easing },
                  })}
                />
              </label>
              <div className="editor-inspector__actions">
                <button type="button" onClick={onPickLogo}>选位</button>
                <button type="button" onClick={onRandomLogo}>随机放置</button>
              </div>
            </>
          ) : (
            <p className="editor-inspector__hint">该关键帧没有 Logo。点击“显示”后选位。</p>
          )}
        </section>
      </div>

      <footer className="editor-inspector__footer">
        <button type="button" className="editor-danger-button" onClick={onDelete}>
          删除关键帧
        </button>
      </footer>
    </aside>
  );
}
