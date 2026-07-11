import type { LLMProvider } from './client.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  turns: number;
};

const usage: Record<string, ProviderUsage> = {};

// ---- 영속 누적(껐다 켜도 유지) ----
const USAGE_FILE = path.join(os.homedir(), '.claude', 'usage.json');
type PersistShape = {
  total: ProviderUsage;
  today: ProviderUsage;
  todayDate: string; // YYYY-MM-DD
};
function emptyUsage(): ProviderUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 };
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
let persist: PersistShape = { total: emptyUsage(), today: emptyUsage(), todayDate: todayStr() };
try {
  const raw = fs.readFileSync(USAGE_FILE, 'utf8');
  const loaded = JSON.parse(raw);
  if (loaded && loaded.total) {
    persist = {
      total: { ...emptyUsage(), ...loaded.total },
      today: { ...emptyUsage(), ...(loaded.today ?? {}) },
      todayDate: loaded.todayDate ?? todayStr(),
    };
  }
} catch { /* 파일 없거나 손상 → 기본값 */ }
// 날짜 바뀌었으면 오늘 리셋
if (persist.todayDate !== todayStr()) {
  persist.today = emptyUsage();
  persist.todayDate = todayStr();
}

let saveTimer: NodeJS.Timeout | null = null;
function schedulePersistSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
      fs.writeFileSync(USAGE_FILE, JSON.stringify(persist, null, 2));
    } catch { /* 저장 실패는 조용히 무시 */ }
  }, 1000);
}

function addToPersist(u: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) {
  if (persist.todayDate !== todayStr()) {
    persist.today = emptyUsage();
    persist.todayDate = todayStr();
  }
  const inp = u.inputTokens ?? 0;
  const out = u.outputTokens ?? 0;
  const tot = u.totalTokens ?? inp + out;
  for (const bucket of [persist.total, persist.today]) {
    bucket.inputTokens += inp;
    bucket.outputTokens += out;
    bucket.totalTokens += tot;
    bucket.turns += 1;
  }
  schedulePersistSave();
}

export function getPersistentUsage(): { total: ProviderUsage; today: ProviderUsage } {
  return { total: { ...persist.total }, today: { ...persist.today } };
}
export function resetPersistentUsage() {
  persist = { total: emptyUsage(), today: emptyUsage(), todayDate: todayStr() };
  try { fs.writeFileSync(USAGE_FILE, JSON.stringify(persist, null, 2)); } catch {}
}

function ensure(provider: string): ProviderUsage {
  if (!usage[provider]) {
    usage[provider] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 };
  }
  return usage[provider];
}

export function addUsage(
  provider: string,
  u: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
) {
  const p = ensure(provider);
  p.inputTokens += u.inputTokens ?? 0;
  p.outputTokens += u.outputTokens ?? 0;
  p.totalTokens += u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
  p.turns += 1;
  addToPersist(u);
}

export function getUsageByProvider(): Record<string, ProviderUsage> {
  return { ...usage };
}

export function getUsage(): ProviderUsage {
  const total: ProviderUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 };
  for (const p of Object.values(usage)) {
    total.inputTokens += p.inputTokens;
    total.outputTokens += p.outputTokens;
    total.totalTokens += p.totalTokens;
    total.turns += p.turns;
  }
  return total;
}

export function resetUsage() {
  for (const k of Object.keys(usage)) delete usage[k];
}

// USD per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
  gemini: { input: 0.30, output: 2.50 },     // gemini-2.5-flash
  groq:   { input: 0.59, output: 0.79 },     // llama-3.3-70b 추정
  manual: { input: 0, output: 0 },
};

export function estimateCost(provider: string, u: ProviderUsage): number {
  const p = PRICING[provider] ?? { input: 0, output: 0 };
  return (u.inputTokens * p.input + u.outputTokens * p.output) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd < 0.0001) return '$0.0000';
  if (usd < 0.01) return '$' + usd.toFixed(5);
  return '$' + usd.toFixed(4);
}

export function formatTokensCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'k';
  return (n / 1_000_000).toFixed(1) + 'M';
}
