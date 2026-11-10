'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const phaseDirectory = path.resolve(__dirname, '..');
const outputName = process.argv[2] || 'artifact-link-audit.json';
if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(outputName)) throw new Error('Use a JSON evidence basename.');
if (fs.existsSync(path.join(__dirname, outputName))) throw new Error('Prior link audit is immutable.');
const documents = fs.readdirSync(phaseDirectory).filter(name => name.endsWith('.md')).sort().map(name => path.join(phaseDirectory, name));
const checks = documents.map(file => {
  const bytes = fs.readFileSync(file), source = bytes.toString('utf8'), links = [];
  for (const match of source.matchAll(/(?<!!)\[[^\]\r\n]+\]\((<[^>]+>|[^)\r\n]+)\)/g)) {
    let target = match[1].trim(); if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    if (/^(?:https?:|mailto:|codex:|app:|data:)/i.test(target) || target.startsWith('#')) continue;
    target = target.replace(/\s+"[^"]*"$/, '').split('#')[0].replace(/:\d+$/, '');
    try { target = decodeURIComponent(target); } catch { /* Verify the literal malformed URI path as absent. */ }
    const absolute = path.isAbsolute(target) ? target : path.resolve(path.dirname(file), target);
    links.push({ target: match[1], absolute, exists: fs.existsSync(absolute), line: source.slice(0, match.index).split(/\r?\n/).length });
  }
  return { path: path.relative(root, file).replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), localLinks: links };
});
const missing = checks.flatMap(document => document.localLinks.filter(link => !link.exists).map(link => ({ document: document.path, ...link })));
const report = { phase: 'B2.5c-2b delivery artifact link audit', generatedUtc: new Date().toISOString(), documentCount: checks.length, localLinkCount: checks.reduce((sum, item) => sum + item.localLinks.length, 0), checks, missing, pass: missing.length === 0,
  limits: 'Checks explicit local Markdown links in top-level c-2b delivery documents at this snapshot. Plain code path mentions and future-stage candidates are not links and are not claimed to exist.' };
fs.writeFileSync(path.join(__dirname, outputName), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ pass: report.pass, documentCount: report.documentCount, localLinkCount: report.localLinkCount, missing }, null, 2)); process.exitCode = report.pass ? 0 : 1;
