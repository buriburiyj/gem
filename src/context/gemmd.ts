import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function tryRead(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

export async function loadGemMd(): Promise<string> {
  const cwd = process.cwd();
  const home = os.homedir();

  const sources: Array<{ label: string; path: string }> = [
    { label: 'User', path: path.join(home, '.claude', 'CLAUDE.md') },
    { label: 'Project', path: path.join(cwd, 'CLAUDE.md') },
    { label: 'Project (local)', path: path.join(cwd, 'CLAUDE.local.md') },
    { label: 'Project (.claude)', path: path.join(cwd, '.claude', 'CLAUDE.md') },
  ];

  const parts: string[] = [];
  for (const src of sources) {
    const content = await tryRead(src.path);
    if (content) {
      parts.push(`# ${src.label} memory (${src.path})\n\n${content.trim()}`);
    }
  }
  return parts.join('\n\n---\n\n');
}
