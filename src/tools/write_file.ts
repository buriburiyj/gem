import { tool } from 'ai';
import { z } from 'zod';
import { writeFile, readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { emitToolCall, emitToolResult, emitDiff } from '../ui/events.js';
import { checkPermission } from '../permissions/check.js';
import { requestApproval } from '../permissions/prompt.js';

let callCounter = 0;

export const writeFileTool = tool({
  description:
    '파일에 내용을 씁니다. 파일이 없으면 생성하고, 있으면 덮어씁니다. 부모 디렉토리도 자동으로 생성됩니다.',
  inputSchema: z.object({
    path: z.string().describe('저장할 파일 경로'),
    content: z.string().describe('파일에 쓸 전체 내용'),
  }),
  execute: async ({ path: filePath, content }) => {
    const id = `write-${++callCounter}`;
    emitToolCall(id, 'write_file', { path: filePath, bytes: content.length });

    const decision = checkPermission('write', { path: filePath });
    if (decision.kind === 'deny') {
      emitToolResult(id, 'write_file', false, decision.reason);
      return { error: decision.reason };
    }

    const absolutePath = path.resolve(process.cwd(), filePath);
    let oldContent = '';
    let exists = false;
    try {
      await stat(absolutePath);
      exists = true;
      oldContent = await readFile(absolutePath, 'utf-8');
    } catch {}

    if (decision.kind === 'ask') {
      const verb = exists ? '덮어쓰기' : '생성';
      const answer = await requestApproval(
        'write_file',
        `${verb}: ${filePath} (${content.length} bytes)`,
      );
      if (answer === 'no') {
        emitToolResult(id, 'write_file', false, '사용자가 거부함');
        return { error: '사용자가 거부했습니다.' };
      }
    }

    try {
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, 'utf-8');
      // diff 표시
      emitDiff(id, filePath, oldContent, content);
      const lines = content.split('\n').length;
      emitToolResult(id, 'write_file', true, `Wrote ${lines} lines`);
      return { path: filePath, bytes: content.length, lines };
    } catch (err: any) {
      emitToolResult(id, 'write_file', false, err.message);
      return { error: `파일 쓰기 실패: ${err.message}` };
    }
  },
});
