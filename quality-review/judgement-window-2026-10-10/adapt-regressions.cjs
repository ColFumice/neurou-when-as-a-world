// Rebuild the four copied harnesses from unchanged prior evidence, with disclosed numerical adaptations.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const sourceDir = path.join(root, 'quality-review/world-folder');
const specifications = {
  'b-regression': [
    ["verdict(p, 'tap-b', 'Miss', 3120)", "verdict(p, 'tap-b', 'Miss', 3000 + GOOD_WINDOW_MS)", 'The expired Tap resolves at target + the widened Good window.'],
    ["command: 'node quality-review/guidance-editor/b-regression.cjs'", "command: 'node quality-review/judgement-window-2026-10-10/b-regression.cjs'", 'Report the current reproduction command.'],
  ],
  'c-regression': [
    ["assert.deepEqual(tiers(q),[[null],['Good']])", "assert.deepEqual(tiers(q),[[null],['Perfect']])", 'The unchanged 62.5 ms tie is now inside Perfect 100 ms. Candidate identity is unchanged.'],
    ["find(n=>n.node.id==='a-node').tier,'Good'", "find(n=>n.node.id==='a-node').tier,'Perfect'", 'The unchanged 51 ms input is now Perfect; the same node still wins the identity tie.'],
  ],
  'pad-regression': [
    ['remote.advance(3121)', 'remote.advance(3000 + GOOD_WINDOW_MS + 1)', 'Wrong-key Tap expires strictly after the new Good endpoint.'],
    ["verdict(remote, 'tap', 'Miss', 3120)", "verdict(remote, 'tap', 'Miss', 3000 + GOOD_WINDOW_MS)", 'The deadline is the new Good endpoint.'],
    ['space.advance(3121)', 'space.advance(3000 + GOOD_WINDOW_MS + 1)', 'Space still cannot consume Tap; advance past the new deadline.'],
    ["verdict(space, 'tap', 'Miss', 3120)", "verdict(space, 'tap', 'Miss', 3000 + GOOD_WINDOW_MS)", 'The deadline is the new Good endpoint.'],
    ["[[-120, 'Good'], [-50, 'Perfect'], [0, 'Perfect'], [50, 'Perfect'], [120, 'Good'], [120.001, 'Miss']]", "[[-200, 'Good'], [-100, 'Perfect'], [0, 'Perfect'], [100, 'Perfect'], [200, 'Good'], [200.001, 'Miss']]", 'Update only the numeric endpoints and just-outside probe; neighbor matching rules remain intact.'],
    ['p.advance(3121); assert.equal(p.getMissCount(), 1)', 'p.advance(3000 + GOOD_WINDOW_MS + 1); assert.equal(p.getMissCount(), 1)', 'The unconsumed earlier legacy Note now expires after 3200 ms.'],
  ],
  'editor-regression': [
    ["[[-120,'Good'],[-50,'Perfect'],[0,'Perfect'],[50,'Perfect'],[120,'Good'],[121,'Miss']]", "[[-200,'Good'],[-100,'Perfect'],[0,'Perfect'],[100,'Perfect'],[200,'Good'],[201,'Miss']]", 'Use the authorized new absolute-time Perfect/Good endpoints in v3.'],
    ['p.advance(12121)', 'p.advance(12201)', 'The unresolved last absolute-time Tap now expires strictly after 12000 + 200 ms.'],
  ],
};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const adaptations = [], diffs = [];
for (const [name, replacements] of Object.entries(specifications)) {
  const source = path.join(sourceDir, name + '.cjs'), target = path.join(__dirname, name + '.cjs');
  const original = fs.readFileSync(source, 'utf8');
  let current = original;
  for (const [before, after, reason] of replacements) {
    const count = current.split(before).length - 1;
    if (count !== 1) { throw new Error(name + ': expected exactly one adaptation match, got ' + count + ': ' + before); }
    current = current.replace(before, after);
    adaptations.push({ harness: name, before, after, reason });
  }
  fs.writeFileSync(target, current);
  diffs.push(spawnSync('git', ['diff', '--no-index', '--', source, target], { cwd: root, encoding: 'utf8' }).stdout);
  if (sha256(fs.readFileSync(source)) !== sha256(Buffer.from(original))) { throw new Error('Prior evidence changed: ' + source); }
}
fs.writeFileSync(path.join(__dirname, 'regression-adaptations.json'), JSON.stringify({
  scope: 'Copied harness inputs/expected tiers/deadlines only; no production rule changes and no changes to earlier evidence.', adaptations,
}, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'regression-adaptations.diff'), diffs.join('\n'));
console.log('Adapted ' + Object.keys(specifications).length + ' harness copies with ' + adaptations.length + ' disclosed replacements.');
