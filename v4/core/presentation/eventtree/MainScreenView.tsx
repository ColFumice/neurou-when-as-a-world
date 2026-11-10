import { useMemo, useState } from 'react';
import type { EventTreeDAG } from '../../eventgraph/EventTree';
import { EventTreeView } from './EventTreeView';
import { WorldFolderConsole } from '../console/WorldFolderConsole';
import { WorldFolderEntryKind } from '../console/WorldFolderEntryKind';
import type { WorldFileEntry } from '../console/WorldFileEntry';

interface MainScreenViewProps {
  dag: EventTreeDAG;
  diagnostics: readonly {
    readonly severity: 'ERROR' | 'WARN';
    readonly code: string;
    readonly message: string;
  }[];
  worlds: readonly { readonly worldId: string; readonly kind: string }[];
  onAddNode: () => void;
  onRemoveNode: (nodeId: string) => void;
  onAddEdge: (fromNodeId: string, toNodeId: string) => void;
  onRemoveEdge: (edgeId: string) => void;
}

export function MainScreenView({
  dag,
  diagnostics,
  worlds,
  onAddNode,
  onRemoveNode,
  onAddEdge,
  onRemoveEdge,
}: MainScreenViewProps) {
  const [activeWorldId, setActiveWorldId] = useState<string | null>(null);
  const errors = diagnostics.filter((item) => item.severity === 'ERROR');
  const warnings = diagnostics.filter((item) => item.severity === 'WARN');

  const consoleEntries = useMemo<readonly WorldFileEntry[]>(() => {
    if (!activeWorldId) return [];
    return [
      {
        entryId: `${activeWorldId}:start`,
        displayName: 'start.exe',
        kind: WorldFolderEntryKind.WorldExe,
      },
      {
        entryId: `${activeWorldId}:assets`,
        displayName: 'assets',
        kind: WorldFolderEntryKind.Folder,
      },
      {
        entryId: `${activeWorldId}:settings`,
        displayName: 'settings.ini',
        kind: WorldFolderEntryKind.Settings,
      },
    ];
  }, [activeWorldId]);

  if (activeWorldId) {
    const activeWorld = worlds.find((world) => world.worldId === activeWorldId);
    return (
      <WorldFolderConsole
        key={activeWorldId}
        worldId={activeWorldId}
        worldName={activeWorld?.worldId ?? activeWorldId}
        entries={consoleEntries}
        onBack={() => setActiveWorldId(null)}
        onExport={() => undefined}
      />
    );
  }

  return (
    <section className="main-screen" aria-label="主界面">
      <header className="main-screen__header">
        <div>
          <p className="main-screen__eyebrow">PROJECT / EVENT TREE</p>
          <h2>项目事件树</h2>
        </div>
        <p className="main-screen__summary">
          {dag.nodes.length} 节点 / {dag.edges.length} 边 / root {dag.rootNodeId ?? '—'}
        </p>
      </header>

      <div className="main-screen__body">
        <EventTreeView
          dag={dag}
          onAddNode={onAddNode}
          onRemoveNode={onRemoveNode}
          onAddEdge={onAddEdge}
          onRemoveEdge={onRemoveEdge}
          onOpenNode={(_nodeId, worldId) => setActiveWorldId(worldId)}
        />

        <aside className="main-screen__side">
          <p className="main-screen__eyebrow">WORLD ENTRIES</p>
          <h3>世界入口</h3>
          <ul className="world-list">
            {worlds.map((world) => (
              <li key={world.worldId}>
                <span className={`world-list__dot world-list__dot--${world.kind.toLowerCase()}`} />
                <span>{world.worldId}</span>
                <small>{world.kind}</small>
              </li>
            ))}
          </ul>
          <p className="main-screen__placeholder">
            双击事件树节点（或选中后点“进入世界”）进入 cmd 风格世界文件夹。
          </p>
        </aside>
      </div>

      <footer className="main-screen__diagnostics" aria-live="polite">
        {errors.length === 0 && warnings.length === 0 ? (
          <span className="is-ok">校验通过</span>
        ) : (
          <>
            {errors.length > 0 ? (
              <span className="is-error">{errors.length} ERROR</span>
            ) : null}
            {warnings.length > 0 ? (
              <span className="is-warn">{warnings.length} WARN</span>
            ) : null}
            <ul>
              {diagnostics.map((item, index) => (
                <li key={`${item.code}-${index}`} className={item.severity === 'ERROR' ? 'is-error' : 'is-warn'}>
                  [{item.severity}] {item.code}: {item.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </footer>
    </section>
  );
}
