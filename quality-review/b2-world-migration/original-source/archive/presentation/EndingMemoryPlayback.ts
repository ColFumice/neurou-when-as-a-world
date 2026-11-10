// ============================================================
// 表现层（终末回映）· EndingMemoryPlayback 回映播放
// 名库冻结名（ROUND-09 补充裁定逐字冻结）：
//   EndingScope(World / Final)、EndingManifest、EndingItem、
//   EmpathyWeightedShare、MixedVideoDurationCap、
//   GlitchGapDurationCap、EndingProgress、LocalEndingStorage、
//   StackedFrame（回映域）
// 关联冻结名：MomentImage、ProcessedMomentImage、WallClock、
//   EndingMemoryDuration（S5 叙事导演域）
// 常量：MIXED_VIDEO_CAP_RATIO（0.3）/ GLITCH_GAP_CAP_RATIO（0.1）
//
// 命名状态（HANDOFF-ROUND-11 正式追认冻结）：
// - EndingItem.image / durationMs / sourceRecordId：
//   PROTOCOL ROUND-09 逐字指定字段；
// - EndingManifest 五字段（scope / frozenAt / items /
//   mixedVideoDurationCapMs / glitchGapDurationCapMs）、
//   EndingProgress 两字段（playedItemIndex / elapsedMs）；
// - 类内方法 resolveEndingScope / createManifest /
//   saveProgress / loadProgress 均经 ROUND-11 追认；
// - 私有方法 allocateShares 与文件内私有结构
//   EndingItemSource（含 empathyWeight）不在追认清单，
//   维持“直译待追认”状态；
// - LocalEndingStorage：ROUND-11 挂起裁定确认可继续使用
//   内存 Map 占位，真实持久化介质待后续裁定。
//
// 逻辑边界：
// - Manifest 在回映开始时一次性冻结（readonly），播放顺序、
//   每张截图时长（EmpathyWeightedShare）、两项分配上限
//   （Mixed/Glitch Cap）此后不可变；
// - EmpathyWeightedShare 只实现“按权重占总时长比例分配”的
//   数学直定义，无平衡系数；
// - 进度存取只经 LocalEndingStorage（账号层本地存储，非
//   SafePoint 体系，不依赖任何网络同步）；
// - 本文件不含视频混剪与画面渲染实现。
// ============================================================

import {
  MIXED_VIDEO_CAP_RATIO,
  GLITCH_GAP_CAP_RATIO,
} from '../../constants';
import type { WallClock } from '../world/WorldInstance';
import type { MomentImage, ProcessedMomentImage } from './MomentCapture';
import type { EndingMemoryDuration } from '../director/EndingWindow';

/**
 * EndingScope 回映范围
 * 冻结取值：World（世界回映）/ Final（终末回映）
 *
 * 与 FinalEnding 的关系（PROTOCOL 裁定）：FinalEnding 是事件
 * 触发器（终末彼岸首演完成后被调用），本枚举的 Final 是回映
 * 播放时的范围属性；FinalEnding 触发后以 EndingScope.Final
 * 调起本回映，二者互补不冲突。
 */
export enum EndingScope {
  World,
  Final,
}

/**
 * EmpathyWeightedShare 共情加权份额（单位：毫秒）
 * 表示单张截图按共情权重在回映总时长中分得的时长。
 */
export type EmpathyWeightedShare = number;

/** MixedVideoDurationCap 混剪分配上限（单位：毫秒） */
export type MixedVideoDurationCap = number;

/** GlitchGapDurationCap 缺口分配上限（单位：毫秒） */
export type GlitchGapDurationCap = number;

/**
 * EndingItem 回映条目（PROTOCOL ROUND-09 逐字指定结构）
 */
export interface EndingItem {
  /**
   * 条目画面：MomentImage 或 ProcessedMomentImage；
   * 名库回映域冻结名 StackedFrame 结构冻结后可替代本字段类型
   * （“可被 StackedFrame 替代”，当前结构未冻结，暂不引入）。
   */
  readonly image: MomentImage | ProcessedMomentImage;

  /** 本张截图时长（毫秒，由 EmpathyWeightedShare 计算） */
  readonly durationMs: number;

  /** 来源记录标识（如账号层记录 / 通关记录标识） */
  readonly sourceRecordId: string;
}

/**
 * EndingManifest 回映清单
 * 回映开始时冻结，此后整体只读。
 */
export interface EndingManifest {
  /** 回映范围（World / Final） */
  readonly scope: EndingScope;

  /** 清单冻结时刻（WallClock 口径） */
  readonly frozenAt: WallClock;

  /** 播放顺序（数组顺序即冻结的播放顺序，不可重排） */
  readonly items: readonly EndingItem[];

  /** 混剪分配上限（毫秒，= 总时长 × MIXED_VIDEO_CAP_RATIO） */
  readonly mixedVideoDurationCapMs: MixedVideoDurationCap;

  /** 缺口分配上限（毫秒，= 总时长 × GLITCH_GAP_CAP_RATIO） */
  readonly glitchGapDurationCapMs: GlitchGapDurationCap;
}

/**
 * EndingProgress 回映播放进度
 * 仅描述播放位置，不包含任何存档同步字段。
 */
export interface EndingProgress {
  /** 已播放到的条目序号（对应 EndingManifest.items 下标） */
  readonly playedItemIndex: number;

  /** 当前条目内已播放时长（毫秒） */
  readonly elapsedMs: number;
}

/**
 * 回映条目来源（文件内私有输入结构，不导出新名称）
 * 权重 empathyWeight 承载该截图的共情权重，
 * 字段名为直译待追认。
 */
interface EndingItemSource {
  readonly image: MomentImage | ProcessedMomentImage;
  readonly sourceRecordId: string;
  readonly empathyWeight: number;
}

/**
 * LocalEndingStorage 账号层本地回映进度存储
 * （ROUND-09 冻结名；隶属账号层本地存储，非 SafePoint 体系，
 * 不依赖任何网络同步）。
 *
 * 当前为进程内内存占位（按账号隔离）；真实持久化介质
 * （文件 / 平台本地存储）名库尚未冻结，冻结后仅替换本类
 * 内部实现，save / load 签名不变。
 */
export class LocalEndingStorage {
  private readonly byAccount = new Map<string, EndingProgress>();

  /** 保存指定账号的回映进度（覆盖写） */
  save(accountId: string, progress: EndingProgress): void {
    this.byAccount.set(accountId, progress);
  }

  /** 读取指定账号的回映进度；无记录时返回 null */
  load(accountId: string): EndingProgress | null {
    return this.byAccount.get(accountId) ?? null;
  }
}

/**
 * EndingMemoryPlayback 终末回映播放器
 */
export class EndingMemoryPlayback {
  constructor(private readonly storage: LocalEndingStorage) {}

  /**
   * 判断回映范围（EndingScope）
   *
   * @param isFinalEnding 是否由 FinalEnding 事件触发；
   *   true → EndingScope.Final，否则 EndingScope.World
   *   （布尔入参为“触发来源”的直译承载，待追认正式来源类型）
   */
  resolveEndingScope(isFinalEnding: boolean): EndingScope {
    return isFinalEnding ? EndingScope.Final : EndingScope.World;
  }

  /**
   * 回映开始时生成并冻结 EndingManifest
   *
   * @param scope 回映范围
   * @param sources 条目来源（数组顺序即冻结播放顺序）
   * @param totalDuration 回映总时长（秒，S5 域 EndingMemoryDuration，
   *   由 EndingWindow.calculateEndingMemoryDuration 计算得到）
   * @param frozenAt 冻结时刻（WallClock）
   */
  createManifest(
    scope: EndingScope,
    sources: ReadonlyArray<EndingItemSource>,
    totalDuration: EndingMemoryDuration,
    frozenAt: WallClock,
  ): EndingManifest {
    const totalDurationMs = totalDuration * 1000;

    const shares = this.allocateShares(
      sources.map((source) => source.empathyWeight),
      totalDurationMs,
    );

    const items: EndingItem[] = sources.map((source, index) => ({
      image: source.image,
      sourceRecordId: source.sourceRecordId,
      durationMs: shares[index],
    }));

    return {
      scope,
      frozenAt,
      items,
      mixedVideoDurationCapMs: totalDurationMs * MIXED_VIDEO_CAP_RATIO,
      glitchGapDurationCapMs: totalDurationMs * GLITCH_GAP_CAP_RATIO,
    };
  }

  /**
   * EmpathyWeightedShare 分配（加权份额数学直定义）
   *
   * share_i = totalMs × weight_i / Σweight。
   * ROUND-11 正式确认当前阶段保底算法：
   * - 权重负值归零（份额不允许为负）；
   * 权重总和为 0 时退化为 N 条等份额放；
   * - 浮点份额不取整（不引入未授权舍入规则）。
   * 该算法为保底实现，非最终平衡结论。
   */
  private allocateShares(
    weights: ReadonlyArray<number>,
    totalMs: number,
  ): EmpathyWeightedShare[] {
    const safeWeights = weights.map((weight) => Math.max(0, weight));
    const weightSum = safeWeights.reduce((sum, weight) => sum + weight, 0);

    if (weightSum === 0) {
      return safeWeights.map(() =>
        safeWeights.length === 0 ? 0 : totalMs / safeWeights.length,
      );
    }

    return safeWeights.map((weight) => (totalMs * weight) / weightSum);
  }

  /** 保存回映进度（仅本地账号存储，无网络同步） */
  saveProgress(accountId: string, progress: EndingProgress): void {
    this.storage.save(accountId, progress);
  }

  /** 加载回映进度；无记录返回 null */
  loadProgress(accountId: string): EndingProgress | null {
    return this.storage.load(accountId);
  }
}
