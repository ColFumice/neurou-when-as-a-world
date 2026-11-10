'use strict';

const fs = require('fs');
const path = require('path');

const STAGE4_REL = path.join('docs', 'spec', 'stage-4.md');

const MODULE_CODES = ['K', 'L', 'T', 'W', 'M', 'C', 'G', 'D', 'A', 'S', 'E', 'U', 'H', 'R', 'P', 'X'];

const MODULE_NAMES = {
  K: 'constants',
  L: 'ledger',
  T: 'trace',
  W: 'world',
  M: 'timeline',
  C: 'chart',
  G: 'eventgraph',
  D: 'media',
  A: 'ai',
  S: 'studio',
  E: 'editor',
  U: 'musicEditor',
  H: 'character',
  R: 'director',
  P: 'presentation',
  X: 'app',
};

const MODULE_BY_DIR = {
  constants: 'K',
  ledger: 'L',
  trace: 'T',
  world: 'W',
  timeline: 'M',
  chart: 'C',
  eventgraph: 'G',
  media: 'D',
  ai: 'A',
  studio: 'S',
  editor: 'E',
  musicEditor: 'U',
  character: 'H',
  director: 'R',
  presentation: 'P',
};

const LOGIC_CODES = new Set(['K', 'L', 'T', 'W', 'M', 'C', 'G', 'D', 'A', 'S', 'E', 'U', 'H', 'R']);
const MODULE_CODE_SET = new Set(MODULE_CODES);

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeRel(relPath) {
  return String(relPath).replace(/\\/g, '/').replace(/^\.?\//, '');
}

function pathToModule(relPath) {
  const parts = normalizeRel(relPath).split('/');
  if (parts[0] === 'v4' && parts[1] === 'core' && parts[2] && MODULE_BY_DIR[parts[2]]) {
    return MODULE_BY_DIR[parts[2]];
  }
  if (parts[0] === 'v4' && (parts[1] === 'adapters' || parts[1] === 'app')) {
    return 'X';
  }
  return null;
}

function parseCell(cell) {
  const text = String(cell).trim();
  if (!text || text === '—' || text === '-' || text === '–') return [];
  if (text.includes('全部逻辑模块')) return ['ALL_LOGIC'];
  if (text.includes('全部')) return ['ALL'];

  const result = [];
  for (let token of text.split(/[、,，]/)) {
    token = token.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
    if (!token) continue;
    const code = token[0];
    if (MODULE_CODE_SET.has(code)) result.push(code);
  }
  return [...new Set(result)];
}

function parseDependencyMatrix(text) {
  const lines = stripBom(text).split(/\r?\n/);
  const matrix = {};
  let inSection = false;
  let headerSeen = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (/^##\s+§?5\s+依赖矩阵/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection || !line.startsWith('|')) continue;
    if (/^\|\s*-{3,}/.test(line)) continue;

    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 3) continue;
    if (cells[0] === '模块') {
      headerSeen = true;
      continue;
    }
    if (!headerSeen) continue;

    const code = cells[0];
    if (!MODULE_CODE_SET.has(code)) continue;
    matrix[code] = {
      value: parseCell(cells[1]),
      typeOnly: parseCell(cells[2]),
      raw: { value: cells[1], typeOnly: cells[2] },
    };
  }

  return matrix;
}

function allowedEdge(matrix, from, to, typeOnly = false) {
  if (!from || !to) return false;
  if (from === to) return true;
  if (from === 'X') return true;

  const entry = matrix[from];
  if (!entry) return false;
  const list = typeOnly ? entry.typeOnly : entry.value;
  if (list.includes('ALL')) return true;
  if (list.includes(to)) return true;
  if (list.includes('ALL_LOGIC') && LOGIC_CODES.has(to)) return true;
  return false;
}

function loadDependencyMatrix(repoRoot) {
  const file = path.join(repoRoot, STAGE4_REL);
  const matrix = parseDependencyMatrix(fs.readFileSync(file, 'utf8'));
  const missing = MODULE_CODES.filter((code) => !matrix[code]);
  if (missing.length > 0) {
    throw new Error('stage-4 §5 依赖矩阵缺少模块行: ' + missing.join(', '));
  }
  return { file, matrix };
}

module.exports = {
  STAGE4_REL,
  MODULE_CODES,
  MODULE_NAMES,
  MODULE_BY_DIR,
  LOGIC_CODES,
  pathToModule,
  parseCell,
  parseDependencyMatrix,
  allowedEdge,
  loadDependencyMatrix,
};