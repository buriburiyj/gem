import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { chat } from '../llm/client.js';

async function tryRead(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

export async function runInit(): Promise<{ ok: boolean; message: string }> {
  const cwd = process.cwd();
  const gemMdPath = path.join(cwd, 'GEM.md');

  // 이미 존재 확인
  try {
    await stat(gemMdPath);
    return {
      ok: false,
      message:
        'GEM.md가 이미 존재합니다. 덮어쓰려면 먼저 파일을 삭제하거나 /memory로 편집하세요.',
    };
  } catch {}

  // 프로젝트 정보 수집
  const pkg = await tryRead(path.join(cwd, 'package.json'));
  const readme =
    (await tryRead(path.join(cwd, 'README.md'))) ??
    (await tryRead(path.join(cwd, 'README.txt')));
  const tsconfig = await tryRead(path.join(cwd, 'tsconfig.json'));
  const files = await fg(['**/*'], {
    cwd,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.next/**', '**/build/**', '**/.Trash/**', '**/Library/**', '**/.cache/**', '**/.npm/**', '**/.pnpm-store/**', '**/.gem/**', '**/.local/**'],
    suppressErrors: true,
    deep: 10,
    dot: false,
    onlyFiles: true,
  });
  const topFiles = files.slice(0, 100);

  const prompt = `다음 정보를 바탕으로 이 프로젝트용 GEM.md 파일 내용을 작성해줘.
GEM.md는 코딩 에이전트(gem, Claude Code의 클론)가 매 세션 시작 시 자동으로 읽는 프로젝트 가이드 메모리야.
포함할 내용:
1. 프로젝트 개요 (한 두 줄)
2. 주요 기술 스택
3. 폴더/파일 구조 요약
4. 개발 명령 (build/dev/test 등)
5. 코딩 컨벤션이나 주의사항 (추측이 아닌 실제 발견된 패턴만)

마크다운 형식으로만 답하고, 추가 설명이나 코드블록 감싸기는 하지 마. 한국어로.

# 수집한 정보

## package.json
${pkg ?? '(없음)'}

## README
${readme ?? '(없음)'}

## tsconfig.json
${tsconfig ?? '(없음)'}

## 파일 목록 (최대 100개)
${topFiles.join('\n')}
`;

  try {
    const { text: reply } = await chat([{ role: 'user', content: prompt }]);
    await writeFile(gemMdPath, reply.trim() + '\n', 'utf-8');
    return { ok: true, message: `GEM.md 생성 완료 (${reply.length} bytes)` };
  } catch (err: any) {
    return { ok: false, message: `생성 실패: ${err.message}` };
  }
}
