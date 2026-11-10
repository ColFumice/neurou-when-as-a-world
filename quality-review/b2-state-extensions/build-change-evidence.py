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
aliases = ('assets/scripts/src/', 'assets/scripts/constants/')
prior = {item['path']: item for item in baseline['files'] if not item['path'].startswith(aliases)}
paths = set(prior)
for directory in ('src', 'constants', 'assets/scripts', 'assets/resources', 'scripts', 'docs'):
    for current, folders, files in os.walk(ROOT / directory, followlinks=False):
        folders[:] = [name for name in folders
                      if (Path(current) / name).relative_to(ROOT).as_posix() not in
                      ('assets/scripts/src', 'assets/scripts/constants')]
        paths.update((Path(current) / name).relative_to(ROOT).as_posix() for name in files)

changed, deleted, unchanged, diff = [], [], [], []
for name in sorted(paths):
    target = ROOT / name
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
    changed.append(item)
    old_file = HERE / 'baseline' / name
    old_bytes = old_file.read_bytes() if old_file.is_file() else b''
    try:
        old_text, new_text = old_bytes.decode('utf-8-sig'), (after_bytes or b'').decode('utf-8-sig')
    except UnicodeDecodeError:
        diff.append('Binary files differ: ' + name + '\n')
        continue
    if before and not old_file.is_file():
        diff.append('Baseline text unavailable: ' + name + '\n')
        continue
    diff.extend(difflib.unified_diff(old_text.splitlines(keepends=True), new_text.splitlines(keepends=True),
                                   fromfile='a/' + name if before else '/dev/null',
                                   tofile='b/' + name if after_bytes is not None else '/dev/null'))

allowed_existing = {
    'src/director/IntentPort.ts', 'src/director/PlayerIntent.ts',
    'src/director/WorldStateCodec.ts', 'src/director/WorldStateSession.ts',
    'src/presentation/WorldCoreStateStorage.ts', 'src/presentation/WorldCoreStateView.ts',
    'src/presentation/WorldFolderView.ts', 'src/presentation/WorldStateStorage.ts',
    'assets/scripts/SceneBuilder.ts', 'assets/scripts/WorldFolderBuilder.ts',
}
added_sources = {
    'src/director/RecallCountSession.ts', 'src/director/WorldLinkSession.ts',
    'src/director/ChartArchive.ts', 'src/director/PrimaryWorldState.ts',
    'src/director/ChartReplaySession.ts', 'src/presentation/ChartReplayView.ts',
    'src/presentation/WorldMemoryView.ts',
}
allowed_added = added_sources | {name + '.meta' for name in added_sources} | {
    'assets/resources/chart/content-manifest.json', 'assets/resources/chart/content-manifest.json.meta',
}
unexpected = [item for item in changed if item['path'] not in
              (allowed_existing if item['status'] == 'Modified' else allowed_added)]
protected = [{'path': name, 'unchanged': name in unchanged} for name, item in prior.items() if item.get('protected')]

# The accepted d1 audit adds coverage of archive, all remaining docs and editor files.
accepted = json.loads((ROOT / 'quality-review/b2-state-core/protected-baseline.json').read_text(encoding='utf-8-sig'))
extra = []
for item in accepted['files']:
    name = item['path']
    if name in prior or not name.startswith(('archive/', 'docs/', '.trae/')):
        continue
    target = ROOT / name
    digest = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
    extra.append({'path': name, 'unchanged': digest == item['sha256'], 'baseline': 'accepted-d1-protected-baseline'})

cc_hits = []
for filename in (ROOT / 'src').rglob('*.ts'):
    if filename.relative_to(ROOT / 'src').parts[0] == 'presentation':
        continue
    content = filename.read_text(encoding='utf-8-sig')
    if re.search(r"(?:from\s*|require\s*\(\s*)['\"]cc['\"]", content):
        cc_hits.append(filename.relative_to(ROOT).as_posix())

manifest = {'batch': 'B2.2d-2', 'generatedAt': datetime.now(timezone.utc).isoformat(),
            'baselineCapturedAt': baseline['createdAt'], 'baselinePathCount': len(prior),
            'excludedJunctionAliases': list(aliases), 'modifiedCount': sum(x['status'] == 'Modified' for x in changed),
            'addedCount': sum(x['status'] == 'Added' for x in changed), 'files': changed}
audit = {'batch': 'B2.2d-2', 'generatedAt': manifest['generatedAt'], 'protected': protected,
         'additionalProtected': extra, 'unexpectedChanges': unexpected, 'deleted': deleted,
         'logicCcImports': cc_hits, 'unchangedBaselineCount': len(unchanged),
         'coreAlgorithmsUnchanged': [name for name in unchanged if name.startswith((
             'src/character/', 'src/trace/', 'src/chart/', 'src/editor/', 'src/musicEditor/', 'src/ledger/',
             'src/world/', 'src/director/Account', 'src/director/WorldClear', 'src/director/LedgerHydration',
             'src/director/PuzzleHydration', 'src/director/SphereCrossing'))],
         'pass': not unexpected and not deleted and not cc_hits and all(x['unchanged'] for x in protected + extra)}
(HERE / 'changed-files.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(HERE / 'protected-final-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(HERE / 'production.diff').write_text(''.join(diff), encoding='utf-8')
print(json.dumps({'modified': manifest['modifiedCount'], 'added': manifest['addedCount'],
                  'protectedFiles': len(protected) + len(extra), 'pass': audit['pass']}, ensure_ascii=False))
if not audit['pass']:
    raise SystemExit(1)
