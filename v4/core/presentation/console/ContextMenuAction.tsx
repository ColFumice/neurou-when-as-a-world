import type { MouseEvent } from 'react';

interface ContextMenuActionProps {
  x: number;
  y: number;
  onNew: () => void;
  onDelete: () => void;
  onExport: () => void;
  onClose: () => void;
}

export function ContextMenuAction({
  x,
  y,
  onNew,
  onDelete,
  onExport,
  onClose,
}: ContextMenuActionProps) {
  const choose = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    action();
    onClose();
  };

  return (
    <div
      className="console-context-menu"
      role="menu"
      aria-label="世界文件操作"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={(event) => choose(event, onNew)}>
        新建
      </button>
      <button type="button" role="menuitem" onClick={(event) => choose(event, onDelete)}>
        删除
      </button>
      <button type="button" role="menuitem" onClick={(event) => choose(event, onExport)}>
        导出
      </button>
    </div>
  );
}
