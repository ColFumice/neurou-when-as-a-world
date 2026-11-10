/**
 * T · trace / visibility
 * 可见性状态与四类转换原因；不 import chart / director。
 */

/** 可见性状态：Revealed / Concealed。 */
export enum VisibilityState {
  Revealed = 'Revealed',
  Concealed = 'Concealed',
}

/** 可见性转换原因：FrameAligned / FrameLost / EnterPerception / ExitPerception。 */
export enum VisibilityTransitionReason {
  FrameAligned = 'FrameAligned',
  FrameLost = 'FrameLost',
  EnterPerception = 'EnterPerception',
  ExitPerception = 'ExitPerception',
}