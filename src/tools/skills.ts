import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type Skill = { name: string; description: string; dir: string; skillFile: string };

let skillCache: Skill[] | null = null;

function parseFrontmatter(text: string): { name?: string; description?: string } {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) out[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { name: out.name, description: out.description };
}

export function scanSkills(): Skill[] {
  if (skillCache) return skillCache;
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  const found: Skill[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    skillCache = [];
    return skillCache;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(skillsDir, e.name);
    const skillFile = path.join(dir, 'SKILL.md');
    let content: string;
    try {
      content = fs.readFileSync(skillFile, 'utf8');
    } catch {
      continue; // SKILL.md 없으면 건너뜀
    }
    const fm = parseFrontmatter(content);
    const firstLine = content.replace(/^---[\s\S]*?---\s*/, '').split('\n').find((l) => l.trim());
    found.push({
      name: fm.name || e.name,
      description: fm.description || (firstLine ? firstLine.slice(0, 120) : '(설명 없음)'),
      dir,
      skillFile,
    });
  }
  skillCache = found;
  return skillCache;
}

export function clearSkillCache(): void {
  skillCache = null;
}

// 시스템 프롬프트에 붙일 안내 블록 (스킬 없으면 빈 문자열)
export function buildSkillsPrompt(): string {
  const skills = scanSkills();
  if (skills.length === 0) return '';
  const lines = skills.map((s) => `- ${s.name}: ${s.description} (file: ${s.skillFile})`);
  return (
    `\n\nYou have access to the following user-defined Skills. ` +
    `A Skill is a folder containing a SKILL.md file with step-by-step instructions for a task. ` +
    `When a user request matches one of these skills, first read its SKILL.md with the read_file tool to get the full instructions, then follow them. ` +
    `Available skills:\n${lines.join('\n')}`
  );
}
