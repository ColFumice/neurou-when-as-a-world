'use strict';
// CONTRACT TEST: actual Chromium DOM, real view/director classes, declared in-memory
// fixtures. A true milestone here is adapter input, never a production world clear.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), ts = require('typescript');
const { app, BrowserWindow } = require('electron');
const root = path.resolve(__dirname, '../..'), checks = [];
const sources = {
  WorldFolderView: 'src/presentation/WorldFolderView.ts', FolderTheme: 'src/presentation/FolderTheme.ts',
  WorldFolderSession: 'src/director/WorldFolderSession.ts', FolderCatalog: 'src/presentation/FolderCatalog.ts',
  AccountMilestone: 'src/director/AccountMilestone.ts', AccountMilestoneStorage: 'src/presentation/AccountMilestoneStorage.ts',
  WorldStateSession: 'src/director/WorldStateSession.ts',
};
app.setPath('userData', path.join(require('os').tmpdir(), 'neurou-b22-dom-contract-' + Date.now()));
app.commandLine.appendSwitch('disable-gpu');
let win;
const ev = (fn, ...args) => win.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(v => JSON.stringify(v)).join(',') + ')', true);
async function test(name, fn) {
  try { checks.push({ name, category: 'ContractTest', pass: true, evidence: await ev(fn) }); }
  catch (error) { checks.push({ name, category: 'ContractTest', pass: false, error: String(error.stack || error) }); }
}
app.whenReady().then(async () => {
  try {
    win = new BrowserWindow({ width: 1200, height: 1080, show: false, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
    await win.loadURL('about:blank');
    const modules = Object.fromEntries(Object.entries(sources).map(([name, file]) => [name,
      ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      }).outputText]));
    await ev(modules => {
      const loaded = {}, load = name => {
        if (loaded[name]) return loaded[name].exports;
        const m = { exports: {} }; loaded[name] = m;
        new Function('module', 'exports', 'require', modules[name])(m, m.exports, request => load(request.split('/').at(-1)));
        return m.exports;
      };
      const t = window.__foundationContract = { values: new Map(), writes: [], view: null, readsFail: false, captureFail: false };
      t.accountId = 'contract-only-account';
      t.key = 'neurou-account-first-world-cleared-v1:' + encodeURIComponent(t.accountId);
      t.startupKey = 'neurou-account-milestone-v1:' + encodeURIComponent(t.accountId);
      t.values.set(t.startupKey, '{"PrologueCompleted":true}');
      t.storage = new (load('AccountMilestoneStorage').AccountMilestoneStorage)({
        getItem: key => t.values.get(key) ?? null,
        setItem: (key, text) => { t.writes.push({ key, text }); t.values.set(key, text); },
      });
      t.createReader = load('AccountMilestone').createAccountMilestoneReader;
      t.folder = new (load('WorldFolderSession').WorldFolderSession)(t.accountId, null, snapshot => { t.folderSnapshot = snapshot; }, () => 'world-contract-created', () => 100);
      t.session = new (load('WorldStateSession').WorldStateSession)(t.accountId, 'InitialWorld', () => 200);
      t.View = load('WorldFolderView').WorldFolderView;
      t.mount = () => {
        t.view?.destroy(); t.opened = []; t.captureRequests = []; t.restoreRequests = [];
        t.view = new t.View(load('FolderCatalog').createWorldFolderReader(t.accountId, () => t.folder.getWorlds()),
          entry => t.opened.push(entry.worldId), () => {}, t.folder, () => t.view.refresh(),
          { getMilestoneSnapshot: () => {
            if (t.readsFail) throw Error('契约输入损坏');
            return t.createReader(t.accountId, t.storage.readProjection(t.accountId)).getMilestoneSnapshot();
          } },
          worldId => { t.captureRequests.push(worldId); if (t.captureFail) throw Error('契约读取失败'); return t.session.captureWorldState(); },
          worldId => { t.restoreRequests.push(worldId); return t.session.restoreWorldState(t.restoreInput ?? null); });
        t.view.mount();
      };
      t.mount();
    }, modules);
    await test('D01 absent projection displays permission not acquired without persisting defaults', () => {
      const t = window.__foundationContract, label = document.querySelector('#account-copy-permission');
      if (!label.textContent.includes('未取得') || label.dataset.copyPermission !== 'false' || label.dataset.firstWorldCleared !== 'false') throw Error('Wrong false projection display');
      if (t.writes.length || t.values.has(t.key)) throw Error('Reading absence wrote a default');
      if (document.querySelector('#world-fork-availability').dataset.availability !== 'NotImplemented') throw Error('Wrong availability');
      return { FirstWorldCleared: false, CopyPermission: false, writes: 0, worldForkAvailability: 'NotImplemented' };
    });
    await test('D02 CONTRACT true adapter input derives acquired permission while fork remains unimplemented', () => {
      const t = window.__foundationContract;
      t.storage.saveProjection({ schemaVersion: 1, accountId: t.accountId, FirstWorldCleared: true }, null);
      t.view.refresh(); const label = document.querySelector('#account-copy-permission');
      if (!label.textContent.includes('已取得') || label.dataset.copyPermission !== 'true' || label.dataset.firstWorldCleared !== 'true') throw Error('True derivation failed');
      if (!document.querySelector('#world-fork-availability').textContent.includes('未实施')) throw Error('Function readiness conflated');
      if (JSON.parse(t.values.get(t.key)).CopyPermission !== undefined || t.values.get(t.startupKey) !== '{"PrologueCompleted":true}') throw Error('Derived/startup persistence violated');
      return { fixture: 'ContractTest only; no actual world clear', text: label.textContent, CopyPermissionPersisted: false, startupPreserved: true };
    });
    await test('D03 failed reader clears stale true attributes and reports error, never false fallback', () => {
      const t = window.__foundationContract, saved = t.values.get(t.key);
      t.readsFail = true; t.view.refresh(); const label = document.querySelector('#account-copy-permission');
      if (label.dataset.readState !== 'Error' || label.dataset.copyPermission !== undefined || !label.textContent.includes('读取失败')) throw Error('Error concealed or stale permission retained');
      if (t.values.get(t.key) !== saved) throw Error('Read error changed data');
      t.readsFail = false; t.view.refresh();
      return { explicitError: true, staleTrueRemoved: true, persistedFactPreserved: true };
    });
    await test('D04 actual capture renders all seven missing sections and no fabricated payload', () => {
      const t = window.__foundationContract, writes = t.writes.length;
      document.querySelector('[data-action="inspect-world-state"]').click();
      const result = t.session.getLastCaptureResult();
      if (document.querySelector('#world-state-diagnostics').hidden || document.querySelector('#world-state-capture-kind').dataset.kind !== 'Incomplete') throw Error('Incomplete panel absent');
      const sections = new Set([...document.querySelectorAll('#world-state-diagnostic-list li')].map(li => li.dataset.section));
      for (const section of ['Ledger','PuzzleProgress','RecallCount','FormatTime','WorldLink','ChartSnapshot','ChartScore']) if (!sections.has(section)) throw Error('Missing section ' + section);
      if (Object.keys(result.capturedParts).length || t.writes.length !== writes) throw Error('Missing payload laundered or storage changed');
      return { sections: [...sections], capturedParts: {}, candidate: result.candidate, writes: 0 };
    });
    await test('D05 header-shaped restore input is explicitly rejected and causes no writes', () => {
      const t = window.__foundationContract, writes = t.writes.length;
      t.restoreInput = { schemaVersion:1, accountId:t.accountId, worldId:'InitialWorld', worldKind:'Primary', shoreOrigin:null, revision:0, capturedAt:200 };
      document.querySelector('#world-state-restore-reject').click();
      const label = document.querySelector('#world-state-restore-status');
      if (label.dataset.kind !== 'Rejected' || !label.textContent.includes('已拒绝') || t.writes.length !== writes) throw Error('False restoration success or mutation');
      return { kind: label.dataset.kind, writes: 0, restoreRequests: t.restoreRequests };
    });
    await test('D06 fork still refuses with acquired contract permission; original open route retained', () => {
      const t = window.__foundationContract, before = JSON.stringify(t.folder.getSnapshot());
      document.querySelector('[data-action="fork-world"]').click();
      const status = document.querySelector('#world-folder-status').textContent;
      if (!status.includes('复制权限：已取得') || !status.includes('分叉功能尚未实施') || JSON.stringify(t.folder.getSnapshot()) !== before) throw Error('Fork changed behavior');
      document.querySelector('#open-initial-world').click();
      if (JSON.stringify(t.opened) !== '["InitialWorld"]') throw Error('Open routing changed');
      return { forkExecuted: false, metadataUnchanged: true, opened: t.opened };
    });
    await test('D07 directory tombstone preserves account projection and clears stale diagnostic panel', () => {
      const t = window.__foundationContract, saved = t.values.get(t.key);
      document.querySelector('[data-action="delete-world"]').click(); document.querySelector('#confirm-delete-world').click();
      if (t.folder.getWorlds().length || t.folder.getSnapshot().records[0].deletedAt === null) throw Error('Tombstone changed');
      if (t.values.get(t.key) !== saved || !document.querySelector('#world-state-diagnostics').hidden) throw Error('Account fact changed or stale diagnostics retained');
      return { tombstone: true, accountFactPreserved: true, diagnosticHidden: true };
    });
    await test('D08 failure during new capture removes old completeness marker and displays explicit error', () => {
      const t = window.__foundationContract;
      t.folder.submitWorldFolderIntent({kind:'CreateWorld',title:'新契约世界',description:''}); t.view.refresh();
      t.captureFail = true; document.querySelector('[data-action="inspect-world-state"]').click();
      const status = document.querySelector('#world-state-capture-kind');
      if (status.dataset.kind !== undefined || !status.textContent.includes('读取失败') || document.querySelector('#world-state-diagnostic-list').children.length) throw Error('Stale capture survived error');
      return { staleKindRemoved: true, emptyPreviousDiagnostics: true, explicitError: true };
    });
  } catch (error) { checks.push({ name: 'harness setup', category: 'ContractTest', pass: false, error: String(error.stack || error) }); }
  finally {
    const report = { generatedAt: new Date().toISOString(), category: 'ContractTest',
      scope: 'Actual new view and director classes in isolated Chromium. The true milestone is a declared adapter fixture; this is not production clear/unlock or Cocos gameplay evidence. No screenshots are produced.',
      sourceHashes: Object.fromEntries(Object.values(sources).map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')])),
      passed: checks.filter(c=>c.pass).length, failed: checks.filter(c=>!c.pass).length, checks };
    fs.writeFileSync(path.join(__dirname,'folder-foundation.contract-results.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,failed:report.failed,checks:checks.filter(c=>!c.pass)},null,2));
    win?.destroy(); app.exit(report.failed ? 1 : 0);
  }
});
