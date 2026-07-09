import { tool } from 'ai';
import { z } from 'zod';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { emitToolCall, emitToolResult } from '../ui/events.js';
import { checkPermission } from '../permissions/check.js';
let callCounter = 0;
export const lsTool = tool({
    description: '디렉토리 내용을 나열합니다. 파일/디렉토리 구분, 크기 정보 포함.',
    inputSchema: z.object({
        path: z
            .string()
            .optional()
            .describe('나열할 디렉토리 경로 (기본: 현재 디렉토리)'),
    }),
    execute: async ({ path: dirPath }) => {
        const id = `ls-${++callCounter}`;
        const target = dirPath ?? '.';
        emitToolCall(id, 'ls', { path: target });
        const decision = checkPermission('read');
        if (decision.kind === 'deny') {
            emitToolResult(id, 'ls', false, decision.reason);
            return { error: decision.reason };
        }
        try {
            const expandedPath = target.startsWith('~/') || target === '~'
                ? target.replace(/^~/, process.env.HOME || '')
                : target;
            const abs = path.resolve(process.cwd(), expandedPath);
            const entries = await readdir(abs);
            const items = [];
            for (const name of entries) {
                if (['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.pnpm-store', 'coverage', '.gem'].includes(name)) {
                    items.push({ name, type: 'dir' });
                    continue;
                }
                try {
                    const s = await stat(path.join(abs, name));
                    items.push({
                        name,
                        type: s.isDirectory() ? 'dir' : 'file',
                        size: s.isDirectory() ? undefined : s.size,
                    });
                }
                catch {
                    items.push({ name, type: 'unknown' });
                }
            }
            items.sort((a, b) => {
                if (a.type !== b.type)
                    return a.type === 'dir' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            emitToolResult(id, 'ls', true, `${items.length} entries`);
            return { path: target, entries: items };
        }
        catch (err) {
            emitToolResult(id, 'ls', false, err.message);
            return { error: `ls 실패: ${err.message}` };
        }
    },
});
//# sourceMappingURL=ls.js.map