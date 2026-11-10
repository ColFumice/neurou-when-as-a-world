'use strict';
// Injected authority contracts. These are not a production BugShore or AI-service acceptance.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const { WorldLinkSession, validateWorldLinkSnapshot, validateAIProfile } = require(path.join(root, 'src/director/WorldLinkSession.ts'));
const clone = value => JSON.parse(JSON.stringify(value));
const base = { accountId: 'link-account', worldId: 'shore-1', protagonistCharacterId: 'rain', worldKind: 'Shore', shoreOrigin: 'BugShore', sourceWorldId: 'primary-1' };
function profile(revision = '1') { return { schemaVersion: 1, profileId: 'published-profile', revision,
  providers: [{ providerId: 'templates', kind: 'TemplateProvider', contentId: 'rain-lines', contentRevision: revision,
    templates: [{ templateId: 'greeting', text: '雨停以前，请留在屋檐下。' }] }],
  taskRoutes: [{ task: 'Narrative', fallbackChain: ['templates'] }, { task: 'RealityHint', fallbackChain: ['templates'] }] }; }
function fixture() {
  let source = { kind: 'Present', accountId: base.accountId, worldId: base.sourceWorldId, worldKind: 'Primary', profile: profile() };
  let writes = [], fail = false, ticks = 0;
  const callbacks = { readSource: () => source, now: () => 1791600000000 + ticks++, persist: value => { if (fail) throw new Error('quota'); writes.push(value); } };
  return { callbacks, writes, setSource: value => { source = value; }, setProfile: value => { source = { ...source, profile: value }; },
    deleted: () => { source = { kind: 'Deleted', accountId: base.accountId, worldId: base.sourceWorldId }; },
    unknown: () => { source = { kind: 'Unknown', accountId: base.accountId, worldId: base.sourceWorldId }; }, fail: value => { fail = value; } };
}
const results = [];
function test(name, operation) { operation(); results.push({ name, category: 'ContractTest', result: 'PASS' }); }
try {
  test('Primary declares explicit verified NotApplicable without profile/source access', () => {
    let read = 0; const context = { ...base, worldId: 'primary-1', worldKind: 'Primary', shoreOrigin: null }; delete context.sourceWorldId;
    const session = new WorldLinkSession(context, { readSource: () => { read++; throw new Error(); } });
    assert.equal(session.getSnapshot().kind, 'NotApplicable'); assert.equal(read, 0);
    assert.throws(() => session.readEffectiveProfile()); assert.throws(() => session.enterFromSource('primary-1'));
  });
  test('FinalShore declares NotApplicable without borrowing a six-world source', () => {
    const context = { ...base, shoreOrigin: 'FinalShore' }; delete context.sourceWorldId;
    assert.equal(new WorldLinkSession(context).getSnapshot().shoreOrigin, 'FinalShore');
    assert.throws(() => new WorldLinkSession({ ...context, sourceWorldId: 'primary-1' }));
  });
  test('BugShore without injected authoritative reader rejects', () => assert.throws(() => new WorldLinkSession(base), /读取器/));
  test('BugShore does not invent snapshot before actual source entry', () => {
    const f = fixture(), session = new WorldLinkSession(base, f.callbacks);
    assert.throws(() => session.getSnapshot(), /尚未/); assert.equal(f.writes.length, 0);
  });
  test('source entry freezes complete profile, clock and identities after durable write', () => {
    const f = fixture(), session = new WorldLinkSession(base, f.callbacks); const saved = session.enterFromSource(base.sourceWorldId);
    assert.equal(saved.linkState, 'Bound'); assert.equal(saved.aiProfileSnapshot.profile.revision, '1'); assert.equal(f.writes.length, 1);
    assert(Object.isFrozen(saved.aiProfileSnapshot.profile.providers[0].templates[0]));
    assert.equal(saved.aiProfileSnapshot.capturedAt, 1791600000000);
  });
  test('Bound reads live source changes while stored snapshot changes only on source entry', () => {
    const f = fixture(), session = new WorldLinkSession(base, f.callbacks); session.enterFromSource(base.sourceWorldId);
    f.setProfile(profile('2')); assert.equal(session.readEffectiveProfile().revision, '2');
    assert.equal(session.getSnapshot().aiProfileSnapshot.profile.revision, '1'); assert.equal(f.writes.length, 1);
    session.enterFromSource(base.sourceWorldId); assert.equal(session.getSnapshot().aiProfileSnapshot.profile.revision, '2'); assert.equal(f.writes.length, 2);
  });
  test('directory direct reentry hydration neither clocks nor refreshes nor persists', () => {
    const f = fixture(), first = new WorldLinkSession(base, f.callbacks); const saved = first.enterFromSource(base.sourceWorldId);
    f.setProfile(profile('2')); const seed = clone(saved), before = JSON.stringify(seed);
    const restored = new WorldLinkSession(base, { readSource: f.callbacks.readSource, now() { throw new Error(); }, persist() { throw new Error(); } }, seed);
    assert.equal(restored.getSnapshot().aiProfileSnapshot.profile.revision, '1'); assert.equal(restored.readEffectiveProfile().revision, '2');
    assert.equal(JSON.stringify(seed), before);
  });
  test('known source tombstone derives Orphaned purely, explicit lifecycle persists once', () => {
    const f = fixture(), session = new WorldLinkSession(base, f.callbacks); session.enterFromSource(base.sourceWorldId); f.deleted();
    assert.equal(session.getSnapshot().linkState, 'Orphaned'); assert.equal(f.writes.length, 1);
    assert.equal(session.canReturnToSource(), false); assert.equal(session.readEffectiveProfile().revision, '1');
    session.refreshSourceState(); session.refreshSourceState(); assert.equal(f.writes.length, 2);
  });
  test('Orphaned profile never refreshes or rebinds when source id reappears', () => {
    const f = fixture(), session = new WorldLinkSession(base, f.callbacks); session.enterFromSource(base.sourceWorldId); f.deleted(); session.refreshSourceState();
    f.setSource({ kind: 'Present', accountId: base.accountId, worldId: base.sourceWorldId, worldKind: 'Primary', profile: profile('9') });
    assert.equal(session.readEffectiveProfile().revision, '1'); assert.equal(session.canReturnToSource(), false);
    assert.throws(() => session.enterFromSource(base.sourceWorldId), /重新绑定/); assert.equal(f.writes.length, 2);
  });
  test('Unknown source never silently becomes orphaned or changes saved bytes', () => {
    const f = fixture(), session = new WorldLinkSession(base, f.callbacks); const before = session.enterFromSource(base.sourceWorldId); f.unknown();
    assert.throws(() => session.getSnapshot(), /未知/); assert.throws(() => session.refreshSourceState(), /未知/);
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0], before);
  });
  test('write failure preserves prior in-memory snapshot and permits same entry retry', () => {
    const f = fixture(), session = new WorldLinkSession(base, f.callbacks); session.enterFromSource(base.sourceWorldId); f.setProfile(profile('2')); f.fail(true);
    assert.throws(() => session.enterFromSource(base.sourceWorldId), /quota/); assert.equal(session.getSnapshot().aiProfileSnapshot.profile.revision, '1');
    f.fail(false); session.enterFromSource(base.sourceWorldId); assert.equal(session.getSnapshot().aiProfileSnapshot.profile.revision, '2');
  });
  test('mutating link lifecycle requires actual persistence callback', () => {
    const f = fixture(), session = new WorldLinkSession(base, { readSource: f.callbacks.readSource, now: () => 0 });
    assert.throws(() => session.enterFromSource(base.sourceWorldId), /持久/); assert.throws(() => session.getSnapshot());
  });
  test('persist callback cannot reenter and replace an outer candidate', () => {
    const f = fixture(); let session, writes = 0;
    session = new WorldLinkSession(base, { ...f.callbacks, persist() {
      writes++; assert.throws(() => session.enterFromSource(base.sourceWorldId), /不可重入/);
    } });
    const snapshot = session.enterFromSource(base.sourceWorldId);
    assert.equal(writes, 1); assert.deepEqual(session.getSnapshot(), snapshot);
  });
  test('wrong source entry id rejects before reading or persisting', () => {
    const f = fixture(), session = new WorldLinkSession(base, f.callbacks);
    assert.throws(() => session.enterFromSource('another-source')); assert.equal(f.writes.length, 0);
  });
  test('single level authority rejects Shore source and self references', () => {
    const f = fixture(); f.setSource({ kind: 'Present', accountId: base.accountId, worldId: base.sourceWorldId, worldKind: 'Shore', profile: profile() });
    assert.throws(() => new WorldLinkSession(base, f.callbacks).enterFromSource(base.sourceWorldId), /彼岸套彼岸/);
    assert.throws(() => new WorldLinkSession({ ...base, sourceWorldId: base.worldId }, f.callbacks), /自引用/);
  });
  test('authoritative source account/world mismatch rejects', () => {
    for (const patch of [{ accountId: 'other' }, { worldId: 'other' }]) {
      const f = fixture(); f.setSource({ kind: 'Present', accountId: base.accountId, worldId: base.sourceWorldId, worldKind: 'Primary', profile: profile(), ...patch });
      assert.throws(() => new WorldLinkSession(base, f.callbacks).enterFromSource(base.sourceWorldId), /身份/);
    }
  });
  test('snapshot account/world/character/source/state/version are strictly bound', () => {
    const f = fixture(), saved = new WorldLinkSession(base, f.callbacks).enterFromSource(base.sourceWorldId);
    for (const patch of [{ schemaVersion: 2 }, { accountId: 'other' }, { worldId: 'other' }, { protagonistCharacterId: 'other' }, { sourceWorldId: 'other' }, { linkState: 'Unknown' }, { kind: 'NotApplicable' }]) {
      assert.throws(() => validateWorldLinkSnapshot({ ...saved, ...patch }, base, f.callbacks.readSource));
    }
  });
  test('missing required orphan snapshot cannot be replaced by a default profile', () => {
    const f = fixture(), saved = clone(new WorldLinkSession(base, f.callbacks).enterFromSource(base.sourceWorldId)); f.deleted(); saved.aiProfileSnapshot = null;
    assert.throws(() => validateWorldLinkSnapshot(saved, base, f.callbacks.readSource));
  });
  test('strict envelopes reject unknown fields, inherited prototypes, accessors and symbol keys', () => {
    const f = fixture(), saved = new WorldLinkSession(base, f.callbacks).enterFromSource(base.sourceWorldId); let getterCalls = 0;
    const getter = clone(saved); Object.defineProperty(getter, 'worldId', { get() { getterCalls++; return base.worldId; } });
    for (const raw of [{ ...saved, extra: true }, Object.assign(Object.create({}), saved), getter, { ...saved, [Symbol('extra')]: 1 }]) {
      assert.throws(() => validateWorldLinkSnapshot(raw, base, f.callbacks.readSource));
    }
    assert.equal(getterCalls, 0);
  });
  test('profile validation deep-clones immutable full configuration', () => {
    const raw = profile(), parsed = validateAIProfile(raw); raw.providers[0].templates[0].text = 'changed';
    assert.equal(parsed.providers[0].templates[0].text, '雨停以前，请留在屋檐下。'); assert(Object.isFrozen(parsed.taskRoutes[0].fallbackChain));
  });
  test('profile rejects empty templates/routes, missing/duplicate providers and route references', () => {
    const malformed = [];
    let value = profile(); value.providers[0].templates = []; malformed.push(value);
    value = profile(); value.taskRoutes = []; malformed.push(value);
    value = profile(); value.providers.push(clone(value.providers[0])); malformed.push(value);
    value = profile(); value.taskRoutes[0].fallbackChain = ['missing']; malformed.push(value);
    value = profile(); value.taskRoutes[0].fallbackChain = ['templates', 'templates']; malformed.push(value);
    value = profile(); value.providers[0].templates.push(clone(value.providers[0].templates[0])); malformed.push(value);
    for (const raw of malformed) assert.throws(() => validateAIProfile(raw));
  });
  test('private task routing rejects cloud while ordinary route can fall back to actual templates', () => {
    const raw = profile(); raw.providers.unshift({ providerId: 'cloud', kind: 'CloudProvider', model: 'model-id', endpoint: 'https://provider.invalid/v1', credentialRef: 'local-key-reference', systemPrompt: 'Use the supplied character facts.' });
    raw.taskRoutes[0].fallbackChain = ['cloud', 'templates']; assert.equal(validateAIProfile(raw).providers[0].kind, 'CloudProvider');
    raw.taskRoutes[1].fallbackChain = ['cloud', 'templates']; assert.throws(() => validateAIProfile(raw), /不得使用云端/);
  });
  test('local provider configuration is retained completely and quotations cannot generate', () => {
    const raw = profile(); raw.providers.unshift({ providerId: 'local', kind: 'LocalProvider', model: 'Qwen2.5-1.5B', modelRevision: 'sha256:model-content', systemPrompt: 'Use only on-device context.' });
    raw.taskRoutes[1].fallbackChain = ['local', 'templates']; assert.equal(validateAIProfile(raw).providers[0].modelRevision, 'sha256:model-content');
    raw.taskRoutes.push({ task: 'Quotation', fallbackChain: ['templates'] }); assert.throws(() => validateAIProfile(raw), /名言/);
  });
  test('sparse/accessor/extended arrays and future profile schema reject without executing getters', () => {
    let calls = 0; const candidates = [];
    let raw = profile(); raw.providers = Array(1); candidates.push(raw);
    raw = profile(); raw.providers.extra = true; candidates.push(raw);
    raw = profile(); Object.defineProperty(raw.providers, '0', { get() { calls++; return {}; } }); candidates.push(raw);
    raw = profile(); raw.schemaVersion = 2; candidates.push(raw);
    for (const candidate of candidates) assert.throws(() => validateAIProfile(candidate)); assert.equal(calls, 0);
  });
  fs.writeFileSync(path.join(__dirname, 'world-link.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length, failed: 0, results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, failed: 0 }));
} catch (error) {
  fs.writeFileSync(path.join(__dirname, 'world-link.contract-results.json'), JSON.stringify({ category: 'ContractTest', passed: results.length, failed: 1, error: String(error.stack), results }, null, 2) + '\n');
  throw error;
}
