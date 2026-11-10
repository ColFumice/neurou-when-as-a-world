'use strict';
// Controlled ContractAdapter fixtures; never used as Creator production input.
const assert = require('node:assert/strict');
const h = require('../b2-state-extensions/state-test-fixture.cjs');
const { load, clone, content, regular, epochMs } = h;
const { createPrimaryWorldStateCodec } = load('src/director/PrimaryWorldState.ts');
const { WorldFolderSession } = load('src/director/WorldFolderSession.ts');
const { createAccountMilestoneReader } = load('src/director/AccountMilestone.ts');
const { WorldHomeRegistryCodec } = load('src/director/WorldHomeRegistry.ts');
const { WorldHomeContractAdapter } = load('src/presentation/WorldHomeContractAdapter.ts');
const accountId = 'cross-device contract/account';
const sourceWorldId = 'world-20000000-0000-4000-8000-000000000001';
const targetWorldId = 'world-20000000-0000-4000-8000-000000000002';
const otherWorldId = 'world-20000000-0000-4000-8000-000000000003';
const transactionId = 'import-20000000-0000-4000-8000-000000000004';
const aContext = Object.freeze({ accountId, deviceId: 'device-A' });
const bContext = Object.freeze({ accountId, deviceId: 'device-B' });
const complete = (raw, account, world) => createPrimaryWorldStateCodec(account, world, content, regular.chartId).parseComplete(raw, account, world);
function transferComplete(raw, account, world) {
  const state = complete(raw, account, world);
  const { validateCoreTransferContent } = load('src/director/CoreTransferContent.ts');
  validateCoreTransferContent(state, JSON.parse(require('node:fs').readFileSync(require('node:path').join(h.root, 'assets/resources/chart/content-manifest.json'), 'utf8')));
  return state;
}
const homeCodec = new WorldHomeRegistryCodec();
function homeAuthority() {
  return new WorldHomeContractAdapter({ now: () => epochMs + 1000,
    validateContext: raw => homeCodec.parseContext(raw),
    validateRequest: raw => homeCodec.parseRegistrationRequest(raw),
    validateSnapshot: (raw, account) => homeCodec.parseSnapshot(raw, account),
    validateReply: (raw, context, request) => homeCodec.parseRegistrationReply(raw, context, request) });
}
function worldSource(options = {}) {
  const fixture = h.fixture({ accountId: options.accountId || accountId, worldId: options.worldId || sourceWorldId, completed: options.completed });
  const raw = clone(fixture.initial); raw.revision = 7; raw.capturedAt += 100;
  return { fixture, state: complete(raw, raw.accountId, raw.worldId) };
}
function folder(worldIds = ['InitialWorld'], account = accountId) {
  return { schemaVersion: 1, accountId: account, records: worldIds.map(worldId => ({ worldId, title: worldId === 'InitialWorld' ? '初始世界' : '雨中的世界',
    description: '正式内容契约载体', createdAt: epochMs - 10000, deletedAt: null, template: worldId === 'InitialWorld' ? 'InitialWorld' : 'EmptyWorld' })) };
}
function validateFolder(raw, account) {
  return new WorldFolderSession(account, raw, () => { throw Error('validator cannot write'); },
    () => { throw Error('validator cannot allocate'); }, () => { throw Error('validator cannot clock'); }).getSnapshot();
}
function permission(enabled = true, account = accountId) {
  return createAccountMilestoneReader(account, { schemaVersion: 1, accountId: account, FirstWorldCleared: enabled });
}
function normalizedSections(state) {
  const sections = clone(state.sections); sections.Ledger.worldId = '<world>';
  if (sections.Ledger.control.entry) { sections.Ledger.control.entry.worldId = '<world>'; sections.Ledger.control.entry.entryId = '<entry>'; }
  sections.PuzzleProgress.forEach(item => { item.worldId = '<world>'; });
  for (const name of ['RecallCount', 'WorldLink', 'ChartSnapshot', 'ChartScore']) sections[name].worldId = '<world>';
  return sections;
}
function frozenTree(value) {
  if (value === null || typeof value !== 'object') return;
  assert(Object.isFrozen(value), 'expected frozen data output');
  for (const item of Object.values(value)) frozenTree(item);
}
class ExclusiveLock {
  constructor() { this.tails = new Map(); this.active = new Set(); this.calls = []; }
  request(name, operation) {
    this.calls.push(name);
    const before = this.tails.get(name) || Promise.resolve();
    const result = before.catch(() => {}).then(async () => {
      assert(!this.active.has(name), 'lock must exclude concurrent critical sections'); this.active.add(name);
      try { return await operation(); } finally { this.active.delete(name); }
    });
    this.tails.set(name, result); return result;
  }
  requestIfAvailable(name, operation) {
    if (this.active.has(name)) return Promise.reject(Error('world lease unavailable'));
    return this.request(name, operation);
  }
}
const stateKey = world => 'neurou-world-state-v1:' + encodeURIComponent(accountId) + ':' + encodeURIComponent(world);
const folderKey = 'neurou-world-folder-v1:' + encodeURIComponent(accountId);
const journalKey = 'neurou-cross-device-import-v1:' + encodeURIComponent(accountId);
const accountKeys = ['neurou-account-world-clears-v1:', 'neurou-account-first-world-cleared-v1:'].map(prefix => prefix + encodeURIComponent(accountId));
module.exports = { h, load, clone, content, regular, epochMs, accountId, sourceWorldId, targetWorldId, otherWorldId, transactionId,
  aContext, bContext, complete, transferComplete, homeCodec, homeAuthority, worldSource, folder, validateFolder, permission, normalizedSections, frozenTree,
  ExclusiveLock, stateKey, folderKey, journalKey, accountKeys };
