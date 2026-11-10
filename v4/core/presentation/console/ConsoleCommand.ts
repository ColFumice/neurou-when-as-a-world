/**
 * P · console：命令联合类型与解析。
 * 解析函数以 ConsoleCommand.parseCommand(...) 暴露，避免新增 A 类外的导出。
 */

type ConsoleCommandKind =
  | 'ls'
  | 'cd'
  | 'open'
  | 'edit'
  | 'export'
  | 'import'
  | 'settings'
  | 'help'
  | 'clear'
  | 'pwd'
  | 'exit';

type CommandWithArgs<K extends ConsoleCommandKind> = {
  readonly kind: K;
  readonly args: readonly string[];
};

export type ConsoleCommand = {
  [K in ConsoleCommandKind]: CommandWithArgs<K>;
}[ConsoleCommandKind];

interface ConsoleCommandParseResult {
  readonly ok: boolean;
  readonly command: ConsoleCommand | null;
  readonly args: readonly string[];
  readonly reason: string | null;
}

const COMMAND_KINDS: readonly ConsoleCommandKind[] = [
  'ls',
  'cd',
  'open',
  'edit',
  'export',
  'import',
  'settings',
  'help',
  'clear',
  'pwd',
  'exit',
];

function isCommandKind(value: string): value is ConsoleCommandKind {
  return (COMMAND_KINDS as readonly string[]).includes(value);
}

function parseCommand(input: string): ConsoleCommandParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, command: null, args: [], reason: 'empty command' };
  }

  const parts = trimmed.split(/\s+/);
  const name = parts[0];
  if (!isCommandKind(name)) {
    return {
      ok: false,
      command: null,
      args: [],
      reason: `unknown command: ${name}`,
    };
  }

  const args = parts.slice(1);
  return {
    ok: true,
    command: { kind: name, args } as ConsoleCommand,
    args,
    reason: null,
  };
}

export const ConsoleCommand = {
  parseCommand,
};
