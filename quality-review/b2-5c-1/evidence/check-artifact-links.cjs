'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const delivery = path.resolve(__dirname, '..');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory()
    ? markdownFiles(path.join(directory, item.name))
    : item.isFile() && item.name.endsWith('.md') ? [path.join(directory, item.name)] : []);
}
const files = markdownFiles(delivery).sort();
const links = files.flatMap(file => {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].flatMap(match => {
    const raw = match[1].trim();
    const target = (raw.startsWith('<') ? raw.slice(1, raw.indexOf('>')) : raw.split(/\s+"/)[0]).split('#')[0];
    if (!target || /^(?:https?|app|codex|plugin|mailto):/i.test(target)) return [];
    const decoded = decodeURIComponent(target).replace(/:\d+$/, '');
    const resolved = path.isAbsolute(decoded) ? decoded : path.resolve(path.dirname(file), decoded);
    return [{ source: path.relative(root, file).replaceAll('\\', '/'), target: raw,
      resolved, exists: fs.existsSync(resolved), sourceLine: source.slice(0, match.index).split('\n').length }];
  });
});
const missingLinks = links.filter(link => !link.exists);
const report = { generatedUtc: new Date().toISOString(), markdownFileCount: files.length, localLinkCount: links.length,
  pass: missingLinks.length === 0, missingLinks, links,
  markdownFiles: files.map(file => ({ path: path.relative(root, file).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(file)) })),
  scope: 'Local Markdown link targets in the new c-1 delivery only; fragments and network/application URLs are not verified. Target contents are not read. No production files or old docs are modified.' };
fs.writeFileSync(path.join(__dirname, 'artifact-links.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, markdownFileCount: files.length, localLinkCount: links.length, missingLinks }, null, 2));
process.exitCode = report.pass ? 0 : 1;
