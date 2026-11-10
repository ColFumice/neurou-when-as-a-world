/**
 * R · director / types
 * 玩家敲击意图载荷。R4a 首次落盘。
 *
 * 只定义输入意图；不引用 GridStrike / FrameAlignedStrike，不写账本。
 */

/**
 * 敲击意图。
 *
 * - `phase` 缺省为 `Down`；Hold 的释放用 `Up`。
 * - `source` 缺省为 `Keyboard`；指针点击用 `Pointer`。
 * - `chartKeyId` 是逻辑键身份（含 Space）；`gridCellId` 是第 2 层的 1..8 格位。
 */
export interface Strike {
  readonly timeMs: number;
  readonly chartKeyId?: string;
  readonly gridCellId?: number;
  readonly phase?: 'Down' | 'Up';
  readonly source?: 'Keyboard' | 'Pointer';
}
