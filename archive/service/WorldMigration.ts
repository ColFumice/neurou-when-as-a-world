// ============================================================
// 服务域 · WorldMigration 终末彼岸迁移
// 名库冻结名（ROUND-09 补充裁定逐字冻结）：
//   MigrationRelease、MigrationClaim、RealityPause、
//   ShoreOrigin(BugShore / FinalShore)
// 关联冻结名：AuthService.fetchServerTime、WallClock、
//   WorldInstance（迁移侧读取 ShoreOrigin）、
//   OfflineGrace / OFFLINE_GRACE_HOURS（RealityPause 时长下界）
//
// 命名状态（HANDOFF-ROUND-11）：
// - 注入端口 readShoreOrigin（读取 WorldInstance 的
//   ShoreOrigin）、localClock（提供本地 WallClock）：
//   ROUND-11 正式追认冻结；
// - RealityPause 的 start / remainingMs / isAccountFrozen /
//   canSwitchAccount / end 五方法：ROUND-11 追认冻结；
// - 文件内未导出的私有结构 ReleasedMigration 及其字段
//   不在追认清单，维持直译占位。
// - BugShore 可否走 MigrationRelease：ROUND-11 挂起裁定
//   ——保持现状（只校验 ShoreOrigin 存在、不阻断），
//   待 ARCHITECT 后续裁定。
//
// 名库 v1.1 规则（逐条落地，不做额外决策）：
// - 终末彼岸只属于本人、不可复制、可迁移；
// - RealityPause 以服务器时间为准；时长不短于离线宽限；
//   冻结整个账号；发起设备不能切换账号；
// - WorldCommit 与 CommitRelay 对迁移流程“预留旁路、
//   不许干预”：本文件零 import WorldCommit / CommitRelay，
//   迁移不产生提交、不经中继。
//
// 逻辑边界：
// - 本文件不写任何网络同步（ObserverSync 未触碰）；
//   唯一网络动作为 AuthService.fetchServerTime（HANDOFF
//   明确授权“调用 AuthService 获取服务器时间”）；
// - 已释放状态当前为进程内内存占位，持久化载体未冻结；
// - “发起设备”的设备标识类型名库未冻结，设备维度的切换
//   拦截仅以注释声明，未臆造设备 ID 类型（见报告）。
// ============================================================

import { OFFLINE_GRACE_HOURS } from '../../constants';
import type { WallClock } from '../world/WorldInstance';
import type { AuthService } from './AuthService';

/**
 * ShoreOrigin 彼岸来源（名库彼岸域冻结取值）
 * BugShore（缺陷彼岸）/ FinalShore（终末彼岸）
 */
export enum ShoreOrigin {
  BugShore,
  FinalShore,
}

/**
 * RealityPause 现实暂停（迁移冻结期）
 *
 * 倒计时口径：启动时向 AuthService 请求一次服务器时间作为
 * 基准，此后以本地时钟流逝量估算服务器当前时刻——本地只
 * 负责显示，判定基准始终是服务器时间。
 */
export class RealityPause {
  /** 当前被冻结的账号；null 表示无冻结 */
  private frozenAccountId: string | null = null;
  /** 启动时刻的服务器纪元毫秒（基准） */
  private startServerEpochMs: number | null = null;
  /** 启动时刻的本地纪元毫秒（与服务器基准配对） */
  private startLocalEpochMs = 0;

  /**
   * @param auth 登录服务（仅用于 fetchServerTime）
   * @param durationMs 暂停时长（毫秒），构造即断言
   *   “不短于离线宽限（OFFLINE_GRACE_HOURS）”
   */
  constructor(
    private readonly auth: AuthService,
    private readonly durationMs: number,
  ) {
    const offlineGraceMs = OFFLINE_GRACE_HOURS * 60 * 60 * 1000;
    if (durationMs < offlineGraceMs) {
      throw new Error(
        'RealityPause 时长不得短于离线宽限（OFFLINE_GRACE_HOURS）',
      );
    }
  }

  /**
   * 启动冻结：以服务器时间为准记录基准，并冻结整个账号
   *
   * @returns 启动时刻的服务器纪元毫秒（供迁移记录留档）
   */
  async start(accountId: string, local: WallClock): Promise<number> {
    if (this.frozenAccountId !== null) {
      throw new Error('RealityPause 已在冻结中，禁止重复启动');
    }

    const serverEpochMs = await this.auth.fetchServerTime();

    this.frozenAccountId = accountId;
    this.startServerEpochMs = serverEpochMs;
    this.startLocalEpochMs = local.epochMs;

    return serverEpochMs;
  }

  /**
   * 剩余冻结时长（毫秒）——本地显示用
   *
   * 估算服务器当前时刻 = 启动服务器时刻 + 本地流逝量；
   * 未启动时剩余为 0；到期不为负（归零截断）。
   */
  remainingMs(local: WallClock): number {
    if (this.frozenAccountId === null || this.startServerEpochMs === null) {
      return 0;
    }

    const estimatedServerNow =
      this.startServerEpochMs + (local.epochMs - this.startLocalEpochMs);
    const deadlineServerMs = this.startServerEpochMs + this.durationMs;

    return Math.max(0, deadlineServerMs - estimatedServerNow);
  }

  /** 账号是否处于冻结中（“冻结整个账号”的查询口） */
  isAccountFrozen(accountId: string): boolean {
    return this.frozenAccountId === accountId;
  }

  /**
   * 是否允许切换账号
   *
   * 名库规则“发起设备不能切换账号”：当前仅实现账号冻结维度
   * （冻结中一律不允许）；设备标识类型未冻结，设备维度拦截
   * 待名库补全后接入，此处不臆造设备 ID。
   */
  canSwitchAccount(): boolean {
    return this.frozenAccountId === null;
  }

  /** 结束冻结（由 MigrationClaim 调起），复位全部基准 */
  end(): void {
    this.frozenAccountId = null;
    this.startServerEpochMs = null;
    this.startLocalEpochMs = 0;
  }
}

/**
 * 已释放迁移记录（文件内私有，不导出名库外名称）
 */
interface ReleasedMigration {
  readonly worldId: string;
  readonly accountId: string;
  readonly releaseServerEpochMs: number;
}

/**
 * WorldMigration 世界迁移（MigrationRelease / MigrationClaim）
 */
export class WorldMigration {
  /** 已释放待认领记录，按 worldId 索引（内存占位） */
  private readonly released = new Map<string, ReleasedMigration>();

  /**
   * @param realityPause 迁移冻结期（服务器时间倒计时）
   * @param readShoreOrigin 读取端口（ROUND-11 追认冻结）：
   *   按 worldId 读取 WorldInstance 的 ShoreOrigin；
   *   返回 null 表示世界不存在
   * @param localClock 本地时钟端口（ROUND-11 追认冻结），
   *   提供 WallClock（仅供 RealityPause 本地显示配准，
   *   不替代服务器时间）
   */
  constructor(
    private readonly realityPause: RealityPause,
    private readonly readShoreOrigin: (worldId: string) => ShoreOrigin | null,
    private readonly localClock: () => WallClock,
  ) {}

  /**
   * MigrationRelease 释放迁移
   *
   * 流程（严格按名库规则，无额外业务决策）：
   * 1. 读取 WorldInstance 的 ShoreOrigin，不存在则拒绝；
   * 2. 同一世界禁止重复释放；目标账号已在冻结中则拒绝；
   * 3. 启动 RealityPause（内部向 AuthService 取服务器时间，
   *    时长构造时已保证不短于离线宽限）；
   * 4. 留档释放记录（服务器时刻）。
   *
   * 旁路声明：全程不触碰 WorldCommit / CommitRelay
   * （预留旁路，不许干预），不产生任何提交。
   *
   * 说明：ROUND-11 挂起裁定——BugShore 是否可走
 * MigrationRelease 保持现状：只校验 ShoreOrigin 存在、
 * 不阻断 BugShore，待 ARCHITECT 后续裁定。
   */
  async migrationRelease(
    worldId: string,
    accountId: string,
  ): Promise<void> {
    const shoreOrigin = this.readShoreOrigin(worldId);
    if (shoreOrigin === null) {
      throw new Error('迁移释放失败：世界不存在或无 ShoreOrigin');
    }

    if (this.released.has(worldId)) {
      throw new Error('迁移释放失败：该世界已处于释放待认领状态');
    }

    if (this.realityPause.isAccountFrozen(accountId)) {
      throw new Error('迁移释放失败：账号处于 RealityPause 冻结中');
    }

    const releaseServerEpochMs = await this.realityPause.start(
      accountId,
      this.localClock(),
    );

    this.released.set(worldId, {
      worldId,
      accountId,
      releaseServerEpochMs,
    });
  }

  /**
   * MigrationClaim 认领迁移
   *
   * 流程：
   * 1. 释放记录必须存在；
   * 2. 认领账号必须与释放账号一致（终末彼岸只属于本人）；
   * 3. 结束 RealityPause，移除释放记录。
   *
   * 旁路声明：同样不触碰 WorldCommit / CommitRelay。
   */
  async migrationClaim(
    worldId: string,
    accountId: string,
  ): Promise<void> {
    const record = this.released.get(worldId);
    if (!record) {
      throw new Error('迁移认领失败：不存在该世界的释放记录');
    }

    if (record.accountId !== accountId) {
      throw new Error('迁移认领失败：终末彼岸只属于本人，账号不匹配');
    }

    this.realityPause.end();
    this.released.delete(worldId);
  }
}
