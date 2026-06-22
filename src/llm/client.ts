import 'dotenv/config';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { generateText, stepCountIs } from 'ai';
import { tools } from '../tools/index.js';

export type LLMProvider = 'gemini' | 'groq' | 'manual';

const state: { current: LLMProvider } = {
  current: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'gemini' : 'groq',
};

export function getProvider(): LLMProvider {
  return state.current;
}

function getModel() {
  if (state.current === 'gemini') return google('gemini-2.5-flash');
  if (state.current === 'groq') return groq('llama-3.3-70b-versatile');
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
    msg.includes('overloaded')
  );
}

function fallback(): boolean {
  if (state.current === 'gemini' && process.env.GROQ_API_KEY) {
    state.current = 'groq';
    return true;
  }
  if (state.current === 'groq') {
    state.current = 'manual';
    return true;
  }
  return false;
}

const SYSTEM_PROMPT = `당신은 'gem'이라는 코딩 에이전트입니다. Claude Code와 유사하게 동작합니다.

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
- 답변은 한국어로 간결하게.`;


export async function chat(messages: any[]): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (state.current === 'manual') {
      throw new Error('MANUAL_MODE: 모든 LLM 토큰 소진. 파일 작업만 가능합니다.');
    }
    try {
      const result = await generateText({
        model: getModel(),
        system: SYSTEM_PROMPT,
        messages,
        tools,
        stopWhen: stepCountIs(10), // 최대 10단계까지 tool 호출 반복
        maxRetries: 0,
      });
      return result.text;
    } catch (err) {
      if (shouldFallback(err) && fallback()) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('All providers exhausted');
}
