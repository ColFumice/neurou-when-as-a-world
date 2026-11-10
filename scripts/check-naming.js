﻿﻿﻿﻿﻿/**
 * ============================================================
 * INV-8 命名合规检查（HANDOFF-ROUND-11 / T1 提交前门禁）
 * ------------------------------------------------------------
 * 扫描 src/ 与 constants/ 下的 TypeScript 标识符，检测
 * 名库保留字 / INV-8 禁止命名：
 *
 * ERROR 级（确定性违规，进程退出码 1，提交必须阻断）：
 *   R1 单独使用 Event      —— 禁止以单字 Event 命名类型/变量
 *                             （名库：代码中禁用单字“事件”；
 *                              合法事件名须用 NarrativeEvent 等）
 *   R2 单独使用 Developer  —— 禁止以单字 Developer 命名
 *                             （合法：WorldDeveloper /
 *                              StudioDeveloper / CoDeveloper）
 *   R3 单独使用 Rain       —— 禁止以单字 Rain 命名
 *                             （合法：RainMode / RainTrace 等；
 *                              唯一例外：TraceTier.Rain 枚举值，
 *                              以文件级白名单精确豁免）
 *
 * WARN 级（语义启发式，不阻断但必须人工复核）：
 *   R4 含 Trace 且不在痕域白名单 —— 疑似把 Trace 当“日志”
 *                             （保留字：日志必须用 Log）
 *   R5 含 Highlight 且不在白名单 —— 疑似把 Highlight 当“选中”
 *                             （UI 选中必须用 Focus / Selection；
 *                              Highlight 仅为 ElementType 冻结值）
 *   R6 含 Process 且不在白名单 —— 疑似把 Process 当“运行实例”
 *                             （运行实例必须用 Runtime / Session；
 *                              合法：ElementType.Process 与
 *                              后处理 Post-Process 家族）
 *   R7 含 Window 且不在白名单 —— 疑似把 Window 当“界面窗口”
 *                             （Window 只指时间窗口；
 *                              界面窗口必须用 Panel / View）
 *
 * 用法：
 *   node scripts/check-naming.js              # 扫描仓库
 *   node scripts/check-naming.js --selftest   # 内置正反样例自测
 *
 * 设计说明：
 * - 零依赖、纯 Node 可运行（Windows / macOS 通用）；
 * - 检测前剥离注释与字符串字面量，避免文案误报；
 * - 白名单逐条对应名库 v1.2 冻结名，新增合法命名时
 *   必须同步在本文件登记依据，禁止随手放宽。
 * ============================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------
// 板块一：检查配置（白名单依据：名库 v1.2）
// ------------------------------------------------------------

/** 扫描根目录（相对工程根） */
const SCAN_DIRS = ['src', 'constants', 'assets/scripts'];

/** 仅扫描 TypeScript 文件 */
const SCAN_EXTENSIONS = new Set(['.ts']);

/** R1~R3：精确单词禁用（标识符逐字相等即违规） */
const EXACT_FORBIDDEN = new Set(['Event', 'Developer', 'Rain']);

/**
 * R3 文件级精确豁免：
 * TraceTier 枚举值 Common / Deep / Rain 为名库逐字冻结，
 * 仅在其定义文件内允许单字 Rain 出现。
 * 键为相对工程根的路径片段（path 分隔符适配跨平台）。
 */
const FILE_SPECIFIC_EXACT_ALLOW = {
  [path.join('src', 'trace', 'TraceTier.ts')]: new Set(['Rain']),
};

/**
 * R4 Trace 家族白名单（大小写不敏感）
 * 依据：名库 v1.2 痕域全部冻结名 + 痕类型的实例形参名 trace
 * （ROUND-11 追认：形参为 Trace 实例，属痕语义，非日志）。
 */
const TRACE_FAMILY_ALLOW = new Set([
  'trace',
  'tracetier',
  'traceorigin',
  'deeptrace',
  'raintrace',
  'echotrace',
  'tracetouch',
  'raintracetint',
  // ROUND-11 追认：MomentInfo / Ledger 四字段之一 relatedTraces
  'relatedtraces',
  // VERDICT-086 / T1 返工：constants.TraceId（账本只引用痕的
  // ID，禁止 ledger → trace）；已经 PROTOCOL 验收轮第一部分
  // 第 1 条正式追认
  'traceid',
  // 依据 PROTOCOL v3.10 裁定：痕（Trace）来源事件绑定记录，
  // 与既有 DeepTrace / Trace 词族一致
  'tracebindings',
  't6traceid',
  'bindt6trace',
]);

/**
 * R5 Highlight 家族白名单（大小写敏感，子串包含判定）
 * 依据：ElementType 冻结值 Highlight（实体语义，非 UI 选中）。
 */
const HIGHLIGHT_FAMILY_ALLOW = new Set(['Highlight']);

/**
 * R6 Process 家族白名单（大小写敏感，子串包含判定）
 * 依据：ElementType 冻结值 Process；后处理（Post-Process）族
 * 冻结名 / ROUND-11 追认名。
 */
const PROCESS_FAMILY_ALLOW = new Set([
  'Process',
  'ProcessingStage',
  'ProcessedMomentImage',
  'applyPostProcess',
  'MomentCapturePostProcess',
]);

/**
 * R7 Window 家族白名单（大小写敏感，子串包含判定）
 * 依据：名库 v1.2 全部时间窗口冻结名
 * （Window 保留字只允许用于时间窗口）。
 */
const WINDOW_FAMILY_ALLOW = new Set([
  'LedgerWindow',
  'ScalingWindow',
  'EmotionWindow',
  'EmotionWindowSum', // 名库感绪域逐字冻结名
  'emotionWindowSum', // 其小驼峰字段形参（冻结类型衍生）
  'StarWindow',
  'EndingWindow',
  'isWithinWindow', // EndingWindow 的时间窗口判定私有方法（语义为时间窗口）
  // ROUND-12 / VERDICT-088：节奏判定时间窗口（毫秒），
  // Window 保留字的合法时间窗口语义
  'PERFECT_WINDOW_MS',
  'GOOD_WINDOW_MS',
]);

const RULE_DESCRIPTIONS = {
  R1: "禁止单独使用 'Event'（事件须用 NarrativeEvent 等完整冻结名）",
  R2: "禁止单独使用 'Developer'（须用 WorldDeveloper / StudioDeveloper / CoDeveloper）",
  R3: "禁止单独使用 'Rain'（须用 RainMode / RainTrace 等；TraceTier.Rain 仅枚举定义处豁免）",
  R4: "含 Trace 的命名疑似用作日志（日志必须用 Log；若非痕域语义请改名）",
  R5: "含 Highlight 的命名疑似用作 UI 选中（选中必须用 Focus / Selection）",
  R6: "含 Process 的命名疑似用作运行实例（运行实例必须用 Runtime / Session）",
  R7: "含 Window 的命名疑似用作界面窗口（界面窗口必须用 Panel / View）",
};

// ------------------------------------------------------------
// 板块二：词法剥离与规则引擎
// ------------------------------------------------------------

/**
 * 剥离单行中的注释与字符串（保留行号，列位置以空格替代）
 * @param {string} line 原始行
 * @param {{block: boolean}} state 跨行块注释状态
 * @returns {string} 仅保留代码字符的行
 */
function stripLine(line, state) {
  let out = '';
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (state.block) {
      if (ch === '*' && next === '/') {
        state.block = false;
        out += '  ';
        i += 1;
      } else {
        out += ' ';
      }
      continue;
    }

    if (quote) {
      if (ch === '\\') {
        out += '  ';
        i += 1;
      } else if (ch === quote) {
        quote = null;
        out += ' ';
      } else {
        out += ' ';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      break; // 行注释：剩余内容全部丢弃
    }
    if (ch === '/' && next === '*') {
      state.block = true;
      out += '  ';
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * 对单段源码文本执行全部规则
 * @param {string} text 源码全文
 * @param {string} [fileKey] 相对工程根路径（文件级豁免用）
 * @returns {{errors: Array, warnings: Array}}
 */
function scanText(text, fileKey) {
  const errors = [];
  const warnings = [];
  const warnedTokens = new Set(); // 同文件同 token 的 warn 只报首次
  const state = { block: false };
  const fileAllow = (fileKey && FILE_SPECIFIC_EXACT_ALLOW[fileKey]) || new Set();
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = stripLine(rawLine, state);
    const lineNumber = index + 1;
    const tokenPattern = /[A-Za-z_$][A-Za-z0-9_$]*/g;
    let match;

    while ((match = tokenPattern.exec(line)) !== null) {
      const token = match[0];
      // 成员访问豁免：形如 X.Event / X.Developer / TraceTier.Rain
      // 的引用属合法成员引用（含冻结枚举值点访问），
      // 裸声明 / 裸类型使用才是 R1~R3 的禁止场景。
      const isMemberAccess = match.index > 0 && line[match.index - 1] === '.';

      // R1~R3：精确单词
      if (EXACT_FORBIDDEN.has(token) && !fileAllow.has(token) && !isMemberAccess) {
        const rule = token === 'Event' ? 'R1' : token === 'Developer' ? 'R2' : 'R3';
        errors.push({ line: lineNumber, token, rule });
      }

      // R4：Trace 家族（大小写不敏感）
      if (token.toLowerCase().includes('trace') &&
          !TRACE_FAMILY_ALLOW.has(token.toLowerCase()) &&
          !warnedTokens.has('R4:' + token)) {
        warnedTokens.add('R4:' + token);
        warnings.push({ line: lineNumber, token, rule: 'R4' });
      }

      // R5：Highlight 家族
      if (token.includes('Highlight') &&
          !HIGHLIGHT_FAMILY_ALLOW.has(token) &&
          !warnedTokens.has('R5:' + token)) {
        warnedTokens.add('R5:' + token);
        warnings.push({ line: lineNumber, token, rule: 'R5' });
      }

      // R6：Process 家族
      if (token.includes('Process') &&
          !PROCESS_FAMILY_ALLOW.has(token) &&
          !warnedTokens.has('R6:' + token)) {
        warnedTokens.add('R6:' + token);
        warnings.push({ line: lineNumber, token, rule: 'R6' });
      }

      // R7：Window 家族
      if (token.includes('Window') &&
          !WINDOW_FAMILY_ALLOW.has(token) &&
          !warnedTokens.has('R7:' + token)) {
        warnedTokens.add('R7:' + token);
        warnings.push({ line: lineNumber, token, rule: 'R7' });
      }
    }
  });

  return { errors, warnings };
}

// ------------------------------------------------------------
// 板块三：仓库递归扫描
// ------------------------------------------------------------

/** 递归收集目标目录下全部待扫描文件（相对路径） */
function collectFiles(rootDir) {
  const result = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      return; // 目录不存在则跳过
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
        result.push(full);
      }
    }
  };
  walk(rootDir);
  return result;
}

/** 扫描工程根目录，返回逐文件结果与汇总 */
function scanRepository(projectRoot) {
  const reports = [];
  for (const dir of SCAN_DIRS) {
    const absoluteDir = path.join(projectRoot, dir);
    for (const file of collectFiles(absoluteDir)) {
      const text = fs.readFileSync(file, 'utf8');
      const fileKey = path.relative(projectRoot, file).split(path.sep).join(path.sep);
      const { errors, warnings } = scanText(text, fileKey);
      if (errors.length > 0 || warnings.length > 0) {
        reports.push({ file: fileKey, errors, warnings });
      }
    }
  }
  return reports;
}

// ------------------------------------------------------------
// 板块四：自测（正反样例，保证门禁自身可信）
// ------------------------------------------------------------

/** @returns {boolean} 自测是否全部通过 */
function runSelfTest() {
  // 合法样例：{ code, fileKey }；fileKey=null 表示任意文件
  const legalSamples = [
    { code: 'const x: NarrativeEvent = liveWorldEvent;', fileKey: null },
    { code: 'enum TraceTier { Common, Deep, Rain }',
      fileKey: path.join('src', 'trace', 'TraceTier.ts') },
    { code: 'const tier = TraceTier.Rain;', fileKey: null }, // 枚举成员点访问豁免
    { code: 'class ProcessingStage {} const img: ProcessedMomentImage = applyPostProcess();', fileKey: null },
    { code: 'const w: ScalingWindow; class EndingWindow {}', fileKey: null },
    { code: 'const trace: Trace = new EchoTrace(TraceOrigin.Echo);', fileKey: null },
    { code: 'type P = ElementType.Process; type H = ElementType.Highlight;', fileKey: null },
    { code: 'const PERFECT_WINDOW_MS = 50; const GOOD_WINDOW_MS = 120;', fileKey: null },
  ];
  const illegalSamples = [
    { code: 'class Event {}', expectRule: 'R1' },
    { code: 'interface Developer {}', expectRule: 'R2' },
    { code: "const Rain = 'x';", expectRule: 'R3' },
    { code: 'const requestTrace = createLogger();', expectRule: 'R4' },
    { code: 'let buttonHighlight: number;', expectRule: 'R5' },
    { code: 'class GameProcess {}', expectRule: 'R6' },
    { code: 'class MainWindow {}', expectRule: 'R7' },
  ];

  let passed = true;

  legalSamples.forEach((sample, index) => {
    const { errors, warnings } = scanText(sample.code, sample.fileKey);
    if (errors.length !== 0 || warnings.length !== 0) {
      passed = false;
      console.log('[selftest FAIL] 合法样例 ' + index + ' 被误报: ' + sample.code);
      console.log(JSON.stringify({ errors, warnings }));
    }
  });

  illegalSamples.forEach((sample) => {
    const { errors, warnings } = scanText(sample.code, null);
    const hit =
      errors.some((item) => item.rule === sample.expectRule) ||
      warnings.some((item) => item.rule === sample.expectRule);
    if (!hit) {
      passed = false;
      console.log('[selftest FAIL] 违规样例未被规则 ' + sample.expectRule + ' 捕获: ' + sample.code);
    }
  });

  if (passed) {
    console.log('[selftest PASS] 8 条合法样例零误报，7 条违规样例全部捕获');
  }
  return passed;
}

// ------------------------------------------------------------
// 板块五：入口与报告输出
// ------------------------------------------------------------

function main() {
  if (process.argv.includes('--selftest')) {
    process.exit(runSelfTest() ? 0 : 1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const reports = scanRepository(projectRoot);

  const totalErrors = reports.reduce((sum, report) => sum + report.errors.length, 0);
  const totalWarnings = reports.reduce((sum, report) => sum + report.warnings.length, 0);
  const scannedFileCount = SCAN_DIRS.reduce((sum, dir) =>
    sum + collectFiles(path.join(projectRoot, dir)).length, 0);

  console.log('== INV-8 命名合规检查 ==');
  console.log('扫描目录: ' + SCAN_DIRS.join(', ') + '（' + scannedFileCount + ' 个 .ts 文件）');

  if (reports.length === 0) {
    console.log('结果: 0 ERROR / 0 WARN —— 命名全部合规');
    return;
  }

  for (const report of reports) {
    for (const item of report.errors) {
      console.log('ERROR ' + report.file + ':' + item.line +
        ' [' + item.rule + '] ' + RULE_DESCRIPTIONS[item.rule] +
        ' —— 命中: ' + item.token);
    }
    for (const item of report.warnings) {
      console.log('WARN  ' + report.file + ':' + item.line +
        ' [' + item.rule + '] ' + RULE_DESCRIPTIONS[item.rule] +
        ' —— 命中: ' + item.token + '（请人工复核语义）');
    }
  }

  console.log('------------------------------------------------------------');
  console.log('汇总: ' + totalErrors + ' ERROR / ' + totalWarnings + ' WARN');
  if (totalErrors > 0) {
    console.log('结论: 存在确定性命名违规，提交阻断。请改名后重跑。');
    process.exit(1);
  }
  if (totalWarnings > 0) {
    console.log('结论: 无阻断项，但有 ' + totalWarnings + ' 条需人工复核的语义告警。');
  }
}

main();
