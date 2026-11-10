import type { PointerEvent as ReactPointerEvent } from 'react';

interface EditorAssetShelfProps {
  readonly logoUrl: string;
  readonly audioName: string | null;
  readonly videoName: string | null;
  readonly audioAssets: readonly { readonly id: string; readonly label: string }[];
  readonly mode: 'ROU' | 'NEU';
  readonly selectedAssetId: string | null;
  readonly onSelectAsset: (assetId: string) => void;
  readonly onAssetPointerDown: (assetId: string, label: string, event: ReactPointerEvent) => void;
}

interface ShelfAsset {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly image?: string;
  readonly glyph: string;
}

/** 左侧资源栏：ROU/NEU 共用；拖动只传接口名，具体绑定由后续资产模块处理。 */
export function EditorAssetShelf({
  logoUrl,
  audioName,
  videoName,
  audioAssets: layerAudioAssets,
  mode,
  selectedAssetId,
  onSelectAsset,
  onAssetPointerDown,
}: EditorAssetShelfProps) {
  const assets: readonly ShelfAsset[] = [
    {
      id: 'asset:guidance:head-logo',
      name: 'head-logo',
      kind: '引导 / 图片',
      image: logoUrl,
      glyph: 'LOGO',
    },
    ...(videoName ? [{
      id: 'asset:video:foreground',
      name: videoName,
      kind: '视频 / 前景',
      glyph: 'VIDEO',
    }] : []),
    {
      id: 'asset:audio:main',
      name: audioName ?? 'audio.wav',
      kind: '音频 / 音乐',
      glyph: 'AUDIO',
    },
    ...layerAudioAssets
      .filter((asset) => asset.id !== 'asset:audio:main')
      .map((asset) => ({
        id: asset.id,
        name: asset.label,
        kind: '音频 / SFX',
        glyph: 'SFX',
      })),
    {
      id: 'asset:event:interface',
      name: '事件接口',
      kind: '事件 / 触发',
      glyph: 'EVENT',
    },
    {
      id: mode === 'ROU' ? 'asset:mark:trace' : 'asset:logic:and',
      name: mode === 'ROU' ? '痕 / Trace' : '逻辑 / AND',
      kind: mode === 'ROU' ? '痕 / 遮罩触发' : '逻辑 / 模块',
      glyph: mode === 'ROU' ? 'TRACE' : 'LOGIC',
    },
    {
      id: 'asset:subtitle:default',
      name: '字幕',
      kind: '资源 / 文本',
      glyph: 'TEXT',
    },
  ];

  return (
    <aside className="editor-assets" aria-label="Assets">
      <header>
        <span className="editor-eyebrow">ASSETS</span>
        <strong>引导 / 资源</strong>
      </header>
      <div className="editor-assets__scroll">
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            data-asset-id={asset.id}
            className={`editor-asset${selectedAssetId === asset.id ? ' is-selected' : ''}`}
            onPointerDown={(event) => {
              onSelectAsset(asset.id);
              onAssetPointerDown(asset.id, asset.name, event);
            }}
            onClick={() => onSelectAsset(asset.id)}
            onContextMenu={(event) => event.preventDefault()}
            title={`${asset.name} · ${asset.kind}（拖到时间轴/蓝图）`}
          >
            <span className="editor-asset__thumb">
              {asset.image ? <img src={asset.image} alt="" draggable={false} /> : asset.glyph}
            </span>
            <span className="editor-asset__copy">
              <b>{asset.name}</b>
              <small>{asset.kind}</small>
            </span>
          </button>
        ))}
      </div>
      <footer>
        <span>DRAG TO KEY</span>
        <span>{mode}</span>
      </footer>
    </aside>
  );
}
