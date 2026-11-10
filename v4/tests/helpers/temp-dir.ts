import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export async function createTempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'neurou-r2-'));
}

export async function cleanupTempProject(root: string): Promise<void> {
  await fs.rm(root, { recursive: true, force: true });
}
