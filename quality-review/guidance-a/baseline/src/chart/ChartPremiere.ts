// ============================================================
// C 谱面域 · ChartPremiere 谱面首演状态机（名库 v2.5 冻结名）
//
// 依据：
// - 名库 v2.5：ChartPremiere 为谱面体系冻结名；
// - HANDOFF-ROUND-18 冻结契约与任务 4 / 5 / 6 / 8：
//     ChartPlaybackState Ready/Playing/Paused/Completed/Exited；
//     Strike 谱面消费需 keyId；ToggleChartPause 定边界；
//     Perfect / Good / Miss、漏敲、错误槽位、重复输入、
//     同槽多候选；一次按下最多消费一条 Note；
//     完成产生结果；退出不写账本（由 director 接线）。
//
// 职责：纯逻辑状态迁移与判定消费；零 cc，不读取节点 / 像素。
// presentation 仅经 ChartPremiereReader 只读访问；
// 账本追加只由 director 依据本状态机结果执行。
// ============================================================

import { GOOD_WINDOW_MS } from '../../constants';
import type { ChartTier } from '../../constants';
import type { ChartKeyId, KeyboardPadLayout } from './KeyboardPadLayout';
import { getSlot } from './KeyboardPadLayout';
import type { Note, ChartData } from './Note';
import type { Strike } from './Strike';
import type { ChartPlaybackState } from './ChartPlaybackState';
import {
  ChartScore,
  judgeTimeWindow,
  clampGuideTransparency,
} from './ChartScore';
import type { ChartJudgeTier } from './ChartScore';

/** R26 异常媒体兜底占位值（名称、数值待追认）；暂停不计时。 */
export const CHART_MEDIA_END_TIMEOUT_MS = 30_000;

/**
 * ChartJudgeFeedback 单次判定的表现反馈（名称为直译，待追认）。
 *
 * 不携带像素 / Cocos 对象；presentation 拉取后自行绘制。
 */
export interface ChartJudgeFeedback {
  /** 单调序号（presentation 据此增量拉取）。 */
  readonly seq: number;
  /** 判定对应的谱面时间码。 */
  readonly videoTimeMs: number;
  /** 被敲击槽位。 */
  readonly keyId: ChartKeyId;
  /** 判定档位（错误槽位为 Miss）。 */
  readonly tier: ChartJudgeTier;
  /** 是否消费了一条 Note（错误槽位 / Miss 为 false）。 */
  readonly consumed: boolean;
}

/**
 * ChartPlaybackResult 演奏结果（名称为直译，待追认）。
 *
 * 完成或退出时产出；是否写账本由 director 依据状态决定，
 * 与得分高低无关（AC-20）。
 */
export interface ChartPlaybackResult {
  readonly chartId: string;
  readonly tier: ChartTier;
  readonly perfectCount: number;
  readonly goodCount: number;
  readonly missCount: number;
  readonly totalScore: number;
  /** 结果对应的最后谱面时间码。 */
  readonly finishedAtMs: number;
  /** true = 完整演奏完成；false = 中途退出。 */
  readonly completed: boolean;
}

/** 单条 Note 的内部解析状态。 */
interface NoteStatus {
  readonly note: Note;
  resolved: boolean;
  tier: ChartJudgeTier | null;
}

/**
 * ChartPremiereReader 首演只读接口（名称为直译，待追认）。
 *
 * presentation 只能获得本接口：读状态 / 进度 / 透明度 /
 * 增量判定反馈 / 结果，不能提交敲击、不能改判定、不能写账本。
 */
export interface ChartPremiereReader {
  getState(): ChartPlaybackState;
  getChartId(): string;
  getTier(): ChartTier;
  getGuideTransparency(): number;
  /** 最近一次推进的谱面媒体时间（毫秒；暂停时保持冻结）。 */
  getCurrentTimeMs(): number;
  /** 进度 = 已决 Note 数 / 总 Note 数（0~1）。 */
  getProgress(): number;
  getResolvedCount(): number;
  getTotalNoteCount(): number;
  getPerfectCount(): number;
  getGoodCount(): number;
  getMissCount(): number;
  getTotalScore(): number;
  /** 拉取序号严格大于 sinceSeq 的判定反馈（不修改状态机）。 */
  getJudgeFeedbackSince(sinceSeq: number): {
    readonly nextSeq: number;
    readonly items: readonly ChartJudgeFeedback[];
  };
  getResult(): ChartPlaybackResult | null;
}

/**
 * ChartPremiere 谱面首演状态机。
 */
export class ChartPremiere implements ChartPremiereReader {
  private readonly chartId: string;
  private readonly tier: ChartTier;
  private readonly layout: KeyboardPadLayout;
  private readonly noteStatuses: NoteStatus[] = [];

  private state: ChartPlaybackState = 'Ready';
  private score = new ChartScore();
  private guideTransparencyValue = 0;

  /** 最近一次推进的谱面媒体时间（暂停时不更新，保持冻结）。 */
  private currentTimeMsValue = 0;
  private mediaEnded = false;
  private mediaUnavailableElapsedMs = 0;

  private feedbackSeq = 0;
  private readonly feedback: ChartJudgeFeedback[] = [];
  private result: ChartPlaybackResult | null = null;

  /**
   * @param data 独立谱面数据（AC-16）
   * @param layout 与谱面 layoutVersion 一致的布局
   */
  constructor(data: ChartData, layout: KeyboardPadLayout) {
    this.chartId = data.chartId;
    this.tier = data.tier;
    this.layout = layout;

    if (data.layoutVersion !== layout.layoutVersion) {
      throw new Error(
        `ChartPremiere: 布局版本不匹配（谱面 ${data.layoutVersion} / 布局 ${layout.layoutVersion}），拒绝加载`,
      );
    }
    if (data.chartId.length === 0) {
      throw new Error('ChartPremiere: chartId 不能为空');
    }
    const ordered = data.notes
      .slice()
      .sort((a, b) => a.timeMs - b.timeMs);
    for (const note of ordered) {
      if (!Number.isFinite(note.timeMs) || note.timeMs < 0) {
        throw new Error(`ChartPremiere: Note 时间码非法 (${note.timeMs})`);
      }
      if (getSlot(layout, note.keyId) === undefined) {
        throw new Error(`ChartPremiere: Note 引用了布局中不存在的键 ${note.keyId}`);
      }
      this.noteStatuses.push({ note: Object.freeze({ ...note }), resolved: false, tier: null });
    }
  }

  // —— 只读接口 ——

  getState(): ChartPlaybackState {
    return this.state;
  }

  getChartId(): string {
    return this.chartId;
  }

  getTier(): ChartTier {
    return this.tier;
  }

  getGuideTransparency(): number {
    return this.guideTransparencyValue;
  }

  getCurrentTimeMs(): number {
    return this.currentTimeMsValue;
  }

  getTotalNoteCount(): number {
    return this.noteStatuses.length;
  }

  getResolvedCount(): number {
    return this.noteStatuses.reduce(
      (sum, status) => sum + (status.resolved ? 1 : 0),
      0,
    );
  }

  getProgress(): number {
    if (this.noteStatuses.length === 0) {
      return 1;
    }
    return this.getResolvedCount() / this.noteStatuses.length;
  }

  getPerfectCount(): number {
    return this.score.getPerfectCount();
  }

  getGoodCount(): number {
    return this.score.getGoodCount();
  }

  getMissCount(): number {
    return this.score.getMissCount();
  }

  getTotalScore(): number {
    return this.score.getTotalScore();
  }

  getJudgeFeedbackSince(sinceSeq: number): {
    nextSeq: number;
    items: readonly ChartJudgeFeedback[];
  } {
    const items = this.feedback.filter((item) => item.seq > sinceSeq);
    return { nextSeq: this.feedbackSeq, items };
  }

  getResult(): ChartPlaybackResult | null {
    return this.result;
  }

  // —— 状态迁移 ——

  /**
   * 设置引导透明度（AC-18；方法名直译，待追认）。
   * 只改变显示与得分加成，不改变目标槽位、Note 时间或判定窗口。
   */
  setGuideTransparency(value: number): void {
    this.guideTransparencyValue = clampGuideTransparency(value);
  }

  /** Ready → Playing：媒体实际开始时由 director 调用。 */
  begin(): void {
    if (this.state === 'Ready') {
      this.state = 'Playing';
    }
  }

  /** 由播放器提供结束 / 不可用状态及独立帧时间；不依赖停滞的媒体时钟。 */
  advanceMediaStatus(ended: boolean, unavailable: boolean, elapsedMs: number): void {
    if (this.state !== 'Playing' || !Number.isFinite(elapsedMs) || elapsedMs < 0) { return; }
    this.mediaEnded = this.mediaEnded || ended;
    if (this.noteStatuses.every(status => status.resolved) && unavailable && !this.mediaEnded) {
      this.mediaUnavailableElapsedMs += elapsedMs;
    } else {
      this.mediaUnavailableElapsedMs = 0;
    }
    this.checkCompleted(this.currentTimeMsValue);
  }

  /**
   * 提交一次敲击（边沿；长按重复由采集层拦截）。
   *
   * 仅 Playing 生效；其余状态一律丢弃（暂停 / 完成 / 退出 / 待播）。
   */
  submitStrike(strike: Strike): void {
    if (this.state !== 'Playing' || !Number.isFinite(strike.videoTimeMs) || strike.videoTimeMs < 0) {
      return;
    }
    const keyId = strike.keyId;
    if (keyId === undefined) {
      return; // 谱面消费必须带 keyId
    }
    if (getSlot(this.layout, keyId) === undefined) {
      return;
    }

    const bestIndex = this.findBestCandidateIndex(keyId, strike.videoTimeMs);
    if (bestIndex >= 0) {
      // 命中：一次按下最多消费一条（同槽多候选取时间最近，并列取较早）。
      const status = this.noteStatuses[bestIndex];
      const tier = judgeTimeWindow(strike.videoTimeMs, status.note.timeMs);
      status.resolved = true;
      status.tier = tier;
      this.score.applyJudgement(tier, this.guideTransparencyValue);
      this.pushFeedback(strike.videoTimeMs, keyId, tier, true);
      this.currentTimeMsValue = Math.max(this.currentTimeMsValue, strike.videoTimeMs);
      this.checkCompleted(strike.videoTimeMs);
      return;
    }

    // 错误槽位：同一时刻有别槽 Note 在窗内 → 判 Miss，但不消费该 Note。
    if (this.hasAnyCandidateInWindow(strike.videoTimeMs)) {
      this.score.applyJudgement('Miss', this.guideTransparencyValue);
      this.pushFeedback(strike.videoTimeMs, keyId, 'Miss', false);
    }
    // 否则为空敲（无任何 Note 在窗）：忽略，不计数、不反馈。
  }

  /**
   * ESC 在 Playing / Paused 间切换（按 videoTimeMs 定边界）。
   * 其他状态忽略。
   */
  togglePause(videoTimeMs: number): void {
    if (!Number.isFinite(videoTimeMs) || videoTimeMs < 0) { return; }
    if (this.state === 'Playing') {
      this.advance(videoTimeMs);
      if (this.state !== 'Playing') { return; }
      this.state = 'Paused';
    } else if (this.state === 'Paused') {
      // 恢复：保留 Note / 分数 / 进度；输出时钟映射由 presentation 重建。
      this.state = 'Playing';
    }
  }

  /**
   * 按谱面时钟推进：漏敲判定与完成检测。
   *
   * 仅 Playing 生效；暂停时不推进（窗口冻结，不补算）。
   */
  advance(videoTimeMs: number): void {
    if (this.state !== 'Playing') {
      return;
    }
    if (!Number.isFinite(videoTimeMs) || videoTimeMs < this.currentTimeMsValue) { return; }
    this.currentTimeMsValue = videoTimeMs;
    for (const status of this.noteStatuses) {
      if (status.resolved) {
        continue;
      }
      // 严格越过 Good 窗口（端点仍在窗内）才算漏敲。
      if (status.note.timeMs + GOOD_WINDOW_MS < videoTimeMs) {
        status.resolved = true;
        status.tier = 'Miss';
        this.score.applyJudgement('Miss', this.guideTransparencyValue);
        this.pushFeedback(videoTimeMs, status.note.keyId, 'Miss', true);
      }
    }
    this.checkCompleted(videoTimeMs);
  }

  /**
   * 主动退出（AC-21）：Playing / Paused / Completed / Ready → Exited。
   * 不写谱面账本记录（由 director 保证），资源回收由 presentation 处理。
   */
  requestExit(finishedAtMs: number): ChartPlaybackResult {
    const completed = this.state === 'Completed' || this.result?.completed === true;
    this.state = 'Exited';
    if (!completed || this.result === null) {
      this.result = this.buildResult(finishedAtMs, completed);
    }
    return this.result;
  }

  /**
   * 退出 / 完成后重入（方法名直译，待追认）：
   * 回到 Ready 并清空判定、分数与进度；谱面身份与布局保持不变。
   */
  reopen(): void {
    if (this.state !== 'Exited' && this.state !== 'Completed') {
      return;
    }
    for (const status of this.noteStatuses) {
      status.resolved = false;
      status.tier = null;
    }
    this.score = new ChartScore();
    this.feedback.length = 0;
    this.feedbackSeq = 0;
    this.result = null;
    this.currentTimeMsValue = 0;
    this.mediaEnded = false;
    this.mediaUnavailableElapsedMs = 0;
    this.state = 'Ready';
  }

  // —— 内部 ——

  /** 同槽候选：返回窗内时间最近的未决 Note 下标；无则 -1。 */
  private findBestCandidateIndex(
    keyId: ChartKeyId,
    timeMs: number,
  ): number {
    let bestIndex = -1;
    let bestAbsolute = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.noteStatuses.length; i++) {
      const status = this.noteStatuses[i];
      if (status.resolved || status.note.keyId !== keyId) {
        continue;
      }
      const absolute = Math.abs(timeMs - status.note.timeMs);
      if (absolute > GOOD_WINDOW_MS) {
        continue;
      }
      // 更近，或等距时取较早（数组已按时间升序，下标更小即更早）。
      if (absolute < bestAbsolute || (absolute === bestAbsolute && i < bestIndex)) {
        bestAbsolute = absolute;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  /** 是否存在任意槽位、窗内未决 Note（用于错误槽位判定）。 */
  private hasAnyCandidateInWindow(timeMs: number): boolean {
    return this.noteStatuses.some(
      (status) =>
        !status.resolved &&
        Math.abs(timeMs - status.note.timeMs) <= GOOD_WINDOW_MS,
    );
  }

  /** 追加一条判定反馈（序号单调）。 */
  private pushFeedback(
    videoTimeMs: number,
    keyId: ChartKeyId,
    tier: ChartJudgeTier,
    consumed: boolean,
  ): void {
    this.feedbackSeq += 1;
    this.feedback.push(Object.freeze({ seq: this.feedbackSeq, videoTimeMs, keyId, tier, consumed }));
  }

  /** R26 B：全部 Note 已决且媒体结束；异常媒体超时兜底。 */
  private checkCompleted(videoTimeMs: number): void {
    if (this.state !== 'Playing') {
      return;
    }
    if (this.noteStatuses.every((status) => status.resolved) &&
        (this.mediaEnded || this.mediaUnavailableElapsedMs >= CHART_MEDIA_END_TIMEOUT_MS)) {
      this.state = 'Completed';
      this.result = this.buildResult(videoTimeMs, true);
    }
  }

  /** 构造演奏结果快照。 */
  private buildResult(
    finishedAtMs: number,
    completed: boolean,
  ): ChartPlaybackResult {
    return Object.freeze({
      chartId: this.chartId,
      tier: this.tier,
      perfectCount: this.score.getPerfectCount(),
      goodCount: this.score.getGoodCount(),
      missCount: this.score.getMissCount(),
      totalScore: this.score.getTotalScore(),
      finishedAtMs,
      completed,
    });
  }
}
