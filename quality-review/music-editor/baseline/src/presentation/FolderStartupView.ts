import type { AccountStartupSnapshot } from '../director/IntentPort';
import { applyFolderTheme } from './FolderTheme';

/** Browser development storage adapter; never used as remote authentication. */
export class AccountStartupStorage {
  readCompletion(accountId: string): boolean {
    const value = localStorage.getItem(this.key(accountId));
    if (value === null) { return false; }
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null ||
        (parsed as { PrologueCompleted?: unknown }).PrologueCompleted !== true) {
      throw new Error('账号里程碑损坏，请恢复本地账号数据');
    }
    return true;
  }

  saveCompletion(snapshot: AccountStartupSnapshot): void {
    if (snapshot.accountId === null || !snapshot.PrologueCompleted) {
      throw new Error('序章尚未完成');
    }
    localStorage.setItem(this.key(snapshot.accountId), JSON.stringify({ PrologueCompleted: true }));
  }

  private key(accountId: string): string {
    return 'neurou-account-milestone-v1:' + encodeURIComponent(accountId);
  }
}

/** Replaceable AC-29 startup graybox; narrative decisions come from director. */
export class FolderStartupView {
  private root: HTMLElement | null = null;

  showLogin(login: (accountId: string) => void): void {
    this.build('登录');
    const body = this.root!.querySelector('main')!;
    body.innerHTML = `<p>雨若 · 开发阶段本地账号</p><form id="folder-login-form"><label for="folder-account">账号标识</label><input id="folder-account" maxlength="64" required value="dev-local" autocomplete="off"><button id="folder-login" type="submit">登录</button></form><small>本地账号用于保存此浏览器的序章完成状态。</small>`;
    body.querySelector('form')!.onsubmit = e => {
      e.preventDefault(); login((body.querySelector('input') as HTMLInputElement).value.trim());
    };
  }

  showPrologue(accountId: string, text: readonly string[], complete: () => void): void {
    this.build('序章');
    const body = this.root!.querySelector('main')!;
    const account = document.createElement('small'); account.textContent = '当前账号：' + accountId;
    body.appendChild(account);
    for (const line of text) { const p = document.createElement('p'); p.textContent = line; body.appendChild(p); }
    const button = document.createElement('button'); button.id = 'folder-complete-prologue';
    button.textContent = '完成序章 · 进入世界文件夹'; button.onclick = complete; body.appendChild(button);
  }

  showError(message: string): void {
    if (this.root) { this.root.querySelector('[role=status]')!.textContent = message; }
  }

  destroy(): void { this.root?.remove(); this.root = null; }

  private build(title: string): void {
    this.destroy(); this.root = document.createElement('section'); this.root.id = 'folder-startup';
    this.root.innerHTML = `<style>
      #folder-startup{position:fixed;inset:0;z-index:200;background:var(--folder-bg);color:var(--folder-ink);display:grid;place-items:center;font:18px/1.6 var(--folder-font);overflow:auto}
      #folder-startup *{box-sizing:border-box}#folder-startup article{width:min(680px,calc(100% - 48px));padding:40px;background:var(--folder-panel);border:1px solid var(--folder-border)}
      #folder-startup h1{font-size:28px;margin:0 0 24px}#folder-startup form{display:grid;gap:14px}#folder-startup input,#folder-startup button{font:inherit;padding:12px;border:1px solid var(--folder-border);background:#383a3e;color:inherit;border-radius:4px}#folder-startup button{cursor:pointer}#folder-startup button:hover{background:#4b4d51}#folder-startup small{color:#bfc0c2}#folder-startup [role=status]{color:#ffb8b8;min-height:1.6em;margin-top:16px}
      </style><article><h1></h1><main></main><div role="status" aria-live="polite"></div></article>`;
    applyFolderTheme(this.root);
    this.root.querySelector('h1')!.textContent = title; document.body.appendChild(this.root);
  }
}
