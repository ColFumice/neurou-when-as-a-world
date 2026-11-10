import { useState } from 'react';
import type { AIKeyframeGeneration } from '../../../core/editor/types';
import type { AISettings } from './aiSettings';

export type AIKeyState = 'NOT SET' | 'KEY STORED' | 'KEYSTORE UNAVAILABLE';

interface EditorAIPanelProps {
  readonly settings: AISettings;
  readonly keyState: AIKeyState;
  readonly generation: AIKeyframeGeneration;
  readonly busy: boolean;
  readonly onChange: (settings: AISettings) => void;
  readonly onSaveSettings: () => void;
  readonly onSaveKey: (key: string) => Promise<void>;
  readonly onClearKey: () => Promise<void>;
  readonly onTest: () => void;
  readonly onGenerate: () => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly onClose: () => void;
}

/**
 * X · editor AI 面板。
 * Key 只存在于 password input 的本地 state；提交后立即清空。
 */
export function EditorAIPanel({
  settings,
  keyState,
  generation,
  busy,
  onChange,
  onSaveSettings,
  onSaveKey,
  onClearKey,
  onTest,
  onGenerate,
  onConfirm,
  onCancel,
  onClose,
}: EditorAIPanelProps) {
  const [keyInput, setKeyInput] = useState('');
  const proposals = generation.proposals ?? [];

  const saveKey = async (): Promise<void> => {
    const key = keyInput;
    if (!key.trim()) return;
    // 立即清空本地 state；不等待钥匙串往返，避免 key 停留在 input/DOM。
    setKeyInput('');
    await onSaveKey(key);
  };

  return (
    <section className="editor-ai-panel" aria-label="AI 设置与生成">
      <header className="editor-ai-panel__header">
        <div>
          <span className="editor-eyebrow">AI / PROVIDER</span>
          <strong>{settings.mode} MODE</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭 AI 面板">×</button>
      </header>

      <div className="editor-ai-panel__row editor-ai-panel__modes">
        {(['Local', 'Cloud'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={settings.mode === mode ? 'is-active' : ''}
            disabled={mode === 'Cloud' && keyState === 'KEYSTORE UNAVAILABLE'}
            onClick={() => onChange({ ...settings, mode })}
          >
            {mode}
          </button>
        ))}
      </div>

      <label className="editor-ai-panel__field">
        <span>Local Endpoint</span>
        <input
          value={settings.localEndpoint}
          onChange={(event) => onChange({ ...settings, localEndpoint: event.target.value })}
        />
      </label>
      <label className="editor-ai-panel__field">
        <span>Local Model</span>
        <input
          value={settings.localModel}
          onChange={(event) => onChange({ ...settings, localModel: event.target.value })}
        />
      </label>
      <label className="editor-ai-panel__field">
        <span>Cloud Endpoint</span>
        <input
          value={settings.cloudEndpoint}
          onChange={(event) => onChange({ ...settings, cloudEndpoint: event.target.value })}
        />
      </label>
      <label className="editor-ai-panel__field">
        <span>Cloud Model</span>
        <input
          value={settings.cloudModel}
          onChange={(event) => onChange({ ...settings, cloudModel: event.target.value })}
        />
      </label>

      <div className="editor-ai-panel__key">
        <label className="editor-ai-panel__field">
          <span>API Key</span>
          <input
            type="password"
            value={keyInput}
            autoComplete="off"
            placeholder={keyState === 'KEY STORED' ? '•••••••• (stored)' : 'not set'}
            onChange={(event) => setKeyInput(event.target.value)}
          />
        </label>
        <div className="editor-ai-panel__key-actions">
          <button type="button" disabled={busy || keyInput.length === 0} onClick={() => void saveKey()}>
            保存到系统钥匙串
          </button>
          <button type="button" disabled={busy} onClick={() => void onClearKey()}>
            清除 Key
          </button>
        </div>
        <span className={`editor-ai-panel__key-state is-${keyState.toLowerCase().replaceAll(' ', '-')}`}>
          {keyState}
        </span>
      </div>

      <div className="editor-ai-panel__actions">
        <button type="button" disabled={busy} onClick={onTest}>Test Connection</button>
        <button type="button" disabled={busy} onClick={onGenerate}>Generate Keyframes</button>
        <button type="button" disabled={busy} onClick={onSaveSettings}>Save AI Settings</button>
      </div>

      <div className="editor-ai-panel__status" role="status">
        <span>STATUS / {generation.status.toUpperCase()}</span>
        <span>PROVIDER / {generation.provider ?? '—'}</span>
        <span>FALLBACK / {generation.fallbackUsed ? 'YES' : 'NO'}</span>
        {generation.reason ? <span>REASON / {generation.reason}</span> : null}
        <span>PROPOSALS / {proposals.length}</span>
      </div>

      {proposals.length > 0 ? (
        <div className="editor-ai-panel__proposals">
          <p>AI PROPOSED / {proposals.length} KEYFRAMES</p>
          <div className="editor-ai-panel__proposal-actions">
            <button type="button" onClick={onConfirm}>Confirm &amp; Undoable</button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
