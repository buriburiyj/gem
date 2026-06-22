import { tool } from 'ai';
import { z } from 'zod';
import fg from 'fast-glob';
import { emitToolCall, emitToolResult } from '../ui/events.js';
import { checkPermission } from '../permissions/check.js';

let callCounter = 0;

export const globTool = tool({
  description:
    '글롭 패턴으로 파일을 찾습니다. 예: "**/*.ts", "src/**/*.tsx". 결과는 수정 시간 역순으로 정렬됩니다.',
  inputSchema: z.object({
    pattern: z.string().describe('글롭 패턴 (예: **/*.ts)'),
    cwd: z
      .string()
      .optional()
      .describe('검색 시작 디렉토리 (기본: 프로젝트 루트)'),
  }),
  execute: async ({ pattern, cwd }) => {
    const id = `glob-${++callCounter}`;
    emitToolCall(id, 'glob', { pattern, cwd });

    const decision = checkPermission('read');
    if (decision.kind === 'deny') {
      emitToolResult(id, 'glob', false, decision.reason);
      return { error: decision.reason };
    }

    try {
      const files = await fg(pattern, {
        cwd: cwd ?? process.cwd(),
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        stats: true,
        dot: false,
      });
      files.sort(
        (a: any, b: any) => b.stats.mtimeMs - a.stats.mtimeMs,
      );
      const paths = files.map((f: any) => f.path);
      const MAX = 200;
      const truncated = paths.length > MAX;
      emitToolResult(
        id,
        'glob',
        true,
        `Found ${paths.length} files${truncated ? ' (showing 200)' : ''}`,
      );
      return {
        pattern,
        count: paths.length,
        files: paths.slice(0, MAX),
        truncated,
      };
    } catch (err: any) {
      emitToolResult(id, 'glob', false, err.message);
      return { error: `glob 실패: ${err.message}` };
    }
  },
});
