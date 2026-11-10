/** P · parallax：三层 UV/偏移，只读。 */

export interface ForegroundUV {
  readonly u: number;
  readonly v: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface MidgroundUV {
  readonly u: number;
  readonly v: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface BackgroundUV {
  readonly u: number;
  readonly v: number;
  readonly offsetX: number;
  readonly offsetY: number;
}
