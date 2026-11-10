/**
 * P · console：命令表数据。
 * 顺序即 ConsoleEnvironmentText 下方 ConsoleCommandList 的显示顺序。
 */
export const ConsoleCommandList: readonly {
  readonly name: string;
  readonly summary: string;
}[] = [
  { name: 'ls', summary: '列出当前目录条目' },
  { name: 'cd', summary: '进入子目录，或 cd .. 返回上层' },
  { name: 'pwd', summary: '显示当前虚拟路径' },
  { name: 'open', summary: '打开选中世界' },
  { name: 'edit', summary: '进入当前世界的编辑器' },
  { name: 'export', summary: '导出世界文件' },
  { name: 'import', summary: '导入世界文件' },
  { name: 'settings', summary: '打开设置面板' },
  { name: 'help', summary: '显示命令列表' },
  { name: 'clear', summary: '清空输出' },
  { name: 'exit', summary: '退出 console，返回项目树' },
];
