import type { ChartEditMode } from '@core/editor/types';

interface EditorToolbarProps {
  readonly projectName: string;
  readonly worldId: string;
  readonly chartId: string;
  readonly editorMode: 'ROU' | 'NEU';
  readonly mode: ChartEditMode;
  readonly playing: boolean;
  readonly dirty: boolean;
  readonly saveState: string;
  readonly onBack: () => void;
  readonly onEditorMode: (mode: 'ROU' | 'NEU') => void;
  readonly onMode: (mode: ChartEditMode) => void;
  readonly onSave: () => void;
  readonly onPlay: () => void;
  readonly onAI: () => void;
  readonly aiStatus: string;
}

const MODES: readonly ChartEditMode[] = ['Notes', 'Keyframes', 'Logo', 'Layers'];

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M5 4h11l3 3v13H5V4Zm3 0v5h7V4M8 20v-7h8v7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function EditorToolbar({
  projectName,
  worldId,
  chartId,
  editorMode,
  mode,
  playing,
  dirty,
  saveState,
  onBack,
  onEditorMode,
  onMode,
  onSave,
  onPlay,
  onAI,
  aiStatus,
}: EditorToolbarProps) {
  return (
    <header className="editor-toolbar">
      <div className="editor-toolbar__left">
        <button type="button" className="editor-tool-button" onClick={onBack} title="返回 (Esc)">
          <IconBack />
          <span>Esc</span>
        </button>
        <div className="editor-toolbar__title">
          <span className="editor-eyebrow">EDITOR</span>
          <strong>{projectName} / {worldId}</strong>
          <small>{chartId}</small>
        </div>
      </div>

      <div className="editor-workspace-switch" aria-label="Editor workspace mode">
        <button
          type="button"
          className={editorMode === 'ROU' ? 'is-active' : ''}
          onClick={() => onEditorMode('ROU')}
        >
          ROU
        </button>
        <button
          type="button"
          className={editorMode === 'NEU' ? 'is-active' : ''}
          onClick={() => onEditorMode('NEU')}
        >
          NEU
        </button>
      </div>

      <nav className="editor-toolbar__modes" aria-label="Editor modes">
        {MODES.map((item) => (
          <button
            key={item}
            type="button"
            className={`editor-mode${mode === item ? ' is-active' : ''}`}
            onClick={() => onMode(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="editor-toolbar__right">
        <button
          type="button"
          className="editor-tool-button editor-tool-button--ai"
          onClick={onAI}
          title="AI 设置与关键帧生成"
        >
          <span>AI</span>
          <small>{aiStatus}</small>
        </button>
        <span className="editor-toolbar__save-state">{saveState}</span>
        <button
          type="button"
          className="editor-tool-button editor-tool-button--save"
          onClick={onSave}
          title="保存 (Ctrl+S)"
        >
          <IconSave />
          <span>Save</span>
          {dirty ? <i className="editor-dirty-dot" /> : null}
        </button>
        <button
          type="button"
          className={`editor-tool-button editor-tool-button--play${playing ? ' is-playing' : ''}`}
          onClick={onPlay}
          title="播放 (Space)"
        >
          {playing ? <IconPause /> : <IconPlay />}
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
      </div>
    </header>
  );
}
