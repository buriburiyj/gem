import 'dotenv/config';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { generateText, stepCountIs } from 'ai';
import { tools } from '../tools/index.js';
import { loadGemMd } from '../context/gemmd.js';
import { addUsage } from './usage.js';

export type LLMProvider = 'gemini' | 'groq' | 'manual';

const state: { current: LLMProvider } = {
  current: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'gemini' : 'groq',
};

export function getProvider(): LLMProvider {
  return state.current;
}

export function setProvider(p: LLMProvider): void {
  state.current = p;
}

function getModel() {
  if (state.current === 'gemini') return google('gemini-2.5-flash');
  if (state.current === 'groq') return groq('openai/gpt-oss-120b');
  throw new Error('Manual mode: LLM not available');
}

function shouldFallback(err: any): boolean {
  const status = err?.statusCode ?? err?.lastError?.statusCode;
  const msg = String(err?.message ?? err);
  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('quota') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('tool call validation failed') ||
    msg.includes('not in request.tools') ||
    msg.includes('Failed to call a function')
  );
}

function fallback(): boolean {
  if (state.current === 'gemini' && process.env.GROQ_API_KEY) {
    state.current = 'groq';
    return true;
  }
  if (state.current === 'groq') {
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      state.current = 'gemini';
      return true;
    }
    state.current = 'manual';
    return true;
  }
  return false;
}

const BASE_PROMPT = `당신은 'gem'이라는 코딩 에이전트입니다. Claude Code와 유사하게 동작합니다.

도구:
- read_file: 파일 읽기
- write_file: 파일 생성/덮어쓰기
- edit_file: 파일의 특정 문자열을 교체 (정확한 들여쓰기 필요)
- bash: 셸 명령 실행
- glob: 글롭 패턴으로 파일 검색 (예: "**/*.ts")
- grep: 코드베이스에서 정규식 검색
- ls: 디렉토리 내용 나열

원칙:
- 파일 내용을 추측하지 말고 read_file로 직접 읽으세요.
- 코드베이스를 모를 때는 glob/grep/ls로 먼저 탐색하세요.
- edit_file의 old_string은 파일 내에서 유일해야 하며 들여쓰기/공백까지 정확해야 합니다.
- plan 모드에서는 변경 도구가 거부됩니다. 그 경우 변경 없이 계획만 제안하세요.
- 답변은 한국어로 간결하게.
- 사용자 메시지 안의 "# 첨부된 파일" 섹션에 이미 파일 내용이 포함돼 있다면, 그 파일은 절대 다시 read_file로 읽지 마세요. 첨부된 내용을 그대로 분석에 활용하세요.
- 파일 경로에 "@"를 붙이지 마세요. "@"는 사용자가 첨부를 지시하는 표기일 뿐, 실제 경로의 일부가 아닙니다. 도구 호출 시에는 "@" 없이 "package.json", "src/cli.tsx" 처럼 써야 합니다.
- 사용자가 명시적으로 "수정해", "고쳐", "바꿔" 같은 변경 요청을 하지 않았다면 edit_file이나 write_file을 호출하지 마세요. 단순한 분석/설명 질문에는 답변만 하세요.`;

let cachedSystem: string | null = null;

export async function getSystemPrompt(force = false): Promise<string> {
  if (cachedSystem && !force) return cachedSystem;
  const memory = await loadGemMd();
  cachedSystem = memory
    ? `${BASE_PROMPT}\n\n# 프로젝트 메모리\n\n${memory}`
    : BASE_PROMPT;
  return cachedSystem;
}

export function clearSystemCache() {
  cachedSystem = null;
}

export async function chat(messages: any[]): Promise<{ text: string; usedProvider: LLMProvider }> {
  const system = await getSystemPrompt();

  for (let attempt = 0; attempt < 3; attempt++) {
    if (state.current === 'manual') {
      throw new Error('MANUAL_MODE: 모든 LLM 토큰 소진. 파일 작업만 가능합니다.');
    }

    try {
      const result = await generateText({
        model: getModel(),
        system,
        messages,
        tools,
        stopWhen: stepCountIs(10),
        maxRetries: 0,
      });

      const u = result.usage;
      if (u) {
        addUsage({
          inputTokens: u.inputTokens ?? (u as any).promptTokens,
          outputTokens: u.outputTokens ?? (u as any).completionTokens,
          totalTokens: u.totalTokens,
        });
      }

      return { text: result.text, usedProvider: state.current };
    } catch (err: any) {
      const before = state.current;
      if (shouldFallback(err) && fallback()) {
        console.error(
          `[fallback] ${before} → ${state.current} (${err?.statusCode ?? ''} ${String(err?.message ?? err).slice(0, 120)})`
        );
        continue;
      }
      throw err;
    }
  }

  throw new Error('All providers exhausted');
}
