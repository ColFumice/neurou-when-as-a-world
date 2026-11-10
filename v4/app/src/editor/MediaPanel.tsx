import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { TauriMediaImporter } from '../../../adapters/tauri/TauriMediaImporter';
import { TauriProjectIo } from '../../../adapters/tauri/TauriProjectIo';
import { DEFAULT_EDITOR_PROJECT_ROOT } from './model';
import type { MediaLayers } from './types';

interface MediaPanelProps {
  readonly onImported: (media: MediaLayers) => void;
  readonly onLoadTheme: (projectRoot: string) => Promise<void>;
}

function pathJoin(root: string, relPath: string): string {
  const base = root.trim().replace(/[\\/]+$/, '');
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base}${separator}${relPath.replace(/\//g, separator)}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/** 隐藏式媒体抽屉：Tauri dialog 选 left/right，复用 importStereo。 */
export function MediaPanel({ onImported, onLoadTheme }: MediaPanelProps) {
  const [openPanel, setOpenPanel] = useState(false);
  const [root, setRoot] = useState(DEFAULT_EDITOR_PROJECT_ROOT);
  const [left, setLeft] = useState(
    pathJoin(DEFAULT_EDITOR_PROJECT_ROOT, 'media/theme/rain-night-left-loop.mp4'),
  );
  const [right, setRight] = useState(
    pathJoin(DEFAULT_EDITOR_PROJECT_ROOT, 'media/theme/rain-night-right-loop.mp4'),
  );
  const [mono, setMono] = useState(false);
  const [monoSource, setMonoSource] = useState(
    pathJoin(DEFAULT_EDITOR_PROJECT_ROOT, 'media/theme/rain-night-left-loop.mp4'),
  );
  const [monoOffset, setMonoOffset] = useState(33);
  const [monoActual, setMonoActual] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pair, setPair] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const projectIo = new TauriProjectIo();
  const importer = new TauriMediaImporter();

  const choose = async (side: 'left' | 'right'): Promise<void> => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: side === 'left' ? '选择左眼 / 背景视频' : '选择右眼 / 前景视频',
        filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm'] }],
      });
      if (typeof selected !== 'string') return;
      if (side === 'left') setLeft(selected);
      else setRight(selected);
    } catch (caught) {
      setError(`dialog: ${errorText(caught)}`);
    }
  };

  const chooseMono = async (): Promise<void> => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: '选择单目源视频',
        filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm'] }],
      });
      if (typeof selected === 'string') setMonoSource(selected);
    } catch (caught) {
      setError(`dialog: ${errorText(caught)}`);
    }
  };

  const importMono = async (): Promise<void> => {
    if (!monoSource.trim()) {
      setError('请先选择单目源视频');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(8);
    try {
      await projectIo.openProjectRoot(root.trim());
      setProgress(24);
      const result = await importer.importMonoStereo(monoSource.trim(), monoOffset);
      setMonoActual(result.pair.offsetMs ?? null);
      setProgress(52);
      const [leftBytes, rightBytes] = await Promise.all([
        importer.readMediaFile(result.left.relPath),
        importer.readMediaFile(result.right.relPath),
      ]);
      setProgress(76);
      const background = URL.createObjectURL(
        new Blob([toArrayBuffer(leftBytes)], { type: 'video/mp4' }),
      );
      const foreground = URL.createObjectURL(
        new Blob([toArrayBuffer(rightBytes)], { type: 'video/mp4' }),
      );
      setProgress(92);
      const media: MediaLayers = {
        pairId: result.pair.stereoPairId,
        background,
        foreground,
        audio: convertFileSrc(pathJoin(root.trim(), result.audio.relPath)),
        leftRelPath: result.left.relPath,
        rightRelPath: result.right.relPath,
        audioRelPath: result.audio.relPath,
      };
      setPair(result.pair.stereoPairId);
      onImported(media);
      setProgress(100);
      window.setTimeout(() => setOpenPanel(false), 550);
    } catch (caught) {
      setError(errorText(caught));
      setProgress(0);
    } finally {
      setBusy(false);
    }
  };

  const importPair = async (): Promise<void> => {
    if (!left.trim() || !right.trim()) {
      setError('请先选择 left 与 right 视频');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(8);
    try {
      await projectIo.openProjectRoot(root.trim());
      setProgress(24);
      const result = await importer.importStereo(left.trim(), right.trim());
      setProgress(52);
      const [leftBytes, rightBytes] = await Promise.all([
        importer.readMediaFile(result.left.relPath),
        importer.readMediaFile(result.right.relPath),
      ]);
      setProgress(76);
      const background = URL.createObjectURL(
        new Blob([toArrayBuffer(leftBytes)], { type: 'video/mp4' }),
      );
      const foreground = URL.createObjectURL(
        new Blob([toArrayBuffer(rightBytes)], { type: 'video/mp4' }),
      );
      setProgress(92);
      const media: MediaLayers = {
        pairId: result.pair.stereoPairId,
        background,
        foreground,
        audio: convertFileSrc(pathJoin(root.trim(), result.audio.relPath)),
        leftRelPath: result.left.relPath,
        rightRelPath: result.right.relPath,
        audioRelPath: result.audio.relPath,
      };
      setPair(result.pair.stereoPairId);
      onImported(media);
      setProgress(100);
      window.setTimeout(() => setOpenPanel(false), 550);
    } catch (caught) {
      setError(errorText(caught));
      setProgress(0);
    } finally {
      setBusy(false);
    }
  };

  const loadTheme = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setProgress(10);
    try {
      await projectIo.openProjectRoot(root.trim());
      await onLoadTheme(root.trim());
      setPair('THEME');
      setProgress(100);
      setOpenPanel(false);
    } catch (caught) {
      setError(errorText(caught));
      setProgress(0);
    } finally {
      setBusy(false);
    }
  };

  if (!openPanel) {
    return (
      <button
        type="button"
        className="editor-media-trigger"
        onClick={() => setOpenPanel(true)}
        title="双目媒体"
      >
        <span>MEDIA</span>
        {pair ? <i /> : null}
      </button>
    );
  }

  return (
    <aside className="editor-media" aria-label="Media panel">
      <header>
        <div>
          <span className="editor-eyebrow">MEDIA /{mono ? ' MONO→STEREO' : ' STEREO'}</span>
          <strong>{mono ? '单目转双目' : '双目视频'}</strong>
        </div>
        <button type="button" className="editor-icon-button" onClick={() => setOpenPanel(false)}>×</button>
      </header>

      <div className="editor-media__modes">
        <button type="button" className={!mono ? 'is-active' : ''} onClick={() => setMono(false)}>双目</button>
        <button type="button" className={mono ? 'is-active' : ''} onClick={() => setMono(true)}>单目 → 双目</button>
      </div>

      <label>
        project root
        <input value={root} onChange={(event) => setRoot(event.target.value)} />
      </label>
      {mono ? (
        <>
          <label>
            单目源视频
            <span className="editor-media__path">
              <input value={monoSource} onChange={(event) => setMonoSource(event.target.value)} placeholder="选择源视频" />
              <button type="button" onClick={() => void chooseMono()}>选择</button>
            </span>
          </label>
          <label>
            offset / {monoOffset}ms（请求值）
            <input
              type="range"
              min={20}
              max={50}
              step={1}
              value={monoOffset}
              onChange={(event) => setMonoOffset(Number(event.target.value))}
            />
          </label>
          <p className="editor-media__hint">
            按视频帧量化，实际生效值由右侧命令返回。静态场景可能无有效视差。
            {monoActual !== null ? ` 上次实际：${monoActual}ms` : ''}
          </p>
          <button type="button" className="editor-primary-button" disabled={busy} onClick={() => void importMono()}>
            {busy ? 'IMPORTING…' : 'Import mono → stereo'}
          </button>
        </>
      ) : (
        <>
          <label>
            left / background
            <span className="editor-media__path">
              <input value={left} onChange={(event) => setLeft(event.target.value)} placeholder="选择 left.mp4" />
              <button type="button" onClick={() => void choose('left')}>选择</button>
            </span>
          </label>
          <label>
            right / foreground
            <span className="editor-media__path">
              <input value={right} onChange={(event) => setRight(event.target.value)} placeholder="选择 right.mp4" />
              <button type="button" onClick={() => void choose('right')}>选择</button>
            </span>
          </label>
          <button type="button" className="editor-primary-button" disabled={busy} onClick={() => void importPair()}>
            {busy ? 'IMPORTING…' : 'Import stereo'}
          </button>
        </>
      )}

      <button type="button" className="editor-primary-button" disabled={busy} onClick={() => void loadTheme()}>
        {busy ? 'LOADING…' : 'Load theme'}
      </button>

      <div className="editor-media__progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="editor-media__meta">
        <span>{pair ? `PAIR ${pair}` : 'NO PAIR'}</span>
        <span>{progress}%</span>
      </div>
      {error ? <p className="editor-media__error">{error}</p> : null}
      <p className="editor-media__hint">Load theme 直接使用 manifest activePair（不重新导入，不会生成静音音轨）。Import stereo 仍走 left/right 转码。</p>
    </aside>
  );
}
