import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MENTION_RE = /@([^\s@`'"]+)/g;

export type MentionResult = {
  text: string;
  attachments: Array<{ path: string; content: string; error?: string }>;
};

export async function expandMentions(input: string): Promise<MentionResult> {
  const matches = Array.from(input.matchAll(MENTION_RE));
  if (matches.length === 0) {
    return { text: input, attachments: [] };
  }

  const attachments: MentionResult['attachments'] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    const rel = m[1];
    if (seen.has(rel)) continue;
    seen.add(rel);

    const abs = path.resolve(process.cwd(), rel);
    try {
      const st = await stat(abs);
      if (!st.isFile()) {
        attachments.push({ path: rel, content: '', error: '디렉토리는 첨부 불가' });
        continue;
      }
      const content = await readFile(abs, 'utf-8');
      const MAX = 30000;
      const trimmed =
        content.length > MAX
          ? content.slice(0, MAX) + '\n…(잘림)'
          : content;
      attachments.push({ path: rel, content: trimmed });
    } catch (err: any) {
      attachments.push({ path: rel, content: '', error: err.message });
    }
  }

  return { text: input, attachments };
}

export function buildMessageWithAttachments(result: MentionResult): string {
  if (result.attachments.length === 0) return result.text;
  const parts = [result.text, '', '# 첨부된 파일'];
  for (const a of result.attachments) {
    if (a.error) {
      parts.push(`\n## @${a.path}\n(에러: ${a.error})`);
    } else {
      parts.push(`\n## @${a.path}\n\n\`\`\`\n${a.content}\n\`\`\``);
    }
  }
  return parts.join('\n');
}
