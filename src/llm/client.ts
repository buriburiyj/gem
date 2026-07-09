import dotenv from 'dotenv';
import path from 'node:path';
import os from 'node:os';
dotenv.config({ quiet: true });
dotenv.config({ path: path.join(os.homedir(), '.claude', '.env'), quiet: true });

import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { createOllama } from 'ollama-ai-provider-v2';
import { generateText, stepCountIs } from 'ai';
import fs from 'node:fs';
import { tools } from '../tools/index.js';
import { loadMcpTools } from '../tools/mcp.js';
import { buildSkillsPrompt } from '../tools/skills.js';
import { loadGemMd } from '../context/gemmd.js';
import { addUsage } from './usage.js';
import { loadConfig } from '../config/store.js';

import { spawn } from 'node:child_process';

let ollamaRecoveryAttempted = false;

async function ensureOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    if (res.ok) return true;
  } catch { }

  if (ollamaRecoveryAttempted) return false;
  ollamaRecoveryAttempted = true;

  try {
    const proc = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:' + (process.env.PATH || '') },
    });
    proc.unref();

    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          ollamaRecoveryAttempted = false;
          return true;
        }
      } catch { }
    }
  } catch { }
  return false;
}



export type LLMProvider = 'gemini' | 'groq' | 'ollama' | 'manual';

const cfg = loadConfig();

const state: { current: LLMProvider; ollamaModel: string; geminiModel: string } = {
  current: cfg.configured ? cfg.backend : 'gemini',
  geminiModel: 'auto' as string,
  ollamaModel: cfg.ollamaModel || 'qwen2.5-coder:7b',
};

const ollama = createOllama({
  baseURL: process.env.OLLAMA_URL || 'http://localhost:11434/api',
});

export function getProvider(): LLMProvider {
  return state.current;
}

export function setProvider(p: LLMProvider): void {
  state.current = p;
}


// 자동 모델 라우팅: 메시지 내용 보고 적절한 Ollama 모델 선택
const TOOL_MODEL = 'llama3.1:8b';        // 파일/도구 작업
const CHAT_MODEL = 'qwen2.5-coder:7b';   // 일반 대화/코딩 질문

const TOOL_KEYWORDS = [
  '만들어', '만들자', '생성', '저장', '수정', '삭제', '추가', '바꿔', '고쳐',
  '파일', '폴더', '디렉토리', '실행',
  'create', 'write', 'edit', 'delete', 'remove', 'modify', 'change',
  'file', 'folder', 'directory', 'make', 'build', 'run', 'execute',
  'mkdir', 'touch',
];

function shouldUseToolModel(text: string): boolean {
  const lower = text.toLowerCase();
  // 경로 패턴 (~/, ./, /Users/ 등)
  if (/(~\/|\.\/|\/Users\/|\/tmp\/|\/Desktop\/)/.test(text)) return true;
  // 키워드 매칭
  for (const kw of TOOL_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return true;
  }
  return false;
}

function autoSelectOllamaModel(messages: any[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return CHAT_MODEL;
  const text = typeof lastUser.content === 'string'
    ? lastUser.content
    : JSON.stringify(lastUser.content);
  return shouldUseToolModel(text) ? TOOL_MODEL : CHAT_MODEL;
}

export function setOllamaModel(model: string): void {
  state.ollamaModel = model;
}

export function getOllamaModel(): string {
  return state.ollamaModel;
}

let lastGeminiRoute = '';
let demotedByFallback = false; // 폴백으로 flash 강등됐는지 표시

export function getGeminiRoute(): string {
  return lastGeminiRoute;
}

export function getGeminiModel(): string {
  return state.geminiModel;
}

export function setGeminiModel(m: string) {
  state.geminiModel = m;
}

const CLASSIFIER_PROMPT = `You are a task routing AI. Analyze the user's request and classify its complexity.
A task is COMPLEX if it meets ONE OR MORE: (1) needs 4+ steps/tool calls, (2) asks for architecture/strategy/design ("how"/"why"), (3) is broad/ambiguous needing extensive investigation, (4) deep debugging or root-cause analysis.
A task is SIMPLE if it is specific, bounded, low operational complexity (1-3 tool calls). Operational simplicity overrides strategic phrasing.
Respond ONLY with valid JSON: {"model_choice":"simple"} or {"model_choice":"complex"}. No other text.`;

let mcpTools: Record<string, any> | null = null;
let mcpLoading: Promise<Record<string, any>> | null = null;
async function getAllTools(): Promise<Record<string, any>> {
  if (mcpTools) return { ...tools, ...mcpTools };
  if (!mcpLoading) {
    mcpLoading = loadMcpTools()
      .then((m) => { mcpTools = m; return m; })
      .catch(() => { mcpTools = {}; return {}; });
  }
  const m = await mcpLoading;
  return { ...tools, ...m };
}

function classifyComplexity(messages: any[], _signal?: AbortSignal): 'simple' | 'complex' {
  // 품질 우선: 기본은 pro(complex), 아주 단순한 것만 flash(simple)
  const rev = [...messages].reverse();
  const lastUser = rev.find((m: any) => m.role === 'user');
  let text = '';
  if (lastUser) {
    if (typeof lastUser.content === 'string') text = lastUser.content;
    else if (Array.isArray(lastUser.content)) text = lastUser.content.map((p: any) => (p && p.text) ? p.text : '').join(' ');
  }
  const t = text.trim().toLowerCase();
  // 짧은 인사/확인만 flash로
  const simplePhrases = ['안녕','하이','hi','hello','ok','오케이','응','그래','고마','thanks','thank you','네','yes','no','아니'];
  if (t.length <= 30 && simplePhrases.some((p) => t.includes(p))) return 'simple';
  // 그 외 모든 것은 품질을 위해 pro
  return 'complex';
}

function getModel() {
  if (state.current === 'gemini') {
    const m = state.geminiModel === 'auto' ? 'gemini-2.5-flash' : state.geminiModel;
    return google(m);
  }
  if (state.current === 'groq') return groq('openai/gpt-oss-120b');
  if (state.current === 'ollama') return ollama(state.ollamaModel);
  throw new Error('Manual mode: LLM not available');
}

function logFallback(msg: string): void {
  try {
    const dir = path.join(os.homedir(), '.claude');
    fs.appendFileSync(path.join(dir, 'gem.log'), new Date().toISOString() + ' ' + msg + '\n');
  } catch {}
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
  // Ollama는 폴백 체인에서 제외 — 사용자가 명시적으로 선택했을 때만 사용
  if (state.current === 'ollama') {
    state.current = 'manual';
    return true;
  }
  if (state.current === 'gemini') {
    // 먼저 같은 Gemini 안에서 flash로 강등 재시도 (Groq 8k 한도 회피)
    const cur = state.geminiModel === 'auto' ? 'gemini-2.5-pro' : state.geminiModel;
    if (cur !== 'gemini-2.5-flash') {
      // auto였다가 강등되는 경우만 복원 대상으로 표시
      if (state.geminiModel === 'auto') demotedByFallback = true;
      state.geminiModel = 'gemini-2.5-flash';
      return true;
    }
    // 이미 flash인데도 실패하면 groq로
    if (process.env.GROQ_API_KEY) {
      state.current = 'groq';
      return true;
    }
    state.current = 'manual';
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

let systemCache: string | null = null;

export function clearSystemCache(): void {
  systemCache = null;
}

async function getSystem(): Promise<string> {
  if (systemCache !== null) return systemCache;
  const base = `You are Claude Code, Anthropic's official CLI coding assistant running in the user's terminal. You help with software engineering tasks: reading and editing files, running commands, searching code, and answering programming questions. You have access to tools (read_file, write_file, edit_file, bash, glob, grep, ls, web_search) — use them to accomplish tasks directly rather than just describing what to do. When the user needs up-to-date information, news, current events, documentation, YouTube, or anything that may be beyond your training data, use the web_search tool to look it up instead of saying you cannot access the web. Before answering questions about code, read the relevant files with read_file rather than guessing their contents. If you are unsure about a fact or need current information, use web_search to verify instead of guessing. When editing code, briefly explain the reason for each change. Prefer correctness and completeness over brevity, but avoid unnecessary filler. Respond in the same language the user writes in. \n\nSKILL CREATION: If you notice the user repeatedly asks for the same kind of multi-step task, you may PROPOSE creating a reusable Skill. Never create a skill silently. First briefly describe what the skill would do, then ask the user for permission. Only if the user agrees, create the file at ~/.claude/skills/<skill-name>/SKILL.md using the write_file tool (the tool will ask the user to confirm the write). The SKILL.md must start with a frontmatter block containing name and description, followed by clear step-by-step instructions.\n\nPROJECT CONTEXT: This tool automatically loads project instructions from CLAUDE.md files (in ~/.claude/, the project root, and .claude/). If the user is working in a project without a CLAUDE.md and asks for help setting one up, you can suggest creating one that documents the project's build commands, folder structure, and conventions, so future sessions understand the project automatically.`;
  const skillsPrompt = buildSkillsPrompt();
  const withSkills = base + skillsPrompt;
  const memory = await loadGemMd();
  systemCache = memory
    ? `${withSkills}\n\nThe following is project context provided by the user in CLAUDE.md. Treat it as reference material about the project you are working on, not as a description of your own identity:\n\n${memory}`
    : withSkills;
  return systemCache;
}


export async function chat(
  messages: any[],
  signal?: AbortSignal,
): Promise<{ text: string; usedProvider: LLMProvider }> {
  const system = await getSystem();
  // 직전 요청에서 폴백으로 강등됐다면 이번엔 다시 auto(기본 pro)로 복원
  if (demotedByFallback) {
    state.geminiModel = 'auto';
    demotedByFallback = false;
  }
  // 최대 2번 폴백 시도
  for (let attempt = 0; attempt < 3; attempt++) {
    if (state.current === 'manual') {
      throw new Error('All providers exhausted');
    }
    try {
      // Ollama 자동 모델 라우팅 + 데몬 자동 복구
      if (state.current === 'ollama') {
        const alive = await ensureOllamaRunning();
        if (!alive) {
          throw new Error('Ollama 데몬을 시작할 수 없습니다. 터미널에서 `ollama serve`를 실행해주세요.');
        }
        const autoModel = autoSelectOllamaModel(messages);
        if (autoModel !== state.ollamaModel) {
          state.ollamaModel = autoModel;
        }
      }
      // Gemini auto 라우팅: 복잡도 분류 후 flash/pro 선택
      let routedGemini: string | null = null;
      if (state.current === 'gemini' && state.geminiModel === 'auto') {
        const complexity = classifyComplexity(messages, signal);
        routedGemini = complexity === 'complex' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        lastGeminiRoute = routedGemini.replace('gemini-2.5-', '');
      } else if (state.current === 'gemini') {
        lastGeminiRoute = state.geminiModel.replace('gemini-2.5-', '');
      }
      const activeModel =
        state.current === 'gemini'
          ? google(routedGemini ?? (state.geminiModel === 'auto' ? 'gemini-2.5-flash' : state.geminiModel))
          : getModel();
      const allTools = await getAllTools();
      const result = await generateText({
        model: activeModel,
        system,
        messages,
        tools: allTools,
        stopWhen: stepCountIs(10),
        maxRetries: 0,
        abortSignal: signal,
      });
      const u = result.usage;
      if (u) {
        addUsage(state.current, {
          inputTokens: u.inputTokens ?? (u as any).promptTokens,
          outputTokens: u.outputTokens ?? (u as any).completionTokens,
          totalTokens: u.totalTokens,
        });
      }
      let finalText = result.text ?? '';
      if (!finalText.trim() && Array.isArray((result as any).steps)) {
        for (let i = (result as any).steps.length - 1; i >= 0; i--) {
          const st = (result as any).steps[i];
          if (st && typeof st.text === 'string' && st.text.trim()) { finalText = st.text; break; }
        }
      }
      if (!finalText.trim()) {
        finalText = '(응답을 생성하지 못했어요. 다시 한 번 질문해 주세요.)';
      }
      return { text: finalText, usedProvider: state.current };
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) throw err;
      const before = state.current;
      if (shouldFallback(err) && fallback()) {
        logFallback(`[fallback] ${before} → ${state.current} (${err?.statusCode ?? ''} ${String(err?.message ?? err).slice(0, 120)})`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('All providers exhausted');
}
