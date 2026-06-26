import { tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emitToolCall, emitToolResult, emitDiff } from '../ui/events.js';
import { checkPermission } from '../permissions/check.js';
import { requestApproval } from '../permissions/prompt.js';

let callCounter = 0;

export const editFileTool = tool({
  description:
    '파일의 특정 문자열을 다른 문자열로 교체합니다. old_string은 파일 내에서 정확히 한 번만 등장해야 합니다 (replace_all=true이면 모두 교체). 들여쓰기와 공백까지 정확히 일치해야 합니다.',
  inputSchema: z.object({
    path: z.string().describe('편집할 파일 경로'),
    old_string: z.string().describe('교체될 기존 문자열 (정확히 일치해야 함)'),
    new_string: z.string().describe('새로 들어갈 문자열'),
    replace_all: z
      .boolean()
      .optional()
      .describe('true면 모든 일치 항목 교체, 기본 false'),
  }),
  execute: async ({ path: filePath, old_string, new_string, replace_all }) => {
    const id = `edit-${++callCounter}`;
    emitToolCall(id, 'edit_file', { path: filePath });

    const decision = checkPermission('edit', { path: filePath });
    if (decision.kind === 'deny') {
      emitToolResult(id, 'edit_file', false, decision.reason);
      return { error: decision.reason };
    }

    try {
      const expandedPath = filePath.startsWith('~/') || filePath === '~'
        ? filePath.replace(/^~/, process.env.HOME || '')
        : filePath;
      const absolutePath = path.resolve(process.cwd(), expandedPath);
      const original = await readFile(absolutePath, 'utf-8');

      const occurrences = original.split(old_string).length - 1;
      if (occurrences === 0) {
        const msg = 'old_string이 파일에서 발견되지 않음';
        emitToolResult(id, 'edit_file', false, msg);
        return { error: msg };
      }
      if (occurrences > 1 && !replace_all) {
        const msg = `old_string이 ${occurrences}번 등장. replace_all=true 사용 또는 더 구체적인 문자열 필요`;
        emitToolResult(id, 'edit_file', false, msg);
        return { error: msg };
      }

      const updated = replace_all
        ? original.split(old_string).join(new_string)
        : original.replace(old_string, new_string);

      if (decision.kind === 'ask') {
        const preview = makeDiffPreview(old_string, new_string);
        const answer = await requestApproval(
          'edit_file',
          `편집: ${filePath} (${occurrences}곳 교체)`,
          preview,
        );
        if (answer === 'no') {
          emitToolResult(id, 'edit_file', false, '사용자가 거부함');
          return { error: '사용자가 거부했습니다.' };
        }
      }

      await writeFile(absolutePath, updated, 'utf-8');
      // diff 표시
      emitDiff(id, filePath, original, updated);
      emitToolResult(id, 'edit_file', true, `Edited ${occurrences} occurrence(s)`);
      return { path: filePath, replaced: occurrences };
    } catch (err: any) {
      emitToolResult(id, 'edit_file', false, err.message);
      return { error: `편집 실패: ${err.message}` };
    }
  },
});

function makeDiffPreview(oldS: string, newS: string): string {
  const a = oldS.split('\n').slice(0, 5).join('\n');
  const b = newS.split('\n').slice(0, 5).join('\n');
  return `- ${a}\n+ ${b}`;
}
