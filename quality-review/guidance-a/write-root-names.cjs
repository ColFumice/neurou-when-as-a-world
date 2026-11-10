const fs = require('fs');
const path = require('path');
const ts = require('../../node_modules/typescript');
const files = JSON.parse(fs.readFileSync(path.join(__dirname, 'files.json'), 'utf8')).changed;
const frozen = new Set(['GuidanceChart', 'GuidanceLine', 'GuidanceNode', 'HeadNode', 'TapNode',
  'DragNode', 'HoldNode', 'ChartNodeKind', 'NodePath', 'JudgmentPoint', 'LineEraseEffect',
  'resolveGridKeyAt', 'HEAD_WINDOW_MS']);
function collect(file, body) {
  const source = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true);
  const items = [];
  function visit(node) {
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      if (parent.name === node && (ts.isVariableDeclaration(parent) || ts.isParameter(parent) ||
          ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) ||
          ts.isMethodDeclaration(parent) || ts.isMethodSignature(parent) ||
          ts.isFunctionDeclaration(parent) || ts.isImportSpecifier(parent))) {
        items.push({ name: node.text, kind: ts.SyntaxKind[parent.kind], file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return items;
}
const items = [];
for (const file of files) {
  if (file.endsWith('ChartPadView.ts')) continue; // Separate complete presentation inventory.
  const previous = new Set(collect(file, fs.readFileSync(path.join(__dirname, 'baseline', file), 'utf8')).map(item => item.name));
  for (const item of collect(file, fs.readFileSync(file, 'utf8'))) {
    if (!previous.has(item.name)) items.push({ ...item,
      status: frozen.has(item.name) ? 'frozen_reuse'
        : item.name === 'SpriteFrame' ? 'cocos_api_reuse'
        : ['ended', 'unavailable'].includes(item.name) ? 'existing_media_vocabulary_reuse'
        : 'pending_protocol' });
  }
}
fs.writeFileSync(path.join(__dirname, 'integration-names.json'), JSON.stringify({
  method: 'AST declaration/import diff against exact reverse-restored pre-edit baseline; presentation and new logic files have separate full inventories',
  items,
  literalNames: ['Down', 'Up', 'GuidanceLoadError', 'guidance-a-1', 'line-a-1', 'head-a-1', 'tap-a-1'],
}, null, 2) + '\n');
console.log(`Integration naming inventory: ${items.length} declarations/imports.`);
