'use strict';
// Real Chromium DOM with the actual transpiled view. Controlled reader/callbacks are
// boundary fixtures; this is not Creator gameplay or end-to-end evidence.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto'), ts = require('../../node_modules/typescript');
const { app, BrowserWindow } = require('electron');
const root = path.resolve(__dirname, '../..'), checks = [];
app.setPath('userData', path.join(require('os').tmpdir(), 'neurou-b2-dom-boundary-' + Date.now()));
app.commandLine.appendSwitch('disable-gpu');
let win;
function source(relative) { return ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText; }
async function test(name, verify) { try { checks.push({ name, pass: true, evidence: await verify() ?? null }); }
  catch (error) { checks.push({ name, pass: false, error: String(error.stack || error) }); } }
const ev = (fn, ...args) => win.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(x => JSON.stringify(x)).join(',') + ')', true);
app.whenReady().then(async () => {
  try {
    win = new BrowserWindow({ width: 1200, height: 900, show: false, webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true } });
    await win.loadURL('about:blank');
    await ev(modules => {
      const loaded = {}, load = key => { if (loaded[key]) return loaded[key].exports; const module = { exports: {} }; loaded[key] = module;
        new Function('module', 'exports', 'require', modules[key])(module, module.exports, request => load(request.split('/').at(-1))); return module.exports; };
      window.__worldDom = { WorldFolderView: load('WorldFolderView').WorldFolderView, logs: [], reader: null, view: null, records: [] };
      window.__worldDom.WorldFolderSession = load('WorldFolderSession').WorldFolderSession;
      window.__worldDom.createWorldFolderReader = load('FolderCatalog').createWorldFolderReader;
    }, { WorldFolderView: source('src/presentation/WorldFolderView.ts'), FolderTheme: source('src/presentation/FolderTheme.ts'), WorldFolderSession: source('src/director/WorldFolderSession.ts'), FolderCatalog: source('src/presentation/FolderCatalog.ts') });
    await test('D01 dynamic metadata card list has one built-in ID, distinct data identities and exact open callback routing', async () => {
      return ev(() => {
        const t = window.__worldDom; t.records = [ { worldId: 'InitialWorld', title: '初始世界', description: '既有玩法' },
          { worldId: 'local-a', title: '我的世界A', description: '空箱庭 A' }, { worldId: 'local-b', title: '我的世界B', description: '空箱庭 B' } ];
        t.reader = { getAccountId: () => '账号A', getWorlds: () => t.records };
        t.view = new t.WorldFolderView(t.reader, record => t.logs.push({ action: 'open', worldId: record.worldId }), () => t.logs.push({ action: 'editors' }),
          { submitWorldFolderIntent: intent => t.logs.push({ action: 'intent', intent }) }, () => t.logs.push({ action: 'reload' }));
        t.view.mount(); const cards = [...document.querySelectorAll('#folder-worlds article[data-world-id]')];
        if (cards.length !== 3) throw Error('Expected 3 actual card nodes, got ' + cards.length);
        const ids = [...document.querySelectorAll('#world-folder [id]')].map(e => e.id); if (new Set(ids).size !== ids.length) throw Error('Duplicate DOM IDs');
        const initial = document.querySelector('#open-initial-world'); if (!initial) throw Error('Missing built-in backward-compatible selector');
        for (const record of t.records) {
          const control = document.querySelector('#folder-worlds button[data-world-id="' + record.worldId + '"][data-action="open-world"]');
          if (!control) throw Error('Missing open control for ' + record.worldId); control.click();
        }
        const opened = t.logs.filter(x => x.action === 'open').map(x => x.worldId); if (JSON.stringify(opened) !== JSON.stringify(t.records.map(r => r.worldId))) throw Error('Wrong open routing: ' + JSON.stringify(opened));
        document.querySelector('#open-editor-folder').click(); if (!t.logs.some(x => x.action === 'editors')) throw Error('Editor route absent');
        return { cards: cards.length, duplicateIds: 0, opened, editorDirectoryPreserved: true };
      });
    });
    await test('D02 metadata and account text remain escaped rather than executing or creating HTML nodes', async () => ev(() => {
      const t = window.__worldDom; t.view.destroy(); t.records = [{ worldId: 'safe-world', title: '<img src=x onerror="window.__injected=1">', description: '<script>window.__injected=2</script>' }];
      t.reader = { getAccountId: () => '<svg onload="window.__injected=3">', getWorlds: () => t.records };
      t.view = new t.WorldFolderView(t.reader, () => {}, () => {}, { submitWorldFolderIntent() {} }, () => {}); t.view.mount();
      if (window.__injected !== undefined || document.querySelector('#world-folder img,#world-folder svg,#world-folder script')) throw Error('Unsafe interpolation into DOM');
      if (!document.querySelector('#world-folder').textContent.includes(t.records[0].title)) throw Error('Title text missing');
      return { htmlNodesCreatedFromMetadata: 0, scriptExecuted: false, exactTitleTextRetained: true };
    }));
    await test('D03 destroy/re-mount refreshes current reader data, removes prior card handlers and avoids duplicate view roots', async () => ev(() => {
      const t = window.__worldDom; t.view.destroy(); if (document.querySelector('#world-folder')) throw Error('View root remains after destroy');
      t.records = [{ worldId: 'new-latest', title: '最新世界', description: '刷新后的目录' }]; t.view.mount(); t.view.mount();
      if (document.querySelectorAll('#world-folder').length !== 1) throw Error('Duplicate mount');
      const text = document.querySelector('#folder-worlds').textContent; if (!text.includes('最新世界') || text.includes('<img')) throw Error('Stale metadata retained');
      return { roots: 1, latestTitlePresent: true, oldCardRemoved: true };
    }));
    await test('D04 empty initialized account displays no seeded cards while editor navigation remains available', async () => ev(() => {
      const t = window.__worldDom; t.view.destroy(); t.records = []; t.view.mount();
      if (document.querySelectorAll('#folder-worlds [data-world-id]').length) throw Error('Empty view reseeded InitialWorld');
      if (!document.querySelector('#open-editor-folder')) throw Error('Editors unavailable in empty account');
      return { activeCards: 0, InitialWorldReseeded: false, editorsAvailable: true };
    }));
    await test('D05 actual form creates through real director port, refreshes cards and resets controls only after success', async () => ev(() => {
      const t = window.__worldDom; t.view.destroy(); let sequence = 0; t.persistFail = false; t.persisted = [];
      t.session = new t.WorldFolderSession('dom-account', null, snapshot => { if (t.persistFail) throw Error('Storage write rejected'); t.persisted.push(JSON.parse(JSON.stringify(snapshot))); }, () => 'world-dom-' + (++sequence), () => 1000);
      t.reader = t.createWorldFolderReader('dom-account', () => t.session.getWorlds()); t.reloads = 0;
      t.view = new t.WorldFolderView(t.reader, () => {}, () => {}, t.session, () => t.reloads++); t.view.mount();
      const form = document.querySelector('#world-create-form'); document.querySelector('#create-world').click(); if (form.hidden) throw Error('Create panel hidden');
      document.querySelector('#world-title').value = '  DOM新世界  '; document.querySelector('#world-description').value = '  form说明  ';
      document.querySelector('#confirm-create-world').click(); if (t.session.getWorlds().length !== 2 || !form.hidden) throw Error('Create did not commit and close');
      if (document.querySelector('#world-title').value !== '') throw Error('Successful form was not reset');
      if (!document.querySelector('#folder-worlds').textContent.includes('DOM新世界')) throw Error('Created card absent');
      if (!document.querySelector('#world-folder-status').textContent.includes('世界已创建')) throw Error('Success feedback missing');
      document.querySelector('#create-world').click(); document.querySelector('#world-title').value = '失败保留名称'; t.persistFail = true;
      document.querySelector('#confirm-create-world').click(); if (form.hidden || document.querySelector('#world-title').value !== '失败保留名称') throw Error('Failed create discarded form');
      if (t.session.getWorlds().length !== 2 || !document.querySelector('#world-folder-status').textContent.includes('Storage write rejected')) throw Error('Failed create ghost/feedback');
      document.querySelector('#cancel-create-world').click(); if (!form.hidden) throw Error('Cancel did not hide form'); t.persistFail = false;
      return { successfulCreateCount: 1, trimmedTitle: t.session.getWorlds()[1].title, failedCreateKeepsFields: true, failedCreateGhosts: 0 };
    }));
    await test('D06 delete requires confirmation, cancel writes nothing, failed delete keeps visible record, successful delete tombstones', async () => ev(() => {
      const t = window.__worldDom, world = t.session.getWorlds()[1], confirmation = document.querySelector('#world-delete-confirm');
      const button = () => document.querySelector('button[data-action="delete-world"][data-world-id="' + world.worldId + '"]');
      const before = t.persisted.length; button().click(); if (confirmation.hidden) throw Error('Delete confirmation not shown');
      if (t.persisted.length !== before) throw Error('Delete executed before confirmation'); document.querySelector('#cancel-delete-world').click();
      if (!confirmation.hidden || t.persisted.length !== before) throw Error('Cancel mutated records');
      button().click(); t.persistFail = true; document.querySelector('#confirm-delete-world').click();
      if (confirmation.hidden || !button() || t.session.getWorlds().length !== 2) throw Error('Failed deletion lost visible record');
      t.persistFail = false; document.querySelector('#confirm-delete-world').click();
      if (!confirmation.hidden || button() || t.session.getWorlds().length !== 1) throw Error('Successful deletion did not refresh list');
      const tombstone = t.session.getSnapshot().records.find(r => r.worldId === world.worldId); if (tombstone.deletedAt === null) throw Error('Metadata record physically deleted');
      return { preConfirmationWrites: 0, cancellationWrites: 0, failedDeleteRetainsCard: true, successfulTombstone: world.worldId };
    }));
    await test('D07 real fork intent displays unavailable message without creating record; refresh delegates current-reader reload', async () => ev(() => {
      const t = window.__worldDom, before = JSON.stringify(t.session.getSnapshot()); document.querySelector('button[data-action="fork-world"][data-world-id="InitialWorld"]').click();
      if (!document.querySelector('#world-folder-status').textContent.includes('分叉尚未开放')) throw Error('Fork feedback missing');
      if (JSON.stringify(t.session.getSnapshot()) !== before) throw Error('Fork changed metadata'); document.querySelector('#refresh-worlds').click();
      if (t.reloads !== 1) throw Error('Refresh did not delegate reload'); return { forkCreates: 0, explicitUnavailableFeedback: true, reloadCallbackCount: t.reloads };
    }));
  } catch (error) { checks.push({ name: 'DOM harness setup', pass: false, error: String(error.stack || error) }); }
  finally {
    const report = { generatedAt: new Date().toISOString(), scope: 'Actual WorldFolderView/FolderTheme executed in isolated real Chromium DOM. Reader/callbacks are declared fixtures; no Creator gameplay or catalog persistence claim.',
      sourceHashes: Object.fromEntries(['src/presentation/WorldFolderView.ts', 'src/presentation/FolderTheme.ts'].map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')])),
      passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, checks };
    fs.writeFileSync(path.join(__dirname, 'dom-boundary-results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); if (win) win.destroy(); app.exit(report.failed ? 1 : 0);
  }
});
