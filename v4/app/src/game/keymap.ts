import type { Strike } from '@core/director/types';
import type { GridCellId } from '@core/chart/types';

export interface KeyBinding {
  readonly code: string;
  readonly chartKeyId: string;
  readonly gridCellId?: GridCellId;
}

/**
 * 用户指定的 2×4 键盘区域：
 * 上排 123QWE / 456RTY / 789UIO / 0-=P[]
 * 下排 ASDZXC / FGHVB  / JKLNM< / ："|>?
 *
 * 字母/数字/符号按 event.code 映射；Shift 后的符号自动跟随同一个 code。
 */
const ZONE_CODES: Readonly<Record<GridCellId, readonly string[]>> = {
  1: ['Digit1', 'Digit2', 'Digit3', 'KeyQ', 'KeyW', 'KeyE'],
  2: ['Digit4', 'Digit5', 'Digit6', 'KeyR', 'KeyT', 'KeyY'],
  3: ['Digit7', 'Digit8', 'Digit9', 'KeyU', 'KeyI', 'KeyO'],
  4: ['Digit0', 'Minus', 'Equal', 'KeyP', 'BracketLeft', 'BracketRight'],
  5: ['KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC'],
  6: ['KeyF', 'KeyG', 'KeyH', 'KeyV', 'KeyB'],
  7: ['KeyJ', 'KeyK', 'KeyL', 'KeyN', 'KeyM', 'Comma'],
  8: ['Semicolon', 'Quote', 'Backslash', 'Period', 'Slash'],
};

const ZONE_BY_CODE = new Map<string, GridCellId>();
for (const cellText of Object.keys(ZONE_CODES)) {
  const cell = Number(cellText) as GridCellId;
  for (const code of ZONE_CODES[cell]) ZONE_BY_CODE.set(code, cell);
}

const ZONE_LABELS: Readonly<Record<GridCellId, string>> = {
  1: '1 2 3\nQ W E',
  2: '4 5 6\nR T Y',
  3: '7 8 9\nU I O',
  4: '0 - =\nP [ ]',
  5: 'A S D\nZ X C',
  6: 'F G H\nV B',
  7: 'J K L\nN M <',
  8: ': " |\n> ?',
};

const MODIFIERS = new Set([
  'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
]);

export function isModifierCode(code: string): boolean {
  return MODIFIERS.has(code);
}

/** 物理键 → 8 格区域；Space 返回 null（第 1 层专用）。 */
export function gridCellForKey(code: string): GridCellId | null {
  return ZONE_BY_CODE.get(code) ?? null;
}

export function zoneLabel(cell: GridCellId): string {
  return ZONE_LABELS[cell];
}

/** 兼容旧名：Space 或某个 8 格区域。 */
export function bindingForCode(code: string): KeyBinding | null {
  if (code === 'Space') return { code, chartKeyId: 'Space' };
  if (isModifierCode(code)) return null;
  const cell = ZONE_BY_CODE.get(code);
  if (cell === undefined) return { code, chartKeyId: code };
  return { code, chartKeyId: `Grid${cell}`, gridCellId: cell };
}

export function strikeFromKey(
  code: string,
  phase: 'Down' | 'Up',
  timeMs: number,
): Strike | null {
  const binding = bindingForCode(code);
  if (!binding) return null;
  return {
    timeMs,
    chartKeyId: binding.chartKeyId,
    ...(binding.gridCellId === undefined ? {} : { gridCellId: binding.gridCellId }),
    phase,
    source: 'Keyboard',
  };
}
