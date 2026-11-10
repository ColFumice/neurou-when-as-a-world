"""Compare the pre-edit baseline without counting Cocos junction aliases twice."""
from pathlib import Path
from datetime import datetime, timezone
import difflib
import hashlib
import json
import os
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
baseline = json.loads((HERE / 'baseline-manifest.json').read_text(encoding='utf-8-sig'))
receipt = json.loads((HERE / 'protocol-acceptance.json').read_text(encoding='utf-8-sig'))
attribution = receipt['confirmedAttribution']
accepted_protected = json.loads((HERE / 'accepted-protected-manifest.json').read_text(encoding='utf-8-sig'))
subsequent_landings = json.loads((HERE / 'post-acceptance-trae-landings.json').read_text(encoding='utf-8-sig'))
historical_paths = {item['path']: HERE / item['snapshotPath'] for item in accepted_protected['files']}
for item in accepted_protected['files']:
    raw = historical_paths[item['path']].read_bytes()
    assert hashlib.sha256(raw).hexdigest() == item['sha256'] and len(raw) == item['bytes']
for item in subsequent_landings['files']:
    raw = (HERE / item['snapshotPath']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == item['observedSha256'] and len(raw) == item['bytes']

def accepted_target(name):
    # Use verified historical bytes only for the three protected docs/checker.
    # Production sources still come from the live workspace. Later Trae docs
    # are observed separately and never counted as B2.3 implementer edits.
    return historical_paths.get(name, ROOT / name)

aliases = ('assets/scripts/src/', 'assets/scripts/constants/')
prior = {item['path']: item for item in baseline['files'] if not item['path'].startswith(aliases)}
paths = set(prior)
for directory in ('src', 'constants', 'assets/scripts', 'assets/resources', 'scripts', 'docs'):
    for current, folders, files in os.walk(ROOT / directory, followlinks=False):
        folders[:] = [name for name in folders
                      if (Path(current) / name).relative_to(ROOT).as_posix() not in
                      ('assets/scripts/src', 'assets/scripts/constants')]
        paths.update((Path(current) / name).relative_to(ROOT).as_posix() for name in files)

# These two files changed in the shared workspace at 20:19:53 during this batch.
# PROTOCOL confirmed that Trae made these authorized d2 documentation/whitelist
# landings. Legacy external field/file names remain for evidence compatibility;
# the receipt attributes the changes. Preserve them, never restore a baseline.
external_expected = {
    'docs/spec/stage-1.md': '86be27d38426bb6e8483a90979fc193deafe336240c93c01833031c895c296ea',
    'scripts/check-naming.js': '73dec0e7d35b52b07d55d40cc26fa5ce2f59f20c0408faed42d74790e56499b8',
}
external_paths = set(external_expected)
changed, deleted, unchanged, diff, external, external_diff = [], [], [], [], [], []
for name in sorted(paths):
    target = accepted_target(name)
    before = prior.get(name)
    after_bytes = target.read_bytes() if target.is_file() else None
    after_hash = hashlib.sha256(after_bytes).hexdigest() if after_bytes is not None else None
    if before and after_hash == before['sha256']:
        unchanged.append(name)
        continue
    if after_bytes is None:
        deleted.append(name)
    item = {'path': name, 'status': 'Deleted' if after_bytes is None else 'Modified' if before else 'Added',
            'beforeSha256': before['sha256'] if before else None, 'afterSha256': after_hash,
            'bytes': len(after_bytes) if after_bytes is not None else None}
    if name in external_paths: item['matchesObservedExternalBytes'] = after_hash == external_expected[name]
    (external if name in external_paths else changed).append(item)
    target_diff = external_diff if name in external_paths else diff
    old_file = HERE / 'baseline' / name
    old_bytes = old_file.read_bytes() if old_file.is_file() else b''
    try:
        old_text, new_text = old_bytes.decode('utf-8-sig'), (after_bytes or b'').decode('utf-8-sig')
        old_text = old_text.replace('\r\n', '\n')
        new_text = new_text.replace('\r\n', '\n')
    except UnicodeDecodeError:
        target_diff.append('Binary files differ: ' + name + '\n')
        continue
    if before and not old_file.is_file():
        target_diff.append('Baseline text unavailable: ' + name + '\n')
        continue
    target_diff.extend(difflib.unified_diff(old_text.splitlines(keepends=True), new_text.splitlines(keepends=True),
                                   fromfile='a/' + name if before else '/dev/null',
                                   tofile='b/' + name if after_bytes is not None else '/dev/null'))

allowed_existing = {
    'src/director/IntentPort.ts', 'src/director/WorldClearSession.ts',
    'src/director/WorldStateCodec.ts', 'src/director/WorldStateSession.ts',
    'src/presentation/WorldCoreStateStorage.ts', 'src/presentation/WorldClearView.ts',
    'src/presentation/WorldFolderView.ts',
    'assets/scripts/SceneBuilder.ts', 'assets/scripts/WorldFolderBuilder.ts',
}
added_sources = {
    'src/director/WorldForkOrigin.ts', 'src/director/WorldForkSession.ts',
    'src/director/ForkWorldClearSession.ts', 'src/presentation/WorldForkStorage.ts',
}
allowed_added = added_sources | {name + '.meta' for name in added_sources}
unexpected = [item for item in changed if item['path'] not in
              (allowed_existing if item['status'] == 'Modified' else allowed_added)]
protected = [{'path': name, 'unchanged': name in unchanged,
              'concurrentExternalChange': name in external_paths and name not in unchanged}
             for name, item in prior.items() if item.get('protected')]

# The accepted d1 audit adds coverage of archive, all remaining docs and editor files.
accepted = json.loads((ROOT / 'quality-review/b2-state-core/protected-baseline.json').read_text(encoding='utf-8-sig'))
extra = []
for item in accepted['files']:
    name = item['path']
    if name in prior or not name.startswith(('archive/', 'docs/', '.trae/')):
        continue
    target = accepted_target(name)
    digest = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
    extra.append({'path': name, 'unchanged': digest == item['sha256'], 'baseline': 'accepted-d1-protected-baseline'})

cc_hits = []
for filename in (ROOT / 'src').rglob('*.ts'):
    if filename.relative_to(ROOT / 'src').parts[0] == 'presentation':
        continue
    content = filename.read_text(encoding='utf-8-sig')
    if re.search(r"(?:from\s*|require\s*\(\s*)['\"]cc['\"]", content):
        cc_hits.append(filename.relative_to(ROOT).as_posix())

manifest = {'batch': 'B2.3', 'generatedAt': datetime.now(timezone.utc).isoformat(),
            'evidenceScope': 'OriginalAcceptedB23State',
            'protectedSnapshots': 'accepted-protected-manifest.json',
            'baselineCapturedAt': baseline['createdAt'], 'baselinePathCount': len(prior),
            'excludedJunctionAliases': list(aliases), 'modifiedCount': sum(x['status'] == 'Modified' for x in changed),
            'addedCount': sum(x['status'] == 'Added' for x in changed), 'files': changed}
audit = {'batch': 'B2.3', 'generatedAt': manifest['generatedAt'], 'protected': protected,
         'evidenceScope': manifest['evidenceScope'],
         'historicalProtectedSnapshots': accepted_protected,
         'subsequentTraeLandings': subsequent_landings,
         'workspaceProtectedBytesAllUnchangedScope': 'Original acceptance, not current post-acceptance documentation',
         'additionalProtected': extra, 'unexpectedChanges': unexpected, 'deleted': deleted,
         'logicCcImports': cc_hits, 'unchangedBaselineCount': len(unchanged),
         'workspaceProtectedBytesAllUnchanged': all(x['unchanged'] for x in protected + extra),
         'concurrentExternalChanges': external,
         'confirmedAttribution': attribution,
         'protocolAcceptanceStatus': receipt['status'],
         'coreAlgorithmsUnchanged': [name for name in unchanged if name.startswith((
             'src/character/', 'src/trace/', 'src/chart/', 'src/editor/', 'src/musicEditor/', 'src/ledger/',
             'src/world/', 'src/director/Account', 'src/director/WorldClear', 'src/director/LedgerHydration',
             'src/director/PuzzleHydration', 'src/director/SphereCrossing'))],
         'pass': not unexpected and not deleted and not cc_hits and
                 all(x['unchanged'] or x.get('concurrentExternalChange', False) for x in protected + extra) and
                 all(x['matchesObservedExternalBytes'] for x in external)}
(HERE / 'changed-files.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(HERE / 'protected-final-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(HERE / 'production.diff').write_text(''.join(diff), encoding='utf-8')
(HERE / 'concurrent-external.diff').write_text(''.join(external_diff), encoding='utf-8')
(HERE / 'concurrent-external-changes.json').write_text(json.dumps({
    'category': 'ProtocolAuthorizedConcurrentLanding', 'editedByB23': False,
    'evidenceScope': 'OriginalAcceptedB23State',
    'confirmedAttribution': attribution,
    'note': 'PROTOCOL confirmed authorized Trae d2 spec additions and v3.10 naming whitelist. Original file names, diff and observed hashes are retained for continuity. The earlier baseline checker result remains historical supplemental evidence.',
    'files': external}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
subsequent_diff = []
for item in subsequent_landings['files']:
    name = item['path']
    old_text = accepted_target(name).read_text(encoding='utf-8-sig')
    new_text = (HERE / item['snapshotPath']).read_text(encoding='utf-8-sig')
    subsequent_diff.extend(difflib.unified_diff(old_text.splitlines(keepends=True), new_text.splitlines(keepends=True),
                                              fromfile='accepted/' + name, tofile='trae-later/' + name))
(HERE / 'post-acceptance-trae.diff').write_text(''.join(subsequent_diff), encoding='utf-8')
print(json.dumps({'modified': manifest['modifiedCount'], 'added': manifest['addedCount'],
                  'protectedFiles': len(protected) + len(extra), 'pass': audit['pass']}, ensure_ascii=False))
if not audit['pass']:
    raise SystemExit(1)
