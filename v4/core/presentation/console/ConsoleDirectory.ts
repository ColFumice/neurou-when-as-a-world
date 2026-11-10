/**
 * P · console：虚拟目录树。
 * 根为 "/"；根没有 parent；listEntries 按加入顺序稳定返回。
 */
export class ConsoleDirectory {
  private readonly children = new Map<string, ConsoleDirectory>();
  private readonly childOrder: string[] = [];

  constructor(
    private readonly name: string = '/',
    private readonly parent: ConsoleDirectory | null = null,
  ) {}

  getPath(): string {
    const names: string[] = [];
    let current: ConsoleDirectory | null = this;
    while (current !== null && current.parent !== null) {
      names.push(current.name);
      current = current.parent;
    }
    return names.length === 0 ? '/' : '/' + names.reverse().join('/');
  }

  getParent(): ConsoleDirectory | null {
    return this.parent;
  }

  addChild(name: string): ConsoleDirectory {
    if (name.length === 0 || name === '.' || name === '..' || /[\\/]/.test(name)) {
      throw new Error(`invalid console directory name: ${name}`);
    }
    const existing = this.children.get(name);
    if (existing) return existing;

    const child = new ConsoleDirectory(name, this);
    this.children.set(name, child);
    this.childOrder.push(name);
    return child;
  }

  listEntries(): readonly string[] {
    return [...this.childOrder];
  }

  enter(name: string): ConsoleDirectory | null {
    if (name === '..') return this.enterParent();
    if (name.length === 0 || name === '.') return this;
    return this.children.get(name) ?? null;
  }

  enterParent(): ConsoleDirectory | null {
    return this.parent;
  }

  canEnterParent(): boolean {
    return this.parent !== null;
  }
}
