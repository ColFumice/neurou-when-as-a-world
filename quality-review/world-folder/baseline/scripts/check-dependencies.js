﻿/**
 * ============================================================
 * 阶段 1 依赖方向矩阵检查（T1 返工 / VERDICT-086 门禁）
 * ------------------------------------------------------------
 * 规则唯一真源：docs/spec/stage-1.md 第 6 节依赖方向矩阵
 * （行依赖列；EXECUTOR 只读该文档，本脚本不得另立规则）。
 *
 * 图例：✓ 允许　✗ 禁止　R 只能使用读取接口（仅类型导入）
 *       I 只能使用意图接口（仅类型导入，且不得携带写入能力名）
 *
 *   constants 是叶子，不依赖任何模块
 *   ledger 只依赖 constants，只引用 ID
 *   director 是逻辑层最上层，其他逻辑模块不能反过来依赖它
 *   presentation 只读：对逻辑模块只能使用读取接口
 *   意图接口（I）只接收“玩家想做什么”，不暴露写入能力
 *   只有 director 可以引用 LedgerAppend
 *
 * 检查项：
 *   E1 ✗ 矩阵禁止边            —— 行模块到列模块无 ✓/R/I 单元
 *   E2 R 边出现值导入          —— 读取面只允许 import type
 *   E3 I 边出现值导入          —— 意图面只允许 import type
 *   E4 I 边导入写入能力名      —— 标识符命中 Append/Write 等
 *   E5 LedgerAppend 越权引用   —— 仅 director 可引用（含仅类型）
 *   E6 引用未登记模块目录      —— src/ 下出现 §3 九模块之外目录
 *   E7 相对路径无法解析        —— 疑似引用已归档（boss/sync/service）
 *                                 或已改名（event → ledger）模块
 *   E8 逻辑模块引用引擎 cc     —— constants/ledger/world/character/
 *                                 trace/chart/editor/director 零 cc 依赖
 *                                 （HANDOFF-ROUND-12 规则一 /
 *                                 VERDICT-094 引擎隔离 / VERDICT-150
 *                                 editor 纯逻辑模块零 cc）
 *   E9 presentation 越权引用 director
 *                               —— 仅允许 PlayerIntent / IntentPort
 *                                 两个文件（HANDOFF-ROUND-12 规则二 /
 *                                 VERDICT-094 唯一窄路）
 *
 * R / I 的静态判定口径（PROTOCOL 验收轮第一部分第 5 条
 * 追认，作为阶段 1 正式实现层解释）：
 *   `import type` / `export type` 整句仅类型，编译后擦除，
 *   不携带任何运行时写入能力，视为符合“只读 / 只接收意图”；
 *   任何值导入（默认导入、命名空间导入、非 type 命名绑定、
 *   动态 import()）在 R / I 边上一律违规。
 *   I 边的正向“必须是意图接口”尚无承载文件（意图接口待
 *   ARCHITECT 指定），当前只做负向检查：不暴露写入能力。
 *
 * 用法：
 *   node scripts/check-dependencies.js             # 扫描九模块
 *   node scripts/check-dependencies.js --verbose   # 同时列出合法边
 *
 * 零依赖、纯 Node（Windows / macOS 通用）。
 * ============================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------
// 板块一：阶段 1 模块登记与依赖方向矩阵（stage-1.md §3 / §6）
// ------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');

/** src/ 下的八个模块（constants 位于工程根 constants/） */
const SRC_MODULES = [
  'ledger',
  'world',
  'character',
  'trace',
  'chart',
  'editor',
  'director',
  'presentation',
];

/** 全部九个模块（矩阵行 / 列顺序） */
const ALL_MODULES = ['constants', ...SRC_MODULES];

/**
 * 矩阵单元：
 *   A 允许全部依赖形式；R 仅类型（读取面）；I 仅类型（意图面）。
 * 缺省（未列出的单元）即 stage-1.md §6 的 ✗。
 */
const MATRIX = {
  constants: {},
  ledger: { constants: 'A' },
  world: { constants: 'A' },
  character: { constants: 'A', world: 'A' },
  trace: { constants: 'A', world: 'A', character: 'R' },
  chart: { constants: 'A' },
  // VERDICT-150：editor 纯逻辑模块，仅值依赖 constants / chart
  editor: { constants: 'A', chart: 'A' },
  director: {
    constants: 'A',
    ledger: 'A',
    world: 'A',
    character: 'A',
    trace: 'A',
    chart: 'A',
  },
  presentation: {
    constants: 'A',
    ledger: 'R',
    world: 'R',
    character: 'R',
    trace: 'R',
    chart: 'R',
    // VERDICT-150：R + 编辑意图，GuidanceEditorReader /
    // GuidanceEditorIntent / GuidanceEditorPort 仅 import type；
    // 类型擦除后无值依赖，I 单元的 E4 同时拦截写入能力名
    editor: 'I',
    director: 'I',
  },
};

/** I 边禁止出现的写入能力标识符后缀（大小写不敏感） */
const WRITE_CAPABILITY_TOKENS = [
  'append',
  'write',
  'delete',
  'remove',
  'mutate',
  'update',
];

/** 唯一可引用追加接口的模块（INV-2 / AC-24） */
const APPEND_ONLY_MODULE = 'director';
const APPEND_FILE_NAME = 'LedgerAppend';

/**
 * E8：禁止引用引擎模块 cc 的逻辑模块
 * （constants + src 七个逻辑目录，含 editor；presentation 豁免）。
 */
const LOGIC_MODULES_NO_CC = [
  'constants',
  'ledger',
  'world',
  'character',
  'trace',
  'chart',
  'editor',
  'director',
];

/** E9：presentation 引用 director 时允许的目标文件 basename */
const PRESENTATION_DIRECTOR_ALLOWED_FILES = ['PlayerIntent', 'IntentPort'];

// ------------------------------------------------------------
// 板块二：文件收集与模块归属
// ------------------------------------------------------------

/** 模块名 → 绝对目录 */
function moduleDir(moduleName) {
  if (moduleName === 'constants') {
    return path.join(PROJECT_ROOT, 'constants');
  }
  return path.join(PROJECT_ROOT, 'src', moduleName);
}

/** 递归收集 .ts 文件 */
function collectTsFiles(rootDir) {
  const result = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      return; // 目录不存在则跳过
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (path.extname(entry.name) === '.ts') {
        result.push(full);
      }
    }
  };
  walk(rootDir);
  return result;
}

/**
 * 判定一个绝对路径归属哪个登记模块。
 * @returns {{kind: 'module', module: string} |
 *           {kind: 'unregistered-src', dir: string} |
 *           {kind: 'outside'}}
 */
function locate(absPath) {
  const constantsPrefix = moduleDir('constants') + path.sep;
  if (absPath.startsWith(constantsPrefix)) {
    return { kind: 'module', module: 'constants' };
  }
  const srcRoot = path.join(PROJECT_ROOT, 'src') + path.sep;
  if (absPath.startsWith(srcRoot)) {
    const rest = absPath.slice(srcRoot.length);
    const head = rest.split(path.sep)[0];
    if (SRC_MODULES.includes(head)) {
      return { kind: 'module', module: head };
    }
    return { kind: 'unregistered-src', dir: head };
  }
  return { kind: 'outside' };
}

/** 把无扩展名相对路径解析为实际 .ts 文件（支持 index.ts） */
function resolveTsFile(targetAbs) {
  const candidates = [
    targetAbs + '.ts',
    targetAbs + '.tsx',
    path.join(targetAbs, 'index.ts'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

// ------------------------------------------------------------
// 板块三：导入语句解析
// ------------------------------------------------------------

/** 粗剥离注释（保留字符串内的 import 场景在本工程不存在） */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (line) => line.replace(/[^\n]/g, ' '));
}

/**
 * 从文件文本提取全部依赖子句。
 * @returns {Array<{
 *   specifier: string,
 *   typeOnly: boolean,
 *   valueBindings: string[],
 *   dynamic: boolean,
 *   line: number
 * }>}
 */
function parseImports(text) {
  const imports = [];

  // 静态 import / export ... from '...'（允许跨多行的 { a, b }）
  const staticPattern =
    /(?:^|\s)(import|export)\s+(type\s+)?([\w\s,{}*$]+?)\s+from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = staticPattern.exec(text)) !== null) {
    const statementTypeOnly = match[2] === 'type ';
    const clause = match[3];
    const specifier = match[4];
    const line = text.slice(0, match.index).split(/\r?\n/).length;

    const allBindings = extractAllBindings(clause);
    const valueBindings = statementTypeOnly
      ? []
      : extractValueBindings(clause);

    imports.push({
      specifier,
      typeOnly: statementTypeOnly,
      allBindings,
      valueBindings,
      dynamic: false,
      line,
    });
  }

  // 动态 import('...')（携带运行时依赖）
  const dynamicPattern = /[^.\w]import\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = dynamicPattern.exec(text)) !== null) {
    const line = text.slice(0, match.index).split(/\r?\n/).length;
    imports.push({
      specifier: match[1],
      typeOnly: false,
      allBindings: ['*dynamic-import*'],
      valueBindings: ['*dynamic-import*'],
      dynamic: true,
      line,
    });
  }

  return imports;
}

/**
 * 解析绑定子句中的全部绑定名称（不区分 type 前缀），
 * 供 I 边写入能力名扫描（E4）使用。
 */
function extractAllBindings(clause) {
  const trimmed = clause.trim();
  const braceMatch = trimmed.match(/\{([\s\S]*)\}/);
  if (braceMatch) {
    return braceMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => part.replace(/^type\s+/, ''))
      .map((part) => part.split(/\s+as\s+/)[0].trim());
  }
  if (trimmed.length > 0) {
    return [trimmed.replace(/\*/g, '').replace(/\bas\b/g, '').trim()].filter(
      (name) => name.length > 0,
    );
  }
  return [];
}

/**
 * 解析绑定子句中的“值绑定”名称：
 * - 默认导入 / 命名空间导入整体是值依赖；
 * - 命名绑定中逐个剔除 `type X` 形式的仅类型绑定。
 */
function extractValueBindings(clause) {
  const trimmed = clause.trim();

  // import { a, type B, c } 形式
  const braceMatch = trimmed.match(/\{([\s\S]*)\}/);
  if (braceMatch) {
    return braceMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .filter((part) => !/^type\s+/.test(part)) // 仅类型绑定剔除
      .map((part) => part.split(/\s+as\s+/)[0].trim()); // 取原名
  }

  // import defaultName / import * as ns 形式
  if (trimmed.length > 0) {
    return [trimmed.replace(/\*/g, '').replace(/\bas\b/g, '').trim()].filter(
      (name) => name.length > 0,
    );
  }

  return [];
}

// ------------------------------------------------------------
// 板块四：逐边规则判定
// ------------------------------------------------------------

/** I 边绑定名是否携带写入能力 */
function hasWriteCapability(bindingNames) {
  return bindingNames.filter((name) =>
    WRITE_CAPABILITY_TOKENS.some((token) =>
      name.toLowerCase().endsWith(token),
    ),
  );
}

/**
 * E8：在已剥离注释的文本中扫描对引擎模块 cc 的引用。
 * 覆盖三种形态：静态 import/export ... from 'cc'（含 cc/ 子路径）、
 * 动态 import('cc')、CommonJS require('cc')。
 * @returns {Array<{line: number, kind: string}>}
 */
function findEngineCcReferences(text) {
  const refs = [];
  const patterns = [
    {
      kind: "静态 import/export ... from 'cc'",
      regex:
        /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?[\w\s,{}*$]+?\s+from\s*['"]cc(?:\/[^'"]*)?['"]/g,
    },
    {
      kind: "动态 import('cc')",
      regex: /[^.\w]import\s*\(\s*['"]cc(?:\/[^'"]*)?['"]\s*\)/g,
    },
    {
      kind: "require('cc')",
      regex: /\brequire\s*\(\s*['"]cc(?:\/[^'"]*)?['"]\s*\)/g,
    },
  ];
  for (const item of patterns) {
    let match;
    while ((match = item.regex.exec(text)) !== null) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      refs.push({ line, kind: item.kind });
    }
  }
  return refs;
}

/**
 * 校验单个文件的全部出边。
 * @returns {Array<{code: string, line: number, message: string}>}
 */
function checkFile(fileAbs, ownerModule, verboseEdges) {
  const errors = [];
  const rawText = fs.readFileSync(fileAbs, 'utf8');
  const text = stripComments(rawText);
  const imports = parseImports(text);
  const fileRel = path.relative(PROJECT_ROOT, fileAbs);

  // E8：逻辑八模块零 cc 依赖（presentation 豁免；注释已剥离）
  if (LOGIC_MODULES_NO_CC.includes(ownerModule)) {
    for (const ref of findEngineCcReferences(text)) {
      errors.push({
        code: 'E8',
        line: ref.line,
        message:
          fileRel + ':' + ref.line + '：逻辑模块 ' + ownerModule +
          ' 引用引擎模块 cc（' + ref.kind +
          '）；逻辑层必须零 cc 依赖（HANDOFF-ROUND-12 规则一 / ' +
          'VERDICT-094 引擎隔离），引擎交互只能留在 presentation',
      });
    }
  }

  for (const dep of imports) {
    // 裸模块说明符（'cc' / node 内置 / npm 包）：阶段 1 不接外部
    // 服务；当前不阻断，仅在 verbose 中统计，避免误伤引擎内置。
    if (!dep.specifier.startsWith('.')) {
      if (verboseEdges) {
        console.log(
          '  [bare] ' + fileRel + ':' + dep.line +
            ' → ' + dep.specifier,
        );
      }
      continue;
    }

    const targetAbs = path.resolve(path.dirname(fileAbs), dep.specifier);
    const resolvedFile = resolveTsFile(targetAbs);
    if (!resolvedFile) {
      errors.push({
        code: 'E7',
        line: dep.line,
        message:
          fileRel + ' → ' + dep.specifier +
          '：相对路径无法解析（疑似引用已归档的 boss/sync/service ' +
          '或已改名的 event 模块；阶段 1 模块见 stage-1.md §3）',
      });
      continue;
    }

    const located = locate(resolvedFile);
    if (located.kind === 'unregistered-src') {
      errors.push({
        code: 'E6',
        line: dep.line,
        message:
          fileRel + ' → ' + dep.specifier +
          '：引用未登记模块目录 src/' + located.dir +
          '（stage-1.md §3 仅九个模块）',
      });
      continue;
    }
    if (located.kind === 'outside') {
      errors.push({
        code: 'E1',
        line: dep.line,
        message:
          fileRel + ' → ' + dep.specifier +
          '：依赖越出阶段 1 模块树（矩阵无此单元，✗ 禁止）',
      });
      continue;
    }

    const targetModule = located.module;

    // 模块内部互引不进矩阵
    if (targetModule === ownerModule) {
      if (verboseEdges) {
        console.log(
          '  [self] ' + fileRel + ':' + dep.line +
            ' → (' + targetModule + ') ' + dep.specifier,
        );
      }
      continue;
    }

    const targetBase = path.basename(
      resolvedFile,
      path.extname(resolvedFile),
    );

    // E9：presentation → director 唯一窄路，
    // 只允许引用 PlayerIntent / IntentPort 两个文件
    if (
      ownerModule === 'presentation' &&
      targetModule === 'director' &&
      !PRESENTATION_DIRECTOR_ALLOWED_FILES.includes(targetBase)
    ) {
      errors.push({
        code: 'E9',
        line: dep.line,
        message:
          fileRel + ':' + dep.line +
          '：presentation 越权引用 director/' + targetBase +
          '（来自 ' + dep.specifier + '）；presentation 通往 ' +
          'director 的唯一窄路只允许 ' +
          PRESENTATION_DIRECTOR_ALLOWED_FILES.join(' / ') +
          '（HANDOFF-ROUND-12 规则二 / VERDICT-094）',
      });
    }

    const cell = (MATRIX[ownerModule] || {})[targetModule];

    // E1：矩阵 ✗ 禁止边
    if (cell !== 'A' && cell !== 'R' && cell !== 'I') {
      errors.push({
        code: 'E1',
        line: dep.line,
        message:
          fileRel + ':' + dep.line + '：禁止依赖边 ' +
          ownerModule + ' → ' + targetModule +
          '（stage-1.md §6 矩阵单元为 ✗；来自 ' + dep.specifier + '）',
      });
      continue;
    }

    const isValueEdge =
      !dep.typeOnly && (dep.dynamic || dep.valueBindings.length > 0);

    // E2：R 边的值导入
    if (cell === 'R' && isValueEdge) {
      errors.push({
        code: 'E2',
        line: dep.line,
        message:
          fileRel + ':' + dep.line + '：R 读取边 ' + ownerModule +
          ' → ' + targetModule + ' 出现值导入（' +
          dep.valueBindings.join(', ') +
          '）；表现层 / 读取面只允许 import type',
      });
    }

    // E3：I 边的值导入
    if (cell === 'I' && isValueEdge) {
      errors.push({
        code: 'E3',
        line: dep.line,
        message:
          fileRel + ':' + dep.line + '：I 意图边 ' + ownerModule +
          ' → ' + targetModule + ' 出现值导入（' +
          dep.valueBindings.join(', ') + '）；意图面只允许 import type',
      });
    }

    // E4：I 边不得携带写入能力名（即使仅类型导入也扫描）
    if (cell === 'I') {
      const writeNames = hasWriteCapability(dep.allBindings);
      if (writeNames.length > 0) {
        errors.push({
          code: 'E4',
          line: dep.line,
          message:
            fileRel + ':' + dep.line + '：I 意图边 ' + ownerModule +
              ' → ' + targetModule + ' 暴露写入能力名（' +
              writeNames.join(', ') +
              '）；意图接口只接收“玩家想做什么”',
        });
      }
    }

    // E5：LedgerAppend 仅 director 可引用（即使仅类型导入）
    if (targetBase === APPEND_FILE_NAME && ownerModule !== APPEND_ONLY_MODULE) {
      errors.push({
        code: 'E5',
        line: dep.line,
        message:
          fileRel + ':' + dep.line + '：' + APPEND_FILE_NAME +
          ' 只允许 ' + APPEND_ONLY_MODULE +
          ' 引用（INV-2 / AC-24），当前引用方为 ' + ownerModule,
      });
    }

    if (verboseEdges && !errors.some((item) => item.line === dep.line)) {
      console.log(
        '  [ ' + cell + '  ] ' + fileRel + ':' + dep.line +
          ' → (' + targetModule + ') ' + dep.specifier,
      );
    }
  }

  return errors;
}

// ------------------------------------------------------------
// 板块五：结构检查（§3 九模块目录）
// ------------------------------------------------------------

function checkRegisteredDirectories() {
  const errors = [];
  const srcDir = path.join(PROJECT_ROOT, 'src');
  let entries = [];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch (error) {
    errors.push({
      code: 'E6',
      line: 0,
      message: 'src/ 目录不存在，阶段 1 模块树缺失',
    });
    return errors;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    if (!SRC_MODULES.includes(entry.name)) {
      errors.push({
        code: 'E6',
        line: 0,
        message:
          'src/' + entry.name +
          '：未登记模块目录（stage-1.md §3 仅 ' +
          ALL_MODULES.join(' / ') + ' 九个模块；' +
          'boss/sync/service 已归档，event 已改名 ledger）',
      });
    }
  }

  if (!fs.existsSync(moduleDir('constants'))) {
    errors.push({
      code: 'E6',
      line: 0,
      message: 'constants/ 目录不存在（阶段 1 共享词汇叶子模块）',
    });
  }

  return errors;
}

// ------------------------------------------------------------
// 板块六：入口与报告
// ------------------------------------------------------------

function main() {
  const verbose = process.argv.includes('--verbose');

  console.log('== 阶段 1 依赖方向矩阵检查（stage-1.md §6 / VERDICT-086）==');
  console.log('模块: ' + ALL_MODULES.join(' / '));

  const structuralErrors = checkRegisteredDirectories();
  let edgeCount = 0;
  let fileCount = 0;
  const edgeErrors = [];

  for (const moduleName of ALL_MODULES) {
    const files = collectTsFiles(moduleDir(moduleName));
    fileCount += files.length;
    for (const file of files) {
      const errors = checkFile(file, moduleName, verbose);
      edgeErrors.push(...errors);
      edgeCount += countImportClauses(file);
    }
  }

  const allErrors = [...structuralErrors, ...edgeErrors];

  for (const error of allErrors) {
    const where = error.line > 0 ? ':' + error.line : '';
    console.log('ERROR [' + error.code + '] ' + error.message);
  }

  console.log('------------------------------------------------------------');
  console.log(
    '扫描: ' + fileCount + ' 个 .ts 文件，约 ' +
      edgeCount + ' 条静态依赖子句',
  );
  console.log('汇总: ' + allErrors.length + ' ERROR');

  if (allErrors.length > 0) {
    console.log('结论: 依赖方向矩阵存在违规，提交阻断。请修正后重跑。');
    process.exit(1);
  }
  console.log('结论: 全部依赖边符合 stage-1.md §6 矩阵。');
}

/** 统计文件内静态 / 动态依赖子句数（摘要用） */
function countImportClauses(fileAbs) {
  const text = stripComments(fs.readFileSync(fileAbs, 'utf8'));
  const staticCount = (text.match(
    /(?:^|\s)(?:import|export)\s+(?:type\s+)?[\w\s,{}*$]+?\s+from\s*['"]/g,
  ) || []).length;
  const dynamicCount = (text.match(/[^.\w]import\s*\(\s*['"]/g) || []).length;
  return staticCount + dynamicCount;
}

main();
