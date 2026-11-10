// ============================================================
// 服务域 · AuthService 登录服务接口
// 名库冻结名：AuthService（服务域）
// ROUND-09 补充裁定：fetchServerTime(): Promise<number>
// ROUND-11：login / logout / verify 方法名与
//   fetchServerTime 方法签名经 HANDOFF 正式追认冻结
// 本文件仅包含方法签名，无任何实现
// ============================================================

/**
 * AuthService 登录服务
 * 方法范围：HANDOFF-ROUND-04 的登录 / 登出 / 验证，
 * 以及 ROUND-09 补充裁定的获取服务器时间（均经 ROUND-11
 * 追认冻结）。
 *
 * 凭据、令牌、会话（Session 为保留字）等结构名均未冻结，
 * login / logout / verify 签名暂不引入参数，避免臆造结构名。
 */
export interface AuthService {
  /** 登录（仅签名；凭据结构待冻结，无实现） */
  login(): void;

  /** 登出（仅签名，无实现） */
  logout(): void;

  /** 验证（仅签名；凭据 / 令牌结构待冻结，无实现） */
  verify(): boolean;

  /**
   * 获取服务器当前时间（ROUND-09 补充裁定，逐字签名）
   *
   * 用途：RealityPause 以服务器时间为准进行倒计时；
   * 本地只负责显示，不允许以本地时钟替代服务器时间。
   *
   * @returns 服务器纪元毫秒时间戳（与 WallClock.epochMs 同口径）
   */
  fetchServerTime(): Promise<number>;
}
