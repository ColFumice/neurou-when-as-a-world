import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

describe('R3.6-UI-patch Crosshair / Liquid Glass', () => {
  test('全局光标隐藏且准星层级/穿透正确', () => {
    const appCss = read('v4/app/src/app.css');
    const crosshairCss = read('v4/app/src/components/crosshair.css');

    assert.match(appCss, /cursor:\s*none\s*!important/);
    assert.match(crosshairCss, /z-index:\s*99999/);
    assert.match(crosshairCss, /pointer-events:\s*none/);
    assert.match(crosshairCss, /--crosshair-x:\s*50vw/);
    assert.match(crosshairCss, /--crosshair-y:\s*50vh/);
    assert.match(crosshairCss, /width:\s*100vw/);
    assert.match(crosshairCss, /height:\s*100vh/);
    assert.match(crosshairCss, /mask-image/);
    assert.match(crosshairCss, /\.crosshair__core[\s\S]*?width:\s*8px/);
    assert.doesNotMatch(crosshairCss, /crosshair__lens/);
    assert.doesNotMatch(crosshairCss, /crosshair__bulge/);
    assert.match(crosshairCss, /scale\(0\.9\)/);
  });

  test('字幕期间隐藏准星，且字幕时长 ×3', () => {
    const consoleTsx = read('v4/core/presentation/console/WorldFolderConsole.tsx');
    const consoleCss = read('v4/core/presentation/console/console.css');
    const crosshairCss = read('v4/app/src/components/crosshair.css');

    assert.match(consoleTsx, /WORLD_PROLOGUE_MS\s*=\s*9000/);
    assert.match(consoleTsx, /WORLD_FLASH_AT_MS\s*=\s*WORLD_BLACK_START_MS\s*\+\s*WORLD_PROLOGUE_MS/);
    assert.match(consoleTsx, /data-crosshair-hidden/);
    assert.match(consoleCss, /console-black-prologue\s+9s/);
    assert.match(crosshairCss, /body\[data-crosshair-hidden='true'\]\s+\.crosshair/);
  });

  test('Liquid Glass tokens 齐备', () => {
    const appCss = read('v4/app/src/app.css');
    for (const token of [
      '--lg-bg: #0a0a0c',
      '--lg-border: 1px solid var(--lg-border-color)',
      '--lg-border-highlight: rgba(255, 255, 255, 0.4)',
      '--lg-text: rgba(255, 255, 255, 0.9)',
      '--lg-text-muted: rgba(255, 255, 255, 0.5)',
      '--lg-radius: 16px',
      '--lg-ease: cubic-bezier(0.4, 0, 0.2, 1)',
      '--lg-shadow: 0 8px 32px rgba(0, 0, 0, 0.5)',
      '--lg-blur: 20px',
      '--lg-saturate: 180%',
    ]) {
      assert.ok(appCss.includes(token), `missing token: ${token}`);
    }
  });

  test('Crosshair 已全局挂载并使用 rAF 更新位置', () => {
    const app = read('v4/app/src/App.tsx');
    const crosshair = read('v4/app/src/components/Crosshair.tsx');
    assert.match(app, /<Crosshair\s*\/>/);
    assert.match(crosshair, /requestAnimationFrame/);
    assert.match(crosshair, /--crosshair-x/);
    assert.match(crosshair, /data-visible/);
  });
});
