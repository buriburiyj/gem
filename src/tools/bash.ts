import { tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { emitToolCall, emitToolResult } from '../ui/events.js';
import { checkPermission } from '../permissions/check.js';
import { requestApproval } from '../permissions/prompt.js';

let callCounter = 0;

function runShell(
  cmd: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn('bash', ['-lc', cmd], { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1, timedOut });
    });
  });
}

export const bashTool = tool({
  description:
    '셸 명령을 실행합니다 (bash -lc). 작업은 현재 프로젝트 디렉토리에서 수행됩니다. 30초 후 타임아웃됩니다. 대화형 명령이나 무한 실행 명령은 피하세요.',
  inputSchema: z.object({
    command: z.string().describe('실행할 셸 명령 (예: ls -la, git status)'),
    description: z
      .string()
      .optional()
      .describe('이 명령이 무엇을 하는지 한 줄 설명'),
  }),
  execute: async ({ command, description }) => {
    const id = `bash-${++callCounter}`;
    emitToolCall(id, 'bash', { command, description });

    const decision = checkPermission('bash', { command });
    if (decision.kind === 'deny') {
      emitToolResult(id, 'bash', false, decision.reason);
      return { error: decision.reason };
    }
    if (decision.kind === 'ask') {
      const answer = await requestApproval(
        'bash',
        `${command}`,
        description,
      );
      if (answer === 'no') {
        emitToolResult(id, 'bash', false, '사용자가 거부함');
        return { error: '사용자가 거부했습니다.' };
      }
    }

    const { stdout, stderr, code, timedOut } = await runShell(command, 30000);
    if (timedOut) {
      emitToolResult(id, 'bash', false, 'Timed out (30s)');
      return { error: '명령 실행 시간 초과 (30s)', stdout, stderr };
    }
    const MAX = 20000;
    const out = stdout.length > MAX ? stdout.slice(0, MAX) + '\n…(잘림)' : stdout;
    const err = stderr.length > MAX ? stderr.slice(0, MAX) + '\n…(잘림)' : stderr;
    const summary = `exit ${code}, ${out.split('\n').length} 줄 출력`;
    emitToolResult(id, 'bash', code === 0, summary);
    return { stdout: out, stderr: err, exitCode: code };
  },
});
