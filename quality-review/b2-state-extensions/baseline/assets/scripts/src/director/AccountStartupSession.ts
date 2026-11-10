// VERDICT-158: account narrative orchestration, independent of world/ledger.
export interface AccountStartupSnapshot {
  readonly accountId: string | null;
  readonly phase: 'Login' | 'Prologue' | 'WorldFolder';
  /** Local development projection of AccountMilestone.PrologueCompleted. */
  readonly PrologueCompleted: boolean;
}

export type AccountStartupIntent =
  | { readonly kind: 'Login'; readonly accountId: string; readonly PrologueCompleted: boolean }
  | { readonly kind: 'CompletePrologue' };

export interface AccountStartupReader {
  getStartupSnapshot(): AccountStartupSnapshot;
  getPrologueText(): readonly string[];
}

export interface AccountStartupPort {
  submitStartupIntent(intent: AccountStartupIntent): void;
}

export class AccountStartupSession implements AccountStartupReader, AccountStartupPort {
  constructor(private readonly persistCompletion: (snapshot: AccountStartupSnapshot) => void) {}
  private snapshot: AccountStartupSnapshot = Object.freeze({
    accountId: null, phase: 'Login', PrologueCompleted: false,
  });

  getStartupSnapshot(): AccountStartupSnapshot { return this.snapshot; }

  getPrologueText(): readonly string[] {
    return Object.freeze(['欢迎来到雨若。', '序章完成后，从世界文件夹进入初始世界。']);
  }

  submitStartupIntent(intent: AccountStartupIntent): void {
    if (intent.kind === 'Login') {
      const accountId = intent.accountId.trim();
      if (!accountId || accountId.length > 64) { throw new Error('账号标识须为 1～64 个字符'); }
      if (this.snapshot.phase !== 'Login') { throw new Error('当前账号已经登录'); }
      this.snapshot = Object.freeze({ accountId, PrologueCompleted: intent.PrologueCompleted,
        phase: intent.PrologueCompleted ? 'WorldFolder' : 'Prologue' });
      return;
    }
    if (this.snapshot.phase === 'Login') { throw new Error('请先登录'); }
    if (this.snapshot.PrologueCompleted) { return; }
    const completed: AccountStartupSnapshot = Object.freeze({ accountId: this.snapshot.accountId,
      PrologueCompleted: true, phase: 'WorldFolder' });
    // Commit only after the account storage boundary succeeds; UI cannot mark completion.
    this.persistCompletion(completed);
    this.snapshot = completed;
  }
}
