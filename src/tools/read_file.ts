import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { emitToolCall, emitToolResult } from '../ui/events.js';
import { checkPermission } from '../permissions/check.js';

let callCounter = 0;

export const readFileTool = tool({
  description:
    '프로젝트 내 파일의 내용을 읽습니다. 경로는 현재 작업 디렉토리 기준 상대경로 또는 절대경로를 사용합니다.',
  inputSchema: z.object({
    path: z.string().describe('읽을 파일 경로 (예: src/cli.tsx, package.json)'),
  }),
  execute: async ({ path: filePath }) => {
    const id = `read-${++callCounter}`;
    emitToolCall(id, 'read_file', { path: filePath });

    const decision = checkPermission('read', { path: filePath });
    if (decision.kind === 'deny') {
      emitToolResult(id, 'read_file', false, decision.reason);
      return { error: decision.reason };
    }

    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      const content = await readFile(absolutePath, 'utf-8');
      const MAX = 30000;
      const lines = content.split('\n').length;
      if (content.length > MAX) {
        emitToolResult(id, 'read_file', true, `Read ${lines} lines (truncated)`);
        return {
          path: filePath,
          content: content.slice(0, MAX),
          truncated: true,
          totalLength: content.length,
        };
      }
      emitToolResult(id, 'read_file', true, `Read ${lines} lines`);
      return { path: filePath, content, truncated: false };
    } catch (err: any) {
      emitToolResult(id, 'read_file', false, err.message);
      return { error: `파일 읽기 실패: ${err.message}` };
    }
  },
});
