'use strict';

const fs = require('fs');
const path = require('path');

const NAMEBOOK_REL = path.join('docs', 'NAMEBOOK-v4.0.md');
const TOTAL_A = 325;

// NAMEBOOK §1 的 section → 模块代号。
// 1.5 / 1.6 / 1.12 已由 stage-4.v1.1 §3.1 固定为 W / W / G，provisional 解除。
const SECTION_MODULES = {
  '1.1': { code: 'K', name: 'constants', provisional: false },
  '1.2': { code: 'L', name: 'ledger', provisional: false },
  '1.3': { code: 'T', name: 'trace', provisional: false },
  '1.4': { code: 'W', name: 'world', provisional: false },
  '1.5': { code: 'W', name: '视差框', provisional: false },
  '1.6': { code: 'W', name: '触发器', provisional: false },
  '1.7': { code: 'M', name: 'timeline', provisional: false },
  '1.8': { code: 'C', name: 'chart 与动态图层', provisional: false },
  '1.9': { code: 'C', name: '8 格网格', provisional: false },
  '1.10': { code: 'D', name: 'media', provisional: false },
  '1.11': { code: 'G', name: '事件蓝图', provisional: false },
  '1.12': { code: 'G', name: '事件树', provisional: false },
  '1.13': { code: 'E', name: 'editor', provisional: false },
  '1.14': { code: 'U', name: 'musicEditor', provisional: false },
  '1.15': { code: 'A', name: 'AI', provisional: false },
  '1.16': { code: 'S', name: 'studio', provisional: false },
  '1.17': { code: 'R', name: 'director', provisional: false },
  '1.18': { code: 'H', name: 'character', provisional: false },
  '1.19': { code: 'P', name: 'presentation', provisional: false },
  '1.21': { code: 'S', name: 'projecttree', provisional: false },
  '1.22': { code: 'P', name: 'interaction', provisional: false },
  '1.20': { code: 'X', name: 'app/adapters', provisional: false },
};

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function splitNames(cell) {
  return cell
    .split(/\s*\/\s*/)
    .map((part) => part.replace(/`/g, '').trim())
    .filter(Boolean);
}

function parseNamebook(text) {
  const lines = stripBom(text).split(/\r?\n/);
  const headingRe = /^###\s+1\.(\d+)\s+(.+?)（(\d+)）\s*$/u;
  const rowRe = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/u;

  const sections = [];
  const names = [];
  const byName = new Map();
  const duplicates = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // 顶层 section 结束（## §2 / ## §3 ...）；防止把 §7.3 版本记录误算进 1.20。
    if (/^##\s+§/.test(line)) {
      current = null;
      continue;
    }

    const heading = headingRe.exec(line);
    if (heading) {
      const key = '1.' + heading[1];
      const meta = SECTION_MODULES[key] || null;
      current = {
        key,
        title: heading[2].trim(),
        expected: Number(heading[3]),
        actual: 0,
        module: meta ? meta.code : null,
        moduleName: meta ? meta.name : null,
        provisional: meta ? meta.provisional : false,
      };
      sections.push(current);
      continue;
    }

    if (!current || !line.startsWith('|')) continue;
    if (/^\|\s*-{3,}/.test(line)) continue;

    const row = rowRe.exec(line);
    if (!row) continue;
    const first = row[1].trim();
    if (!first || first === '名称' || first === 'Name') continue;

    const status = row[2].trim();
    const semantics = row[3].trim();
    for (const name of splitNames(first)) {
      const record = {
        name,
        status,
        semantics,
        section: current.key,
        sectionTitle: current.title,
        module: current.module,
        provisional: current.provisional,
      };
      names.push(record);
      current.actual += 1;
      if (byName.has(name)) {
        duplicates.push({ name, first: byName.get(name), second: record });
      } else {
        byName.set(name, record);
      }
    }
  }

  const sectionStats = sections.map((section) => ({ ...section }));
  const countMismatches = sectionStats
    .filter((section) => section.actual !== section.expected)
    .map((section) => ({
      section: section.key,
      expected: section.expected,
      actual: section.actual,
    }));
  const unmappedSections = sectionStats
    .filter((section) => section.module === null)
    .map((section) => section.key);
  const provisionalNames = names
    .filter((record) => record.provisional)
    .map((record) => record.name);

  const byModule = {};
  for (const record of names) {
    const code = record.module || 'UNMAPPED';
    byModule[code] = (byModule[code] || 0) + 1;
  }

  return {
    sections: sectionStats,
    names,
    byName,
    byModule,
    duplicates,
    countMismatches,
    unmappedSections,
    provisionalNames,
    total: names.length,
    totalExpected: TOTAL_A,
  };
}

function loadNamebook(repoRoot) {
  const file = path.join(repoRoot, NAMEBOOK_REL);
  return {
    file,
    ...parseNamebook(fs.readFileSync(file, 'utf8')),
  };
}

module.exports = {
  NAMEBOOK_REL,
  TOTAL_A,
  SECTION_MODULES,
  parseNamebook,
  loadNamebook,
};