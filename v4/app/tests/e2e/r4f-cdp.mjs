import fs from 'node:fs';
import path from 'node:path';

const CDP_URL = 'http://127.0.0.1:9222';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.requests = [];
    this.events = [];
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
        return;
      }
      if (message.method === 'Network.requestWillBeSent') {
        this.requests.push(message.params.request.url);
      }
      this.events.push(message);
    });
  }

  static async connect() {
    let lastError = null;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const targets = await (await fetch(`${CDP_URL}/json`)).json();
        const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
        if (!target) throw new Error('no page target');
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.addEventListener('open', resolve, { once: true });
          ws.addEventListener('error', reject, { once: true });
        });
        const client = new CdpClient(ws);
        await client.send('Page.enable');
        await client.send('Runtime.enable');
        await client.send('Network.enable');
        return client;
      } catch (error) {
        lastError = error;
        await sleep(250);
      }
    }
    throw new Error(`cannot connect CDP: ${lastError}`);
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? 'evaluate failed');
    }
    return result.result?.value;
  }

  async waitFor(expression, timeoutMs = 20_000, intervalMs = 100) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        if (await this.evaluate(expression)) return true;
      } catch {
        // page may be reloading
      }
      await sleep(intervalMs);
    }
    return false;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
  }

  async reload() {
    await this.send('Page.reload', { ignoreCache: true });
  }

  async addInitScript(source) {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async screenshot(file) {
    const result = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
  }

  async clickSelector(selector) {
    return this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.click();
      return true;
    })()`);
  }

  async mouseClick(x, y, clickCount = 1) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount,
    });
  }

  async key(code, type = 'keyDown') {
    const key = code === 'Space'
      ? ' '
      : code === 'Slash'
        ? '/'
        : code === 'Escape'
          ? 'Escape'
          : code.startsWith('Key')
            ? code.slice(3).toLowerCase()
            : code.startsWith('Digit')
              ? code.slice(5)
              : code;
    await this.send('Input.dispatchKeyEvent', {
      type,
      code,
      key,
      windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
      nativeVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
    });
  }

  externalRequests() {
    return this.requests.filter((url) => (
      !url.startsWith('http://localhost:1420')
      && !url.startsWith('http://127.0.0.1:1420')
      && !url.startsWith('http://127.0.0.1:9222')
      && !url.startsWith('http://ipc.localhost')
      && !url.startsWith('http://asset.localhost')
      && !url.startsWith('data:')
      && !url.startsWith('blob:')
      && !url.startsWith('tauri:')
    ));
  }

  close() {
    this.ws.close();
  }
}
