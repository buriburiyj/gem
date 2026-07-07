import { tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';
import { emitToolCall, emitToolResult } from '../ui/events.js';
import { checkPermission } from '../permissions/check.js';
let callCounter = 0;
function hasRipgrep() {
    return new Promise((resolve) => {
        const child = spawn('which', ['rg']);
        child.on('close', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
    });
}
function runRipgrep(pattern, globPat, caseInsensitive) {
    return new Promise((resolve) => {
        const args = ['--line-number', '--no-heading', '--color', 'never'];
        if (caseInsensitive)
            args.push('-i');
        if (globPat)
            args.push('-g', globPat);
        args.push(pattern);
        const child = spawn('rg', args, { cwd: process.cwd() });
        let out = '';
        child.stdout.on('data', (d) => (out += d.toString()));
        child.on('close', () => resolve(out));
        child.on('error', () => resolve(''));
    });
}
async function jsFallback(pattern, globPat, caseInsensitive) {
    const re = new RegExp(pattern, caseInsensitive ? 'i' : '');
    const files = await fg(globPat ?? '**/*', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.Trash/**', '**/Library/**', '**/.cache/**', '**/.npm/**', '**/.pnpm-store/**', '**/.gem/**', '**/.local/**'],
        suppressErrors: true,
        deep: 10,
        dot: false,
    });
    const results = [];
    for (const f of files) {
        try {
            const content = await readFile(f, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (re.test(line)) {
                    results.push(`${f}:${i + 1}:${line}`);
                }
            });
        }
        catch { }
        if (results.length > 500)
            break;
    }
    return results.join('\n');
}
export const grepTool = tool({
    description: '코드베이스에서 정규식 패턴을 검색합니다. 결과는 파일경로:줄번호:내용 형식. ripgrep 사용 가능 시 사용.',
    inputSchema: z.object({
        pattern: z.string().describe('검색할 정규식 또는 문자열'),
        glob: z
            .string()
            .optional()
            .describe('대상 파일 글롭 (예: "*.ts", "src/**/*.tsx")'),
        case_insensitive: z
            .boolean()
            .optional()
            .describe('대소문자 무시 (기본 false)'),
    }),
    execute: async ({ pattern, glob, case_insensitive }) => {
        const id = `grep-${++callCounter}`;
        emitToolCall(id, 'grep', { pattern, glob });
        const decision = checkPermission('read');
        if (decision.kind === 'deny') {
            emitToolResult(id, 'grep', false, decision.reason);
            return { error: decision.reason };
        }
        try {
            const useRg = await hasRipgrep();
            const output = useRg
                ? await runRipgrep(pattern, glob, case_insensitive ?? false)
                : await jsFallback(pattern, glob, case_insensitive ?? false);
            const lines = output.split('\n').filter(Boolean);
            const MAX = 200;
            const truncated = lines.length > MAX;
            const shown = lines.slice(0, MAX);
            emitToolResult(id, 'grep', true, `${lines.length} match(es)${truncated ? ' (showing 200)' : ''}`);
            return {
                pattern,
                matches: shown,
                count: lines.length,
                truncated,
                engine: useRg ? 'ripgrep' : 'js',
            };
        }
        catch (err) {
            emitToolResult(id, 'grep', false, err.message);
            return { error: `grep 실패: ${err.message}` };
        }
    },
});
//# sourceMappingURL=grep.js.map