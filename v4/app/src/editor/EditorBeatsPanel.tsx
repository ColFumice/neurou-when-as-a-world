import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeBeats } from '../audio/beatAnalyzer';
import type { BeatAnalysisResult } from '../audio/beatAnalyzer';
import {
  beatsSidecarRelPath,
  parseBeatsSidecar,
  readBeatsSidecar,
  writeBeatsSidecar,
  type BeatsSidecar,
} from '../audio/beatsSidecar';
import { sha256Hex } from '../audio/audioHash';
import { TauriMediaImporter } from '../../../adapters/tauri/TauriMediaImporter';
import { TauriProjectIo } from '../../../adapters/tauri/TauriProjectIo';
import {
  analyzingView,
  beatGrid,
  detectedSidecar,
  failedView,
  idleView,
  lowConfidenceView,
  manualBpm,
  manualSidecar,
  viewFromSidecar,
} from './beatsPanelModel';
import type {
  BeatAudioAsset,
  BeatsPanelView,
} from './beatsPanelModel';

interface EditorBeatsPanelProps {
  readonly projectRoot: string;
  readonly chartId: string;
  readonly onChanged?: () => void;
}

interface ManifestAsset {
  readonly assetId?: unknown;
  readonly relPath?: unknown;
  readonly sha256?: unknown;
  readonly durationMs?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(2000, Math.round(value)));
}

async function resolveAudioAsset(
  io: TauriProjectIo,
  projectRoot: string,
): Promise<BeatAudioAsset> {
  await io.openProjectRoot(projectRoot);
  const raw = await io.readProjectFile('media/manifest.json');
  if (!isRecord(raw) || !Array.isArray(raw.assets) || !Array.isArray(raw.stereoPairs)) {
    throw new Error('media manifest 缺少 assets/stereoPairs');
  }
  const pairs = raw.stereoPairs.filter(isRecord);
  const activePairId = typeof raw.activePairId === 'string' ? raw.activePairId : null;
  const requested = activePairId
    ? pairs.find((item) => item.stereoPairId === activePairId)
    : null;
  const pair = requested ?? [...pairs].reverse()[0];
  const audioAssetId = pair?.audioAssetId;
  const asset = raw.assets
    .filter(isRecord)
    .find((item) => item.assetId === audioAssetId);
  if (!asset || typeof asset.relPath !== 'string' || typeof asset.assetId !== 'string') {
    throw new Error('media manifest 没有可分析音频');
  }
  const durationMs = typeof asset.durationMs === 'number' && Number.isFinite(asset.durationMs)
    ? asset.durationMs
    : 0;
  let sha256 = typeof asset.sha256 === 'string' && /^[a-f0-9]{64}$/.test(asset.sha256)
    ? asset.sha256
    : null;
  if (!sha256) {
    const bytes = await new TauriMediaImporter().readMediaFile(asset.relPath);
    sha256 = await sha256Hex(bytes);
  }
  if (durationMs <= 0) throw new Error('audio duration 无效');
  return {
    assetId: asset.assetId,
    relPath: asset.relPath,
    sha256,
    durationMs,
  };
}

async function decodeMono(
  importer: TauriMediaImporter,
  asset: BeatAudioAsset,
): Promise<{ readonly samples: Float32Array; readonly sampleRate: number }> {
  const bytes = await importer.readMediaFile(asset.relPath);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(copy.buffer);
    const samples = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) {
        samples[index] += data[index] / buffer.numberOfChannels;
      }
    }
    return { samples, sampleRate: buffer.sampleRate };
  } finally {
    void context.close();
  }
}

function reasonText(result: BeatAnalysisResult): string {
  return result.reason ?? 'NoBeat';
}

/**
 * R5b.2 · 编辑器节拍面板。
 *
 * Analyzer 仍只写 sidecar（R5a 行为不变）；新增 Manual BPM/offset/Tap/网格预览/
 * 导入导出/覆盖确认。Manual 保存 source=Manual、confidence=1。
 */
export function EditorBeatsPanel({
  projectRoot,
  chartId,
  onChanged,
}: EditorBeatsPanelProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<BeatsPanelView>(idleView());
  const [taps, setTaps] = useState<readonly number[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualAsset, setManualAsset] = useState<BeatAudioAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bpmInput, setBpmInput] = useState('90');
  const [offsetInput, setOffsetInput] = useState('0');
  const [durationMs, setDurationMs] = useState(72_000);
  const [hasSidecar, setHasSidecar] = useState(false);
  const [pendingSidecar, setPendingSidecar] = useState<BeatsSidecar | null>(null);
  const [pendingReason, setPendingReason] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ioRef = useRef(new TauriProjectIo());
  const importerRef = useRef(new TauriMediaImporter());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void readBeatsSidecar(projectRoot, chartId).then((result) => {
      if (!alive) return;
      setView(viewFromSidecar(result.sidecar));
      setHasSidecar(result.sidecar !== null);
      if (result.sidecar) {
        setBpmInput(String(result.sidecar.bpm));
        setOffsetInput(String(result.sidecar.offsetMs));
      }
      if (result.warnings.length > 0 && result.sidecar === null) {
        setError(result.warnings[0] ?? null);
      }
    });
    void resolveAudioAsset(ioRef.current, projectRoot).then((asset) => {
      if (!alive) return;
      setManualAsset(asset);
      setDurationMs(asset.durationMs);
    }).catch((caught) => {
      if (alive) setError(`读取音频失败：${errorText(caught)}`);
    });
    return () => {
      alive = false;
    };
  }, [chartId, projectRoot]);

  const parsedBpm = Number(bpmInput);
  const parsedOffset = clampOffset(Number(offsetInput));
  const draftGrid = useMemo(() => {
    if (!Number.isFinite(parsedBpm) || parsedBpm < 60 || parsedBpm > 200) return null;
    return beatGrid(parsedBpm, parsedOffset, durationMs);
  }, [durationMs, parsedBpm, parsedOffset]);

  const applySidecarView = (sidecar: BeatsSidecar): void => {
    setView(viewFromSidecar(sidecar));
    setHasSidecar(true);
    setBpmInput(String(sidecar.bpm));
    setOffsetInput(String(sidecar.offsetMs));
    setError(null);
  };

  const commitWrite = async (
    sidecar: BeatsSidecar,
  ): Promise<void> => {
    setBusy(true);
    try {
      await writeBeatsSidecar(projectRoot, chartId, sidecar);
      applySidecarView(sidecar);
      setPendingSidecar(null);
      setPendingReason('');
      setManualMode(false);
      setTaps([]);
      setNotice('sidecar 已保存');
      onChanged?.();
    } catch (caught) {
      setError(`保存失败：${errorText(caught)}`);
    } finally {
      setBusy(false);
    }
  };

  const requestWrite = (sidecar: BeatsSidecar, reason: string): void => {
    if (hasSidecar) {
      setPendingSidecar(sidecar);
      setPendingReason(reason);
      setPendingDelete(false);
      return;
    }
    void commitWrite(sidecar);
  };

  const analyze = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    setManualMode(false);
    setTaps([]);
    setView(analyzingView());
    try {
      const asset = manualAsset ?? await resolveAudioAsset(ioRef.current, projectRoot);
      setManualAsset(asset);
      setDurationMs(asset.durationMs);
      const decoded = await decodeMono(importerRef.current, asset);
      const result = analyzeBeats(decoded.samples, decoded.sampleRate);
      if (!result.ok) {
        setView(result.reason === 'LowConfidence'
          ? lowConfidenceView(reasonText(result), result.confidence ?? null)
          : failedView(reasonText(result)));
        return;
      }
      const sidecar = detectedSidecar(
        chartId,
        asset,
        result,
        new Date().toISOString(),
      );
      if (!sidecar) {
        setView(failedView('sidecar 生成失败'));
        return;
      }
      requestWrite(sidecar, 'Analyze Beats 结果覆盖已有 sidecar');
    } catch (caught) {
      setView(failedView(errorText(caught)));
    }
  };

  const startManual = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    try {
      const asset = manualAsset ?? await resolveAudioAsset(ioRef.current, projectRoot);
      setManualAsset(asset);
      setDurationMs(asset.durationMs);
      setManualMode(true);
      setTaps([]);
      setBpmInput(view.bpm === null ? '90' : String(view.bpm));
      setOffsetInput(view.source === 'Manual' ? offsetInput : '0');
    } catch (caught) {
      setView(failedView(errorText(caught)));
    }
  };

  const tap = (): void => {
    if (!manualMode) return;
    const now = performance.now();
    setTaps((previous) => {
      const next = [...previous, now].slice(-4);
      const measured = manualBpm(next);
      if (measured !== null) setBpmInput(String(measured));
      return next;
    });
  };

  const saveManual = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    if (!Number.isFinite(parsedBpm) || parsedBpm < 60 || parsedBpm > 200) {
      setError('BPM 必须在 60–200 之间');
      return;
    }
    try {
      const asset = manualAsset ?? await resolveAudioAsset(ioRef.current, projectRoot);
      setManualAsset(asset);
      setDurationMs(asset.durationMs);
      const sidecar = manualSidecar(
        chartId,
        asset,
        taps,
        new Date().toISOString(),
        { bpm: parsedBpm, offsetMs: parsedOffset },
      );
      if (!sidecar) {
        setError('Manual 网格生成失败：请检查 BPM / offset');
        return;
      }
      requestWrite(sidecar, 'Manual 网格覆盖已有 sidecar');
    } catch (caught) {
      setError(`Manual 保存失败：${errorText(caught)}`);
    }
  };

  const exportSidecar = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    try {
      await ioRef.current.openProjectRoot(projectRoot);
      const raw = await ioRef.current.readProjectFile(beatsSidecarRelPath(chartId));
      if (!raw) {
        setError('没有可导出的 sidecar');
        return;
      }
      const json = JSON.stringify(raw, null, 2);
      setExportJson(json);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${chartId}.beats.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('已生成 JSON：下方文本可复制，浏览器同时触发下载');
    } catch (caught) {
      setError(`导出失败：${errorText(caught)}`);
    }
  };

  const importSidecar = async (file: File): Promise<void> => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const asset = manualAsset ?? await resolveAudioAsset(ioRef.current, projectRoot);
      setManualAsset(asset);
      setDurationMs(asset.durationMs);
      const parsed = parseBeatsSidecar(raw, chartId, {
        durationMs: asset.durationMs,
        currentAudioSha256: asset.sha256,
      });
      if (!parsed.sidecar) {
        throw new Error(parsed.warnings.join('; ') || 'sidecar 校验失败');
      }
      if (parsed.sidecar.audioAssetId !== asset.assetId) {
        throw new Error('导入 sidecar 的 audioAssetId 与当前音频不一致');
      }
      requestWrite(parsed.sidecar, '导入 JSON 覆盖已有 sidecar');
    } catch (caught) {
      setError(`导入失败：${errorText(caught)}`);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeNow = async (): Promise<void> => {
    setBusy(true);
    try {
      await ioRef.current.openProjectRoot(projectRoot);
      await ioRef.current.deleteProjectFile(beatsSidecarRelPath(chartId));
      setView(idleView());
      setHasSidecar(false);
      setTaps([]);
      setManualMode(false);
      setPendingDelete(false);
      setPendingSidecar(null);
      setExportJson(null);
      setError(null);
      setNotice('sidecar 已删除');
      onChanged?.();
    } catch (caught) {
      setError(`Remove Beats 失败：${errorText(caught)}`);
    } finally {
      setBusy(false);
    }
  };

  const requestRemove = (): void => {
    if (!hasSidecar) return;
    setPendingDelete(true);
    setPendingSidecar(null);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="editor-beats-trigger"
        onClick={() => setOpen(true)}
        title="BPM / Downbeat"
      >
        <span>BEATS</span>
        {view.status === 'Ready' ? <i /> : null}
      </button>
    );
  }

  const manualHint = manualBpm(taps) === null
    ? `TAPS ${taps.length}/4`
    : `TAPS ${taps.length}/4 · ${manualBpm(taps)?.toFixed(1)} BPM`;
  const grid = draftGrid;
  const visibleBeats = grid?.beatsMs.slice(0, 64) ?? [];
  const downbeats = new Set(grid?.downbeatsMs ?? []);

  return (
    <aside className="editor-beats-panel" aria-label="Beat analysis">
      <header>
        <div>
          <span className="editor-eyebrow">MUSIC / BEATS</span>
          <strong>{chartId}</strong>
        </div>
        <button type="button" className="editor-icon-button" onClick={() => setOpen(false)}>×</button>
      </header>

      <div className="editor-beats-panel__actions">
        <button type="button" disabled={busy || view.status === 'Analyzing'} onClick={() => void analyze()}>
          {view.status === 'Analyzing' ? 'ANALYZING…' : 'Analyze Beats'}
        </button>
        <button type="button" disabled={busy} onClick={() => void startManual()}>Manual Tap</button>
        <button type="button" disabled={busy || !hasSidecar} onClick={requestRemove}>
          Remove Beats
        </button>
      </div>

      <div className="editor-beats-panel__status" role="status">
        <span>STATUS / {view.status.toUpperCase()}</span>
        <span>BPM / {view.bpm === null ? '—' : view.bpm.toFixed(2)}</span>
        <span>OFFSET / {offsetInput} ms</span>
        <span>METER / {view.meter ?? '—'}</span>
        <span>CONF / {view.confidence === null ? '—' : `${Math.round(view.confidence * 100)}%`}</span>
        <span>SOURCE / {view.source ?? '—'}</span>
        {view.reason ? <span>REASON / {view.reason}</span> : null}
      </div>

      <div className="editor-beats-panel__editor">
        <label className="editor-beats-panel__field">
          <span>BPM</span>
          <input
            type="number"
            min={60}
            max={200}
            step={0.01}
            value={bpmInput}
            onChange={(event) => setBpmInput(event.target.value)}
            aria-label="Manual BPM"
          />
        </label>
        <label className="editor-beats-panel__field">
          <span>OFFSET</span>
          <input
            type="number"
            min={0}
            max={2000}
            step={10}
            value={offsetInput}
            onChange={(event) => setOffsetInput(event.target.value)}
            aria-label="Manual offset ms"
          />
          <span>ms</span>
        </label>
        <div className="editor-beats-panel__nudge">
          <button type="button" disabled={busy} onClick={() => setOffsetInput(String(clampOffset(parsedOffset - 10)))}>−10</button>
          <button type="button" disabled={busy} onClick={() => setOffsetInput(String(clampOffset(parsedOffset + 10)))}>+10</button>
          <button type="button" disabled={busy} onClick={tap}>{manualMode ? 'TAP' : 'TAP (先点 Manual Tap)'}</button>
          <button type="button" disabled={busy} onClick={() => void saveManual()}>Save Manual</button>
        </div>
        <span className="editor-beats-panel__tap-hint">{manualHint}</span>
      </div>

      <div className="editor-beats-panel__grid" aria-label="Beat grid preview">
        <div className="editor-beats-panel__bars">
          {visibleBeats.map((time, index) => (
            <i
              key={`${time}-${index}`}
              className={downbeats.has(time) ? 'is-downbeat' : ''}
              title={`${index + 1} · ${time} ms`}
            />
          ))}
        </div>
        <div className="editor-beats-panel__grid-meta">
          <span>{grid ? `${grid.beatsMs.length} beats` : 'BPM 无效'}</span>
          <span>{grid ? `${grid.downbeatsMs.length} downbeats` : '—'}</span>
          <span>{grid ? `${(durationMs / 1000).toFixed(1)}s` : `${(durationMs / 1000).toFixed(1)}s`}</span>
        </div>
      </div>

      <div className="editor-beats-panel__transfer">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="editor-beats-panel__file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importSidecar(file);
          }}
        />
        <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </button>
        <button type="button" disabled={busy || !hasSidecar} onClick={() => void exportSidecar()}>
          Export JSON
        </button>
      </div>

      {pendingSidecar ? (
        <div className="editor-beats-panel__confirm" role="alert">
          <span>{pendingReason || '覆盖已有 sidecar？'}</span>
          <button type="button" disabled={busy} onClick={() => void commitWrite(pendingSidecar)}>Overwrite</button>
          <button type="button" disabled={busy} onClick={() => { setPendingSidecar(null); setPendingReason(''); }}>Cancel</button>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="editor-beats-panel__confirm" role="alert">
          <span>删除 charts/{chartId}.beats.json？</span>
          <button type="button" disabled={busy} onClick={() => void removeNow()}>Delete</button>
          <button type="button" disabled={busy} onClick={() => setPendingDelete(false)}>Cancel</button>
        </div>
      ) : null}

      {exportJson ? (
        <textarea
          className="editor-beats-panel__export"
          readOnly
          value={exportJson}
          aria-label="Exported sidecar JSON"
        />
      ) : null}

      {notice ? <p className="editor-beats-panel__notice">{notice}</p> : null}
      {error ? <p className="editor-beats-panel__error">{error}</p> : null}
      <p className="editor-beats-panel__hint">
        氛围 / 持续低音素材建议 Manual；Analyzer 的 LowConfidence 不会被隐藏。
      </p>
      <p className="editor-beats-panel__hint">
        只写 charts/&lt;chartId&gt;.beats.json；不影响判定 / NEU。
      </p>
    </aside>
  );
}
