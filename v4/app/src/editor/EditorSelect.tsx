import { useEffect, useRef, useState } from 'react';

export interface EditorSelectOption {
  readonly value: string;
  readonly label: string;
}

interface EditorSelectProps {
  readonly value: string;
  readonly options: readonly EditorSelectOption[];
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly ariaLabel?: string;
}

/** 深色玻璃下拉；替换原生 select，避免 WebView2 的浅色系统菜单。 */
export function EditorSelect({
  value,
  options,
  onChange,
  placeholder = '选择',
  className = '',
  ariaLabel,
}: EditorSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent): void => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`editor-select ${className}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className={`editor-select__button${open ? ' is-open' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span>{selected?.label ?? placeholder}</span>
        <i>⌄</i>
      </button>
      {open ? (
        <div className="editor-select__menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? 'is-active' : ''}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
