// ============================================================
// C 谱面域 · KeyboardPadLayout 键盘打击垫布局（名库 v2.5）
//
// 依据：
// - HANDOFF-ROUND-18 冻结数据契约：
//     KeyboardPadLayout(layoutVersion, slots)；
//     KeyPadSlot(keyId, padKind, u, v, width, height)；
//     ChartKeyId 为键位白名单规范标识；
//     ChartPadKind = Regular / Drum / Heavy。
// - VERDICT-121：物理键身份判定，不依赖输入字符。
//
// 职责：
//   只承载版本化的归一化布局与 keyId → KeyPadSlot 查询；
//   槽位坐标为 0~1 归一化（u 左→右，v 下→上），
//   不同分辨率使用相同逻辑槽位（AC-19）。
//
// 算法适配（ColorMusic，只保留语义，不整段照搬）：
//   - 内容坐标 / 网格坐标分离（A-001 / A-002）：
//       本布局只描述独立归一化网格空间，不读取图片像素坐标；
//       黑边（视频有效区域外）由 presentation 先排除。
//   - 网格区域归属（B-020）：
//       谱面改为物理键身份直查 keyId → KeyPadSlot，
//       不再由指针坐标落格；保留“确定性唯一归属”语义。
//
// 禁止：本文件零 cc 依赖；不读取节点位置；不放媒体资源。
// ============================================================

// ------------------------------------------------------------
// 键位白名单（VERDICT-121）
// ------------------------------------------------------------

/**
 * ChartKeyId 谱面键位规范标识。
 *
 * 取值即物理键身份（KeyboardEvent.code 口径），与输入字符无关：
 *   - 26 英文键 KeyA~KeyZ；
 *   - 11 主键区符号键；
 *   - 10 数字键 Digit0~Digit9（小键盘 Numpad0~9 由 presentation
 *     规范化为同编号 Digit0~Digit9，不产生独立标识）；
 *   - Space。
 * Shift 不产生新标识。
 */
export type ChartKeyId =
  // 26 英文物理码
  | 'KeyA' | 'KeyB' | 'KeyC' | 'KeyD' | 'KeyE' | 'KeyF' | 'KeyG' | 'KeyH'
  | 'KeyI' | 'KeyJ' | 'KeyK' | 'KeyL' | 'KeyM' | 'KeyN' | 'KeyO' | 'KeyP'
  | 'KeyQ' | 'KeyR' | 'KeyS' | 'KeyT' | 'KeyU' | 'KeyV' | 'KeyW' | 'KeyX'
  | 'KeyY' | 'KeyZ'
  // 11 主键区符号码
  | 'Backquote' | 'Minus' | 'Equal'
  | 'BracketLeft' | 'BracketRight' | 'Backslash'
  | 'Semicolon' | 'Quote'
  | 'Comma' | 'Period' | 'Slash'
  // 10 数字键（小键盘同编号规范化到此）
  | 'Digit0' | 'Digit1' | 'Digit2' | 'Digit3' | 'Digit4'
  | 'Digit5' | 'Digit6' | 'Digit7' | 'Digit8' | 'Digit9'
  // Heavy
  | 'Space';

/**
 * ChartPadKind 打击垫类别（HANDOFF-ROUND-18 冻结）。
 * Regular：英文 / 符号键；Drum：数字键；Heavy：空格。
 */
export type ChartPadKind = 'Regular' | 'Drum' | 'Heavy';

// 物理行序（左→右），保留行序与错位；仅用于生成默认布局。
const ROW_TOP: readonly ChartKeyId[] = [
  'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal',
];
const ROW_Q: readonly ChartKeyId[] = [
  'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO',
  'KeyP', 'BracketLeft', 'BracketRight', 'Backslash',
];
const ROW_A: readonly ChartKeyId[] = [
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK',
  'KeyL', 'Semicolon', 'Quote',
];
const ROW_Z: readonly ChartKeyId[] = [
  'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM',
  'Comma', 'Period', 'Slash',
];

/** 全量键位白名单（去重后 48 项），供采集层做成员校验。 */
export const CHART_KEY_IDS: readonly ChartKeyId[] = [
  ...ROW_TOP, ...ROW_Q, ...ROW_A, ...ROW_Z, 'Space',
];

const DIGIT_KEYS: ReadonlySet<ChartKeyId> = new Set<ChartKeyId>([
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
]);

/** 解析键位类别（数字 Drum、空格 Heavy、其余 Regular）。 */
function kindOf(keyId: ChartKeyId): ChartPadKind {
  if (keyId === 'Space') {
    return 'Heavy';
  }
  if (DIGIT_KEYS.has(keyId)) {
    return 'Drum';
  }
  return 'Regular';
}

// ------------------------------------------------------------
// 数据契约
// ------------------------------------------------------------

/**
 * KeyPadSlot 单个打击垫槽位（HANDOFF-ROUND-18 冻结）。
 * 所有坐标均为视频有效区域内的归一化值。
 */
export interface KeyPadSlot {
  /** 槽位规范标识。 */
  readonly keyId: ChartKeyId;
  /** 打击垫类别。 */
  readonly padKind: ChartPadKind;
  /** 槽位左下角归一化横坐标（左→右）。 */
  readonly u: number;
  /** 槽位左下角归一化纵坐标（下→上）。 */
  readonly v: number;
  /** 归一化宽度。 */
  readonly width: number;
  /** 归一化高度。 */
  readonly height: number;
}

/**
 * KeyboardPadLayout 键盘打击垫布局（HANDOFF-ROUND-18 冻结）。
 * 仅含 layoutVersion 与 slots 两个数据成员。
 */
export interface KeyboardPadLayout {
  /** 布局版本；谱面资源须声明同一版本，否则拒绝加载。 */
  readonly layoutVersion: string;
  /** 全部逻辑槽位（不同分辨率共用）。 */
  readonly slots: readonly KeyPadSlot[];
}

/**
 * 默认布局版本（HANDOFF 未冻结字面，值为直译占位，待追认）。
 * 谱面 JSON 的 layoutVersion 必须与此完全一致，
 * 防止布局变更静默改变既有谱面目标。
 */
export const PAD_LAYOUT_VERSION = 'pad-layout-1';

// 行几何：自下而上五条带，统一高度与行距（归一化占位，待表现侧冻结）。
const ROW_HEIGHT = 0.16;
const ROW_V_SPACE = 0.02;
const ROW_V_Z = 0.22;
const ROW_V_A = 0.42;
const ROW_V_Q = 0.62;
const ROW_V_TOP = 0.82;

// 错位：越靠上的行左侧起点越靠左，模拟键盘错位（归一化占位）。
const LEFT_TOP = 0.0;
const LEFT_Q = 0.02;
const LEFT_A = 0.05;
const LEFT_Z = 0.08;
const RIGHT_EDGE = 1.0;

/** 由物理行键序生成一行槽位（均匀分布于 [leftU, 1]）。 */
function buildRow(
  keys: readonly ChartKeyId[],
  vBottom: number,
  leftU: number,
): KeyPadSlot[] {
  const span = RIGHT_EDGE - leftU;
  const slotWidth = span / keys.length;
  return keys.map((keyId, index) => ({
    keyId,
    padKind: kindOf(keyId),
    u: leftU + index * slotWidth,
    v: vBottom,
    width: slotWidth,
    height: ROW_HEIGHT,
  }));
}

/** 校验归一化坐标有限且落在 [0,1]，槽位尺寸为正。 */
function assertSlotValid(slot: KeyPadSlot): void {
  const values = [slot.u, slot.v, slot.width, slot.height];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`KeyboardPadLayout: 槽位 ${slot.keyId} 坐标非有限值`);
  }
  if (slot.width <= 0 || slot.height <= 0) {
    throw new Error(`KeyboardPadLayout: 槽位 ${slot.keyId} 尺寸必须为正`);
  }
  if (slot.u < 0 || slot.v < 0 || slot.u + slot.width > 1 + 1e-9 || slot.v + slot.height > 1 + 1e-9) {
    throw new Error(`KeyboardPadLayout: 槽位 ${slot.keyId} 越出归一化区域`);
  }
}

/**
 * 生成默认键盘打击垫布局（方法名为直译，待追认）。
 *
 * 保留行序（顶行符号/数字、Q、A、Z、Space）、错位，
 * 以及 Space 居中超宽槽位。纯函数、零 cc。
 */
export function createDefaultKeyboardPadLayout(): KeyboardPadLayout {
  const slots: KeyPadSlot[] = [
    ...buildRow(ROW_TOP, ROW_V_TOP, LEFT_TOP),
    ...buildRow(ROW_Q, ROW_V_Q, LEFT_Q),
    ...buildRow(ROW_A, ROW_V_A, LEFT_A),
    ...buildRow(ROW_Z, ROW_V_Z, LEFT_Z),
    // Heavy：Space 居中超宽槽位。
    {
      keyId: 'Space',
      padKind: 'Heavy',
      u: 0.25,
      v: ROW_V_SPACE,
      width: 0.5,
      height: ROW_HEIGHT,
    },
  ];
  slots.forEach(assertSlotValid);
  return { layoutVersion: PAD_LAYOUT_VERSION, slots };
}

/**
 * keyId → KeyPadSlot 查询（方法名为直译，待追认）。
 *
 * 适配自网格区域归属算法：以物理键身份确定性地归属唯一槽位。
 * 未在布局中登记的键返回 undefined（调用方据此拒绝）。
 */
export function getSlot(
  layout: KeyboardPadLayout,
  keyId: ChartKeyId,
): KeyPadSlot | undefined {
  return layout.slots.find((slot) => slot.keyId === keyId);
}
