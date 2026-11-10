// B2.2c authored world interaction. Read-only snapshots; player submits choice IDs.
import { NarrativeDimension } from '../../constants';
import type { PlayerIntent } from '../director/PlayerIntent';
import type { AccountMilestoneReader, WorldClearReader } from '../director/IntentPort';
import type { FrameRefreshable } from './FrameDriver';

export class WorldClearView implements FrameRefreshable {
  private root: HTMLElement | null = null;
  private readonly choices = new Map<string, HTMLButtonElement>();
  private localError = '';
  private visible = true;

  constructor(
    private readonly reader: WorldClearReader,
    private readonly milestones: AccountMilestoneReader,
    private readonly enqueue: (intent: PlayerIntent) => void,
  ) {}

  /** The composition root suspends the independent story panel during legacy chart/reveal scenes. */
  setVisible(visible: boolean): void { this.visible = visible; }

  mount(): void {
    if (typeof document === 'undefined' || this.root) { return; }
    const root = document.createElement('section');
    root.id = 'world-clear-view';
    root.setAttribute('aria-label', '雨中遗失的名字');
    root.innerHTML = `
      <style>
      #world-clear-view{position:fixed;inset:0;z-index:65;pointer-events:none;display:flex;justify-content:flex-end;align-items:center;padding:92px 30px 64px;color:#eaf0f5;font:15px/1.65 system-ui,sans-serif}
      #world-clear-view *{box-sizing:border-box}#world-clear-view [hidden]{display:none!important}
      #world-clear-view .rain-story{pointer-events:auto;width:min(420px,42vw);max-height:100%;overflow:auto;background:rgba(17,28,39,.94);border:1px solid #4b6273;border-radius:10px;padding:25px;box-shadow:0 18px 50px #0005}
      #world-clear-view .rain-eyebrow{font-size:12px;letter-spacing:.15em;color:#a1b5c4}#world-clear-view h1{font-size:23px;font-weight:500;margin:9px 0 17px}
      #world-clear-view p{margin:0 0 17px}#world-clear-view .rain-choices{display:grid;gap:10px}#world-clear-view button{cursor:pointer;font:inherit;border:1px solid #547285;border-radius:5px;color:#eaf0f5;background:#233c4d;padding:11px 14px;text-align:left;width:100%}
      #world-clear-view button:hover{background:#345468}#world-clear-view button:focus-visible{outline:2px solid #ceeaf1;outline-offset:3px}#world-clear-view button:disabled{cursor:default;opacity:.5}#world-clear-view button[data-selected=true]{opacity:1;border-color:#a8d4d9;background:#31555b}
      #world-clear-view .rain-result{border-top:1px solid #4b6273;margin-top:18px;padding-top:16px;color:#b7d3db}#world-clear-view .rain-account{border-top:1px solid #4b6273;margin-top:17px;padding-top:13px;font-size:13px;color:#a9bcc9;display:grid;gap:3px}
      #world-clear-view .rain-entry{margin-top:12px;background:#506c6d;border-color:#a3ced0}#world-clear-view .rain-error{font-size:13px;color:#ffd0a0;margin:12px 0 0}#world-clear-view .rain-caption{font-size:12px;color:#98aebd;margin:9px 0 0}
      @media(max-width:800px){#world-clear-view{padding:72px 16px 35px}#world-clear-view .rain-story{width:min(390px,60vw);padding:19px}#world-clear-view h1{font-size:20px}#world-clear-view{font-size:14px}}
      @media(max-height:600px){#world-clear-view{padding:70px 16px 30px}#world-clear-view .rain-story{padding:17px}#world-clear-view h1{font-size:20px;margin-bottom:10px}#world-clear-view p{margin-bottom:11px}#world-clear-view button{padding:8px 11px}#world-clear-view .rain-choices{gap:7px}}
      </style>
      <article class="rain-story">
        <div class="rain-eyebrow" id="rain-world-kind">PRIMARY · 旧站台</div>
        <h1 id="rain-story-title"></h1><p id="rain-story-prompt"></p>
        <div class="rain-choices" id="rain-story-choices"></div>
        <div class="rain-result" id="rain-story-result" hidden><p id="rain-choice-result"></p><div id="rain-world-entry-status"></div><button type="button" class="rain-entry" id="enter-world-boss-chart" hidden>聆听 · 雨后回响</button><p class="rain-caption" id="rain-entry-caption"></p></div>
        <div class="rain-account"><span id="rain-world-clear-record">世界通关：未完成</span><span id="rain-first-world-cleared">首次世界通关：未完成</span><span id="rain-copy-permission">复制权限：未取得</span></div>
        <p class="rain-error" id="rain-world-error" role="status" aria-live="polite" hidden></p><button type="button" id="retry-world-clear" hidden>重试保存</button>
      </article>`;
    this.root = root;
    const snapshot = this.reader.getWorldClearSnapshot();
    root.querySelector('#rain-story-title')!.textContent = snapshot.interaction.title;
    root.querySelector('#rain-story-prompt')!.textContent = snapshot.interaction.prompt;
    const choices = root.querySelector('#rain-story-choices')!;
    for (const choice of snapshot.interaction.choices) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.choiceId = choice.choiceId; button.textContent = choice.label;
      button.onclick = () => this.send({ kind: 'ChooseWorldNarrative', choiceId: choice.choiceId });
      choices.appendChild(button); this.choices.set(choice.choiceId, button);
    }
    root.querySelector<HTMLButtonElement>('#enter-world-boss-chart')!.onclick = () => this.send({ kind: 'EnterWorldChart' });
    root.querySelector<HTMLButtonElement>('#retry-world-clear')!.onclick = () => this.send({ kind: 'RetryWorldClear' });
    document.body.appendChild(root); this.onFrameRefresh();
  }

  onFrameRefresh(): void {
    const root = this.root;
    if (!root) { return; }
    const snapshot = this.reader.getWorldClearSnapshot();
    const inherited = snapshot.completionStatus === 'Inherited';
    root.hidden = snapshot.chartActive || !this.visible;
    root.style.display = snapshot.chartActive || !this.visible ? 'none' : 'flex';
    root.dataset.worldKind = 'Primary';
    root.dataset.worldId = snapshot.context.worldId;
    root.dataset.selectedChoiceId = snapshot.selectedChoiceId ?? '';
    root.dataset.ledgerEventCount = String(snapshot.ledgerEventCount);
    root.dataset.ledgerPosition = JSON.stringify(snapshot.ledgerPosition);
    root.dataset.eventDistance = String(snapshot.EventDistance);
    root.dataset.distance = String(snapshot.distance);
    root.dataset.sphereCrossed = String(snapshot.sphereCrossed);
    root.dataset.completionStatus = snapshot.completionStatus;
    if (snapshot.entry) { root.dataset.entrySource = snapshot.entry.source; }
    for (const [choiceId, button] of this.choices) {
      button.disabled = snapshot.selectedChoiceId !== null || snapshot.chartActive || snapshot.completionStatus === 'Completed' || inherited;
      button.dataset.selected = String(choiceId === snapshot.selectedChoiceId);
    }
    const result = root.querySelector<HTMLElement>('#rain-story-result')!;
    result.hidden = snapshot.selectedChoiceId === null && !inherited;
    const responses: Record<string, string> = {
      'share-shelter': '她靠近伞下，轻声说：“原来等候，也可以有人陪。”',
      'read-ticket': '车票上的字渐渐清晰。她念出那个名字，笑着把约定重新记住。',
      'keep-promise': '她把车票收好：“那么，我们一起等。这一次，我会记得。”',
    };
    root.querySelector('#rain-choice-result')!.textContent = snapshot.selectedChoiceId ? responses[snapshot.selectedChoiceId] ?? '这段同行留在了记忆中。' : '';
    root.querySelector('#rain-world-entry-status')!.textContent = inherited
      ? '这首世界之曲的首演已经随记忆继承。' : snapshot.sphereCrossed
      ? '记忆越过雨幕，世界之曲已经显现。' : '同行的记忆留在雨声里。';
    const entry = root.querySelector<HTMLButtonElement>('#enter-world-boss-chart')!;
    entry.hidden = !snapshot.entry || snapshot.completionStatus === 'Completed' || inherited;
    entry.disabled = !snapshot.mediaReady || snapshot.chartActive || snapshot.completionStatus === 'Pending' || snapshot.completionStatus === 'Failed';
    root.querySelector('#rain-entry-caption')!.textContent = inherited
      ? '通关记录不会随分叉继承。你可以选中记忆中的这段旋律，继续重演。' : snapshot.completionStatus === 'Completed'
        ? '这首世界之曲已经完整奏响。' : '完整聆听并演奏这首世界之曲；离开后仍可回来。';
    const record = root.querySelector<HTMLElement>('#rain-world-clear-record')!;
    record.textContent = snapshot.record ? '世界通关：已保存 · ' + this.routeLabel(snapshot.record.routeSignature.divergenceAxis)
      : inherited ? '世界通关：记录未继承' : snapshot.completionStatus === 'Pending' ? '世界通关：正在保存' : '世界通关：未完成';
    record.dataset.recordCount = snapshot.record ? '1' : '0';
    record.dataset.completionEventId = snapshot.record?.completionEventId ?? '';
    try {
      const milestones = this.milestones.getMilestoneSnapshot();
      root.querySelector('#rain-first-world-cleared')!.textContent = '首次世界通关：' + (milestones.FirstWorldCleared ? '已完成' : '未完成');
      root.querySelector('#rain-copy-permission')!.textContent = '复制权限：' + (milestones.CopyPermission ? '已取得' : '未取得');
      root.dataset.firstWorldCleared = String(milestones.FirstWorldCleared);
      root.dataset.copyPermission = String(milestones.CopyPermission);
    } catch (error) { this.localError = '账号进度读取失败：' + String(error); }
    const error = snapshot.completionError ?? this.localError;
    const status = root.querySelector<HTMLElement>('#rain-world-error')!;
    status.hidden = !error; status.textContent = error;
    root.querySelector<HTMLElement>('#retry-world-clear')!.hidden = snapshot.completionStatus !== 'Failed';
  }

  private routeLabel(axis: number | null): string {
    const names: Partial<Record<NarrativeDimension, string>> = {
      [NarrativeDimension.Red]: '红色回响', [NarrativeDimension.Green]: '绿色回响',
      [NarrativeDimension.Blue]: '蓝色回响', [NarrativeDimension.Black]: '黑色回响',
      [NarrativeDimension.White]: '白色回响', [NarrativeDimension.Grey]: '灰色回响',
    };
    return axis === null ? '同行路线' : names[axis as NarrativeDimension] ?? '同行路线';
  }

  private send(intent: PlayerIntent): void {
    this.localError = '';
    try { this.enqueue(intent); } catch (error) { this.localError = String(error); }
  }

  destroy(): void { this.root?.remove(); this.root = null; this.choices.clear(); }
}
