import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { EditorSelect } from './EditorSelect';
import { RandomPreviewMode } from '@core/eventgraph/RandomMode';
import { neuModuleLabel } from './types';
import type { NeuModule, NeuModuleType } from './types';

interface EditorNeuPanelProps {
  readonly modules: readonly NeuModule[];
  readonly selectedModuleId: string | null;
  readonly onAddModule: (type: NeuModuleType, label: string) => void;
  readonly onModulePointerDown: (
    type: NeuModuleType,
    label: string,
    event: ReactPointerEvent,
  ) => void;
  readonly onSelectModule: (moduleId: string) => void;
  readonly onMoveModule: (moduleId: string, x: number, y: number) => void;
  readonly onConnect: (sourceModuleId: string, targetModuleId: string) => void;
  readonly effectInterfaces: readonly { readonly interfaceId: string; readonly effectKind: string }[];
  readonly onUpdateParams: (
    moduleId: string,
    params: Record<string, string | number | boolean | string[] | null>,
  ) => void;
  readonly randomSeed: number;
  readonly randomMode: RandomPreviewMode;
  readonly onRandomSeedChange: (seed: number) => void;
  readonly onRandomModeChange: (mode: RandomPreviewMode) => void;
  readonly collapsed: boolean;
}

type NeuTab = 'Edit' | 'Modules' | 'Effects';

const MODULE_GROUPS: readonly {
  readonly title: string;
  readonly items: readonly { readonly type: NeuModuleType; readonly label: string; readonly transfer: string }[];
}[] = [
  {
    title: 'LOGIC',
    items: [
      { type: 'AND', label: '与 / AND', transfer: 'neu:and' },
      { type: 'OR', label: '或 / OR', transfer: 'neu:or' },
      { type: 'NOT', label: '非 / NOT', transfer: 'neu:not' },
      { type: 'Delay', label: '延时 / Delay', transfer: 'neu:delay' },
      { type: 'Random', label: '随机 / Random', transfer: 'neu:random' },
      { type: 'RhythmPoint', label: '节奏点', transfer: 'neu:rhythm' },
    ],
  },
  {
    title: 'RESOURCE',
    items: [
      { type: 'Video', label: '视频 / 时间驱动', transfer: 'neu:video' },
      { type: 'VideoStatic', label: '视频 / 冻结帧（谱面）', transfer: 'neu:videostatic' },
      { type: 'Image', label: '图片', transfer: 'neu:image' },
      { type: 'Audio', label: '音频', transfer: 'neu:audio' },
      { type: 'Subtitle', label: '字幕', transfer: 'neu:subtitle' },
    ],
  },
  {
    title: 'MOTION / LIGHT',
    items: [
      { type: 'Effect', label: '动效接口', transfer: 'neu:effect' },
      { type: 'Light', label: '局部光效', transfer: 'neu:light' },
      { type: 'Light', label: '全屏光效', transfer: 'neu:light' },
    ],
  },
  {
    title: 'CONTROL / EXPLORE',
    items: [
      { type: 'EnterRhythmMode', label: '进入节奏 / EnterRhythm', transfer: 'neu:enter-rhythm' },
      { type: 'PlayCutscene', label: '播放过场 / Cutscene', transfer: 'neu:cutscene' },
      { type: 'ExitToExplore', label: '退出到探索 / Exit', transfer: 'neu:explore' },
    ],
  },
];

const EFFECT_INTERFACES = [
  '缓入', '缓出', '放大', '缩小', '错位故障',
  '卷轴式展开', '卷轴式收束', '弹跳', '游走', '震颤',
] as const;

/** NEU 右栏：Edit / Modules / Effects 三个书签页。 */
export function EditorNeuPanel({
  modules,
  selectedModuleId,
  onAddModule,
  onModulePointerDown,
  onSelectModule,
  onMoveModule,
  effectInterfaces,
  onUpdateParams,
  randomSeed,
  randomMode,
  onRandomSeedChange,
  onRandomModeChange,
  collapsed,
}: EditorNeuPanelProps) {
  const [tab, setTab] = useState<NeuTab>('Modules');
  const [effects, setEffects] = useState<readonly string[]>(EFFECT_INTERFACES);
  const [openEffect, setOpenEffect] = useState<number | null>(null);
  const [panelScrollTop, setPanelScrollTop] = useState(0);
  const visibleEffectCount = Math.max(10, Math.ceil((panelScrollTop + 500) / 52) + 2);
  const selected = modules.find((module) => module.moduleId === selectedModuleId) ?? null;

  return (
    <aside
      className={`editor-neu-panel${collapsed ? ' is-collapsed' : ''}`}
      aria-label="NEU inspector"
    >
      <header className="editor-neu-panel__tabs">
        {(['Edit', 'Modules', 'Effects'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? 'is-active' : ''}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </header>

      {tab === 'Modules' ? (
        <div className="editor-neu-panel__body" style={{ paddingBottom: 260 }} onScroll={(event) => setPanelScrollTop(event.currentTarget.scrollTop)}>
          <span className="editor-eyebrow">MODULE LIBRARY</span>
          {MODULE_GROUPS.map((group) => (
            <section key={group.title} className="editor-neu-panel__group">
              <h3>{group.title}</h3>
              {group.items.map((item) => (
                <button
                  key={`${group.title}-${item.label}`}
                  type="button"
                  className={`editor-neu-module-chip editor-neu-module-chip--${item.type === 'Light' ? (item.label.includes('局部') ? 'lightlocal' : 'lightfull') : item.type.toLowerCase()}`}
                  onPointerDown={(event) => {
                    onModulePointerDown(item.type, item.label, event);
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span>{item.label}</span>
                  <small>{item.type}</small>
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : null}

      {tab === 'Effects' ? (
        <div className="editor-neu-panel__body" style={{ paddingBottom: 260 }} onScroll={(event) => setPanelScrollTop(event.currentTarget.scrollTop)}>
          <span className="editor-eyebrow">MOTION INTERFACES</span>
          <p className="editor-neu-panel__hint">数字序号对应动效接口；每个接口可叠加多种动效。</p>
          {Array.from({ length: visibleEffectCount }, (_, index) => effects[index] ?? 'None').map((effect, index) => (
            <div key={`effect-${index}`} className="editor-neu-panel__effect">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <button
                type="button"
                className="editor-effect-select"
                onClick={() => setOpenEffect(openEffect === index ? null : index)}
              >
                <b>{effect}</b>
                <i>⌄</i>
              </button>
              {openEffect === index ? (
                <div className="editor-effect-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setEffects((previous) => previous.map((item, current) => (
                        current === index ? 'None' : item
                      )));
                      setOpenEffect(null);
                    }}
                  >
                    None
                  </button>
                  {EFFECT_INTERFACES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={effect === item ? 'is-active' : ''}
                      onClick={() => {
                        setEffects((previous) => previous.map((current, effectIndex) => (
                          effectIndex === index ? item : current
                        )));
                        setOpenEffect(null);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'Edit' ? (
        <div className="editor-neu-panel__body" style={{ paddingBottom: 260 }} onScroll={(event) => setPanelScrollTop(event.currentTarget.scrollTop)}>
          <span className="editor-eyebrow">NEU RANDOM</span>
          <div className="editor-neu-random">
            <label>
              RandomSeed
              <input
                type="number"
                min={0}
                max={4294967295}
                step={1}
                value={randomSeed}
                onChange={(event) => onRandomSeedChange(
                  Math.max(0, Math.min(0xffff_ffff, Math.floor(Number(event.target.value) || 0))),
                )}
              />
            </label>
            <label>
              Preview Mode
              <select
                value={randomMode}
                onChange={(event) => onRandomModeChange(event.target.value as RandomPreviewMode)}
              >
                <option value={RandomPreviewMode.Seeded}>Seeded</option>
                <option value={RandomPreviewMode.Live}>Live</option>
              </select>
            </label>
            <p className="editor-neu-panel__hint">
              Seeded：同 seed 可复现；Live：真随机预览，不写回 editor.json。
            </p>
          </div>
          <span className="editor-eyebrow">MODULE EDIT</span>
          {selected ? (
            <>
              <div className="editor-neu-panel__selected">
                <b>{neuModuleLabel(selected)}</b>
                <small>{selected.type} · {selected.moduleId}</small>
              </div>
              <label>
                Position X
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selected.x.toFixed(2)}
                  onChange={(event) => onMoveModule(
                    selected.moduleId,
                    Math.min(1, Math.max(0, Number(event.target.value) || 0)),
                    selected.y,
                  )}
                />
              </label>
              <label>
                Position Y
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selected.y.toFixed(2)}
                  onChange={(event) => onMoveModule(
                    selected.moduleId,
                    selected.x,
                    Math.min(1, Math.max(0, Number(event.target.value) || 0)),
                  )}
                />
              </label>
              {selected.type === 'Delay' ? (
                <label>
                  Delay (ms)
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={Number(selected.params.delayMs ?? 0)}
                    onChange={(event) => onUpdateParams(selected.moduleId, {
                      ...selected.params,
                      delayMs: Math.max(0, Number(event.target.value) || 0),
                    })}
                  />
                </label>
              ) : null}
              {selected.type === 'Random' ? (
                <label>
                  Probability
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={Number(selected.params.probability ?? 0.5)}
                    onChange={(event) => onUpdateParams(selected.moduleId, {
                      ...selected.params,
                      probability: Math.min(1, Math.max(0, Number(event.target.value) || 0)),
                    })}
                  />
                </label>
              ) : null}
              {selected.type === 'RhythmPoint' ? (
                <label>
                  Trigger (ms)
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={Number(selected.params.timeMs ?? 0)}
                    onChange={(event) => onUpdateParams(selected.moduleId, {
                      ...selected.params,
                      timeMs: Math.max(0, Number(event.target.value) || 0),
                    })}
                  />
                </label>
              ) : null}
              {selected.type === 'EnterRhythmMode' ? (
                <>
                  <label>
                    Chart ID
                    <input
                      value={String(selected.params.chartId ?? '')}
                      placeholder="chart-w1"
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        chartId: event.target.value,
                      })}
                    />
                  </label>
                  <label>
                    Time (ms，可选时间根)
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={Number(selected.params.atMs ?? 0)}
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        atMs: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                  <label>
                    Virtual source（可选）
                    <input
                      value={String(selected.params.sourceId ?? '')}
                      placeholder="trace:rain-window"
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        sourceId: event.target.value,
                      })}
                    />
                  </label>
                </>
              ) : null}
              {selected.type === 'PlayCutscene' ? (
                <>
                  <label>
                    Cutscene ID
                    <input
                      value={String(selected.params.cutsceneId ?? '')}
                      placeholder="cs-intro"
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        cutsceneId: event.target.value,
                      })}
                    />
                  </label>
                  <label>
                    Time (ms，可选时间根)
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={Number(selected.params.atMs ?? 0)}
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        atMs: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                  <label>
                    Virtual source（可选）
                    <input
                      value={String(selected.params.sourceId ?? '')}
                      placeholder="trigger:window"
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        sourceId: event.target.value,
                      })}
                    />
                  </label>
                </>
              ) : null}
              {selected.type === 'ExitToExplore' ? (
                <p className="editor-neu-panel__hint">
                  ExitToExplore 幂等；只在 Explore 模式接受。
                </p>
              ) : null}
              {selected.type === 'Audio' ? (
                <>
                  <label>
                    Asset
                    <input
                      value={String(selected.params.assetId ?? 'asset:audio:main')}
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        assetId: event.target.value,
                      })}
                    />
                  </label>
                  <label>
                    Volume
                    <input
                      type="number"
                      min={0}
                      max={0.8}
                      step={0.05}
                      value={Number(selected.params.volume ?? 0.8)}
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        volume: Math.min(0.8, Math.max(0, Number(event.target.value) || 0)),
                      })}
                    />
                  </label>
                </>
              ) : null}
              {selected.type === 'Effect' ? (
                <label>
                  Effect interface
                  <EditorSelect
                    value={String(selected.params.interfaceId ?? '')}
                    placeholder="None"
                    options={[
                      { value: '', label: 'None' },
                      ...effectInterfaces.map((effect) => ({
                        value: effect.interfaceId,
                        label: `${effect.interfaceId} / ${effect.effectKind}`,
                      })),
                    ]}
                    onChange={(value) => onUpdateParams(selected.moduleId, {
                      ...selected.params,
                      interfaceId: value,
                    })}
                  />
                </label>
              ) : null}
              {selected.type === 'Light' ? (
                <>
                  <label>
                    Target asset（Local）
                    <input
                      value={String(selected.params.targetAssetId ?? '')}
                      placeholder='asset:guidance:head-logo'
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        targetAssetId: event.target.value,
                      })}
                    />
                  </label>
                  <label>
                    Presets
                    <span className="editor-neu-panel__presets">
                      {['Invert', 'FlashWhite', 'FlashBlack', 'Noise', 'Blur', 'Vivid'].map((preset) => {
                        const presets = Array.isArray(selected.params.presets)
                          ? selected.params.presets as string[]
                          : [];
                        return (
                          <button
                            key={preset}
                            type="button"
                            className={presets.includes(preset) ? 'is-active' : ''}
                            onClick={() => onUpdateParams(selected.moduleId, {
                              ...selected.params,
                              presets: presets.includes(preset)
                                ? presets.filter((item) => item !== preset)
                                : [...presets, preset],
                            })}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </span>
                  </label>
                  <label>
                    Duration (ms)
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={Number(selected.params.durationMs ?? 600)}
                      onChange={(event) => onUpdateParams(selected.moduleId, {
                        ...selected.params,
                        durationMs: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                </>
              ) : null}
              <p className="editor-neu-panel__hint">
                Delay 长度 = delayMs；Audio/Video/Subtitle 时长按实际游玩毫秒计算。
                CONTROL 节点只在 Explore 触发；带 atMs 的时间根用于过场/调试，
                也可用 trace:&lt;id&gt; / trigger:&lt;id&gt; 作为虚拟输入源。
              </p>
            </>
          ) : (
            <p className="editor-neu-panel__hint">选择一个蓝图模块以编辑参数。</p>
          )}
          <div className="editor-neu-panel__list">
            {modules.map((module) => (
              <button key={module.moduleId} type="button" onClick={() => onSelectModule(module.moduleId)}>
                {neuModuleLabel(module)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
