#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import path from 'node:path';
import os from 'node:os';
import {
  chat,
  getProvider,
  setProvider,
  clearSystemCache,
} from './llm/client.js';
import { spawn } from 'node:child_process';
import { getUsage, getUsageByProvider, resetUsage, estimateCost, formatCost, formatTokensCompact } from './llm/usage.js';
import {
  getMode,
  cycleMode,
  modeLabel,
  modeColor,
  PermissionMode,
} from './permissions/mode.js';
import { bus, ToolEvent } from './ui/events.js';
import { ClaudeSpinner } from './ui/spinner.js';
import { DiffView } from './ui/diff.js';
import {
  approvalBus,
  answerApproval,
  ApprovalRequest,
} from './permissions/prompt.js';
import {
  expandMentions,
  buildMessageWithAttachments,
} from './context/mentions.js';
import { runInit } from './commands/init.js';
import { MentionInput, invalidateFileCache } from './ui/MentionInput.js';
import {
  Session,
  SessionMessage,
  newSessionId,
  saveSession,
  loadLatest,
  loadSession,
  deleteSession,
  listSessions,
  groupByCwd,
  summarizeSession,
} from './session/store.js';
import { StartupWizard } from './ui/StartupWizard.js';
import { loadConfig, saveConfig } from './config/store.js';
import { setThemeMode, getColors, getThemeLabel, ThemeMode } from './ui/theme.js';
import { setOllamaModel, getOllamaModel } from './llm/client.js';
import { setGeminiModel, getGeminiModel, getGeminiRoute } from './llm/client.js';

const SLASH_COMMANDS = [
  { name: 'help', description: '도움말 표시' },
  { name: 'clear', description: '대화 초기화' },
  { name: 'model', description: '모델 전환 (gemini/groq/ollama)' },
  { name: 'setup', description: '시작 위저드 다시 띄우기' },
  { name: 'theme', description: '테마 변경 (light/dark/auto)' },
  { name: 'backend', description: '백엔드 변경 (gemini/groq/ollama)' },
  { name: 'ollama-model', description: 'Ollama 모델 전환' },
  { name: 'memory', description: 'CLAUDE.md 재로드' },
  { name: 'init', description: 'CLAUDE.md 생성' },
  { name: 'cost', description: '토큰 사용량 표시' },
  { name: 'context', description: '컨텍스트 사용량 표시' },
  { name: 'exit', description: '종료' },
  { name: 'resume', description: '최근 세션 이어서 진행' },
  { name: 'sessions', description: '저장된 세션 목록' },
  { name: 'delete', description: '세션 삭제: /delete <id>' },
];

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type DisplayItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; provider: string }
  | { kind: 'error'; text: string }
  | { kind: 'info'; text: string }
  | {
      kind: 'tool_call';
      id: string;
      name: string;
      input: any;
      result?: string;
      ok?: boolean;
    }
  | { kind: 'diff'; id: string; filePath: string; oldText: string; newText: string };

function summarizeInput(name: string, input: any): string {
  if (name === 'web_search') return input?.query ?? '';
  if (name === 'read_file') return input?.path ?? '';
  if (name === 'write_file') return input?.path ?? '';
  if (name === 'edit_file') return input?.path ?? '';
  if (name === 'bash') return input?.command ?? '';
  if (name === 'glob') return input?.pattern ?? '';
  if (name === 'grep') {
    const p = input?.pattern ?? '';
    const g = input?.glob ? ` in ${input.glob}` : '';
    return `"${p}"${g}`;
  }
  if (name === 'ls') return input?.path ?? '.';
  try {
    return JSON.stringify(input);
  } catch {
    return '';
  }
}

function toolDisplayName(name: string): string {
  const map: Record<string, string> = {
    read_file: 'Read',
    web_search: 'Web Search',
    write_file: 'Write',
    edit_file: 'Edit',
    bash: 'Bash',
    glob: 'Glob',
    grep: 'Grep',
    ls: 'List',
  };
  return map[name] ?? name;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function contextPercent(totalTokens: number): number {
  const CONTEXT_SIZE = 1_000_000;
  return Math.min(100, Math.floor((totalTokens / CONTEXT_SIZE) * 100));
}

function Banner() {
  const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
  const colors = getColors();
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.signature}
        paddingX={1}
      >
        <Box>
          <Text color={colors.signature} bold>{'✳ '}</Text>
          <Text bold>Welcome to Claude Code</Text>
        </Box>
        <Box marginTop={1} paddingLeft={2}>
          <Text dimColor>{cwd}</Text>
        </Box>
      </Box>
      <Box marginTop={1} paddingX={1} flexDirection="column">
        <Text color={colors.signature} bold>Tips for getting started</Text>
        <Text dimColor>Ask Claude to create a new app or edit files</Text>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>? for shortcuts</Text>
      </Box>
    </Box>
  );
}

function TrustDialog({ onConfirm }: { onConfirm: () => void }) {
  const colors = getColors();
  const [sel, setSel] = useState(0);
  const cwd = process.cwd();
  useInput((_input, key) => {
    if (key.upArrow || key.downArrow) setSel((s) => (s === 0 ? 1 : 0));
    if (key.return) {
      if (sel === 0) onConfirm();
      else process.exit(0);
    }
  });
  return (
    <Box flexDirection="column" marginY={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.signature}
        paddingX={2}
        paddingY={1}
      >
        <Text bold>Do you trust the files in this folder?</Text>
        <Box marginTop={1}>
          <Text color={colors.signature}>{cwd}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Claude Code may read, write, and execute files</Text>
          <Text dimColor>in this folder. Only proceed if you trust it.</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={sel === 0 ? colors.signature : undefined}>
            {sel === 0 ? '❯ ' : '  '}Yes, proceed
          </Text>
          <Text color={sel === 1 ? colors.signature : undefined}>
            {sel === 1 ? '❯ ' : '  '}No, exit
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>↑↓ to select · Enter to confirm</Text>
      </Box>
    </Box>
  );
}

function TranscriptView({
  history,
  onClose,
}: {
  history: DisplayItem[];
  onClose: () => void;
}) {
  const colors = getColors();
  useInput(() => onClose());
  const tools = history.filter((it) => it.kind === 'tool_call') as Extract<
    DisplayItem,
    { kind: 'tool_call' }
  >[];
  return (
    <Box flexDirection="column" marginY={1}>
      <Box borderStyle="round" borderColor={colors.signature} paddingX={1}>
        <Text bold>Transcript · tool calls ({tools.length})</Text>
      </Box>
      {tools.length === 0 ? (
        <Box paddingX={1} marginTop={1}>
          <Text dimColor>아직 도구 호출이 없습니다.</Text>
        </Box>
      ) : (
        tools.map((t, i) => (
          <Box key={t.id + i} flexDirection="column" paddingX={1} marginTop={1}>
            <Box>
              <Text color={t.ok === false ? 'red' : colors.signature} bold>
                {t.ok === false ? '✗ ' : '⏺ '}
              </Text>
              <Text bold>{t.name}</Text>
            </Box>
            <Box paddingLeft={2}>
              <Text dimColor>
                input: {JSON.stringify(t.input).slice(0, 200)}
              </Text>
            </Box>
            {t.result ? (
              <Box paddingLeft={2}>
                <Text dimColor>result: {t.result.slice(0, 400)}</Text>
              </Box>
            ) : (
              <Box paddingLeft={2}>
                <Text dimColor>result: (없음)</Text>
              </Box>
            )}
          </Box>
        ))
      )}
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>아무 키나 눌러 닫기</Text>
      </Box>
    </Box>
  );
}

function HistorySearch({
  history,
  onSelect,
  onCancel,
}: {
  history: string[];
  onSelect: (v: string) => void;
  onCancel: () => void;
}) {
  const colors = getColors();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const matches = query
    ? history.filter((h) => h.toLowerCase().includes(query.toLowerCase())).reverse()
    : [...history].reverse();
  const shown = matches.slice(0, 8);

  useInput((inputChar, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.return) {
      if (shown.length > 0) onSelect(shown[Math.min(sel, shown.length - 1)]);
      else onCancel();
      return;
    }
    if (key.upArrow) { setSel((x) => Math.max(0, x - 1)); return; }
    if (key.downArrow) { setSel((x) => Math.min(shown.length - 1, x + 1)); return; }
    if (key.backspace || key.delete) { setQuery((q) => q.slice(0, -1)); setSel(0); return; }
    if (inputChar && !key.ctrl && !key.meta) { setQuery((q) => q + inputChar); setSel(0); }
  });

  return (
    <Box flexDirection="column" marginY={1}>
      <Box borderStyle="round" borderColor={colors.signature} paddingX={1}>
        <Text bold>{'⌕ '}history search: </Text>
        <Text>{query}</Text>
        <Text color={colors.signature}>{'█'}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingX={1}>
        {shown.length === 0 ? (
          <Text dimColor>일치하는 입력이 없습니다.</Text>
        ) : (
          shown.map((h, i) => (
            <Text key={i} color={i === sel ? colors.signature : undefined}>
              {i === sel ? '❯ ' : '  '}
              {h.replace(/\n/g, ' ').slice(0, 70)}
            </Text>
          ))
        )}
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>↑↓ select · Enter confirm · Esc cancel</Text>
      </Box>
    </Box>
  );
}

function RewindView({
  messages,
  onRewind,
  onCancel,
}: {
  messages: Message[];
  onRewind: (userMsgIndex: number) => void;
  onCancel: () => void;
}) {
  const colors = getColors();
  const userTurns = messages
    .map((m, i) => ({ m, i }))
    .filter((x) => x.m.role === 'user');
  const [sel, setSel] = useState(Math.max(0, userTurns.length - 1));

  useInput((_inputChar, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.upArrow) { setSel((x) => Math.max(0, x - 1)); return; }
    if (key.downArrow) { setSel((x) => Math.min(userTurns.length - 1, x + 1)); return; }
    if (key.return) {
      if (userTurns.length > 0) onRewind(userTurns[sel].i);
      else onCancel();
    }
  });

  return (
    <Box flexDirection="column" marginY={1}>
      <Box borderStyle="round" borderColor={colors.signature} paddingX={1}>
        <Text bold>{'⏪ '}Rewind · 되돌릴 지점 선택</Text>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingX={1}>
        {userTurns.length === 0 ? (
          <Text dimColor>되돌릴 대화가 없습니다.</Text>
        ) : (
          userTurns.map((x, i) => {
            const text = String(x.m.content ?? '').replace(/\n/g, ' ').slice(0, 60);
            return (
              <Text key={i} color={i === sel ? colors.signature : undefined}>
                {i === sel ? '❯ ' : '  '}
                {String(i + 1).padStart(2)}. {text}
              </Text>
            );
          })
        )}
      </Box>
      <Box marginTop={1} paddingX={1} flexDirection="column">
        <Text dimColor>선택한 지점 이후의 대화가 삭제됩니다 (파일은 복구되지 않음)</Text>
        <Text dimColor>↑↓ select · Enter rewind · Esc cancel</Text>
      </Box>
    </Box>
  );
}

function App({ initialSession }: { initialSession?: Session | null }) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<DisplayItem[]>(() => {
    if (!initialSession) return [];
    return (initialSession.messages || []).map((m: any) =>
      m.role === 'user'
        ? { kind: 'user', text: String(m.content ?? '') }
        : { kind: 'assistant', text: String(m.content ?? ''), provider: getProvider() },
    ) as DisplayItem[];
  });
  const [messages, setMessages] = useState<Message[]>(() => (initialSession?.messages as Message[]) ?? []);
  const [busy, setBusy] = useState(false);
  const [busyStart, setBusyStart] = useState<number>(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [mode, setModeState] = useState<PermissionMode>(getMode());
  const [modeChanged, setModeChanged] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRewind, setShowRewind] = useState(false);
  const lastEscRef = React.useRef<number>(0);
  const lastCtrlCRef = React.useRef<number>(0);
  const [ctrlCHint, setCtrlCHint] = useState(false);
  const [pending, setPending] = useState<ApprovalRequest | null>(null);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [sessionId] = useState<string>(() => newSessionId());
  const [provider, setProviderState] = useState(getProvider());
  const [, setUsageTick] = useState(0);
  const [config, setConfig] = useState(() => loadConfig());
  const [wizardDone, setWizardDone] = useState(false);
  const [trusted, setTrusted] = useState<boolean>(() => loadConfig().trusted === true);

  useEffect(() => {
    if (config.configured) {
      setThemeMode(config.theme);
      setProvider(config.backend);
      setOllamaModel(config.ollamaModel);
      setProviderState(config.backend);
      setWizardDone(true);
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const session: Session = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cwd: process.cwd(),
      messages: messages as SessionMessage[],
      inputHistory,
    };
    saveSession(session).catch(() => {});
  }, [messages]);

  const saveAndExit = async () => {
    if (messages.length > 0) {
      const session: Session = {
        id: sessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cwd: process.cwd(),
        messages: messages as SessionMessage[],
        inputHistory,
      };
      try { await saveSession(session); } catch {}
    }
    exit();
    process.exit(0);
  };

  useInput(
    (inputChar, key) => {
      if (pending) {
        if (inputChar === 'y' || key.return) {
          answerApproval(pending.id, 'yes');
          setPending(null);
        } else if (inputChar === 'n' || key.escape) {
          answerApproval(pending.id, 'no');
          setPending(null);
        } else if (inputChar === 'a') {
          answerApproval(pending.id, 'always');
          setPending(null);
        }
        return;
      }
      if (key.ctrl && inputChar === 'c') {
        const now = Date.now();
        if (now - lastCtrlCRef.current < 2000) {
          void saveAndExit();
        } else {
          lastCtrlCRef.current = now;
          setCtrlCHint(true);
          setTimeout(() => setCtrlCHint(false), 2000);
        }
        return;
      }
      if (key.ctrl && inputChar === 'o') {
        setShowTranscript(true);
        return;
      }
      if (key.ctrl && inputChar === 'r') {
        setShowSearch(true);
        return;
      }
      if (key.shift && key.tab) {
        const next = cycleMode();
        setModeState(next);
        setModeChanged(true);
        setTimeout(() => setModeChanged(false), 2500);
      }
    },
    { isActive: pending !== null || !busy },
  );

  useInput(
    (_inputChar, key) => {
      if (key.escape && busy && abortController) {
        abortController.abort();
      }
    },
    { isActive: busy && abortController !== null },
  );

  useInput(
    (_inputChar, key) => {
      if (key.escape) {
        const now = Date.now();
        if (now - lastEscRef.current < 500) {
          lastEscRef.current = 0;
          setShowRewind(true);
        } else {
          lastEscRef.current = now;
        }
      }
    },
    { isActive: !busy && !pending && !showTranscript && !showSearch && !showRewind },
  );

  useEffect(() => {
    const onTool = (ev: ToolEvent) => {
      if (ev.kind === 'tool_call') {
        setHistory((h) => [
          ...h,
          { kind: 'tool_call', id: ev.id, name: ev.name, input: ev.input },
        ]);
      } else if (ev.kind === 'diff') {
        setHistory((h) => [...h, { kind: 'diff', id: ev.id, filePath: ev.filePath, oldText: ev.oldText, newText: ev.newText }]);
      } else {
        setHistory((h) =>
          h.map((it) =>
            it.kind === 'tool_call' && it.id === ev.id
              ? { ...it, result: ev.summary, ok: ev.ok }
              : it,
          ),
        );
      }
    };
    const onApprovalRequest = (req: ApprovalRequest) => {
      setPending(req);
    };
    bus.on('tool', onTool);
    approvalBus.on('request', onApprovalRequest);
    return () => {
      bus.off('tool', onTool);
      approvalBus.off('request', onApprovalRequest);
    };
  }, []);

  const doRewind = (userMsgIndex: number) => {
    const trimmedMsgs = messages.slice(0, userMsgIndex);
    setMessages(trimmedMsgs);
    const rebuilt: DisplayItem[] = [];
    for (const m of trimmedMsgs) {
      if (m.role === 'user') rebuilt.push({ kind: 'user', text: String(m.content ?? '') });
      else if (m.role === 'assistant') rebuilt.push({ kind: 'assistant', text: String(m.content ?? ''), provider: getProvider() });
    }
    setHistory(rebuilt);
    setShowRewind(false);
  };

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;

    setInputHistory((h) => {
      if (h.length > 0 && h[h.length - 1] === trimmed) return h;
      const next = [...h, trimmed];
      return next.length > 100 ? next.slice(next.length - 100) : next;
    });

    if (trimmed.startsWith('!')) {
      const command = trimmed.slice(1).trim();
      if (!command) { setInput(''); return; }
      setHistory((h) => [...h, { kind: 'user', text: trimmed }]);
      setInput('');
      setBusy(true); setBusyStart(Date.now());
      const ac = new AbortController(); setAbortController(ac);
      const id = Date.now().toString();
      const proc = spawn('bash', ['-c', command], { cwd: process.cwd() });
      ac.signal.addEventListener('abort', () => proc.kill('SIGTERM'));
      let stdout = ''; let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        const output = (stdout + stderr).slice(0, 5000);
        const lines = output.split('\n').length;
        setHistory((h) => [...h, {
          kind: 'tool_call', id, name: 'bash', input: { command },
          result: `exit ${code} · ${lines} lines\n${output}`, ok: code === 0,
        }]);
        setBusy(false);
        setAbortController(null);
      });
      return;
    }

    if (trimmed === '/exit' || trimmed === '/quit') { void saveAndExit(); return; }
    if (trimmed === '/clear') {
      setHistory([]); setMessages([]); resetUsage();
      setUsageTick((t) => t + 1); setInput('');
      return;
    }
    if (trimmed === '/help') {
      setHistory((h) => [
        ...h,
        { kind: 'user', text: trimmed },
        { kind: 'info', text:
          '슬래시 명령:\n' +
          '  /help            도움말\n' +
          '  /clear           대화 초기화\n' +
          '  /init            프로젝트 분석 후 CLAUDE.md 생성\n' +
          '  /model [name]    모델 전환 (gemini/groq)\n' +
          '  /memory          CLAUDE.md 재로드\n' +
          '  /cost            토큰 사용량 보기\n' +
          '  /exit            종료\n\n' +
          '메시지 안에서:\n' +
          '  @경로/파일       파일 자동 첨부\n' +
          '  !명령            bash 직접 실행\n\n' +
          '단축키:\n' +
          '  Shift+Tab        모드 전환\n' +
          '  y/n/a            승인 프롬프트 응답' },
      ]);
      setInput('');
      return;
    }
    if (trimmed === '/cost') {
      const byProv = getUsageByProvider();
      const lines: string[] = [];
      let totalUsd = 0;
      const provs = Object.entries(byProv);
      if (provs.length === 0) {
        lines.push('아직 사용량이 없습니다.');
      } else {
        lines.push('세션 사용량:');
        for (const [prov, uu] of provs) {
          const cost = estimateCost(prov, uu);
          totalUsd += cost;
          lines.push(
            '  ' + prov.padEnd(8) +
            '  in:' + formatTokensCompact(uu.inputTokens).padStart(6) +
            '  out:' + formatTokensCompact(uu.outputTokens).padStart(6) +
            '  total:' + formatTokensCompact(uu.totalTokens).padStart(6) +
            '  turns:' + String(uu.turns).padStart(3) +
            '   ' + formatCost(cost)
          );
        }
        lines.push('  ─────────────────────────────');
        lines.push('  Total: ' + formatCost(totalUsd));
      }
      setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: lines.join('\n') }]);
      setInput('');
      return;
    }
    if (trimmed === '/context') {
      const uu = getUsage();
      const CONTEXT_SIZE = 1_000_000;
      const used = uu.totalTokens;
      const pct = Math.min(100, (used / CONTEXT_SIZE) * 100);
      const filled = Math.round((pct / 100) * 30);
      const bar = '█'.repeat(filled) + '░'.repeat(30 - filled);
      const lines = [
        'Context Usage',
        '',
        '  [' + bar + '] ' + pct.toFixed(1) + '%',
        '',
        '  used:      ' + formatTokensCompact(used) + ' tokens',
        '  remaining: ' + formatTokensCompact(CONTEXT_SIZE - used) + ' tokens',
        '  window:    ' + formatTokensCompact(CONTEXT_SIZE) + ' tokens',
        '  turns:     ' + String(uu.turns),
      ];
      setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: lines.join('\n') }]);
      setInput('');
      return;
    }
    if (trimmed === '/setup') {
      setWizardDone(false);
      setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '시작 위저드를 다시 띄웁니다...' }]);
      setInput('');
      return;
    }
    if (trimmed.startsWith('/theme')) {
      const arg = trimmed.split(/\s+/)[1];
      if (!arg) {
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `사용법: /theme light | dark | auto` }]);
      } else if (arg === 'light' || arg === 'dark' || arg === 'auto') {
        setThemeMode(arg); saveConfig({ theme: arg });
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `테마 변경: ${getThemeLabel(arg)}` }]);
      } else {
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'error', text: `알 수 없는 테마: ${arg}` }]);
      }
      setInput('');
      return;
    }
    if (trimmed.startsWith('/backend') || trimmed.startsWith('/model')) {
      const arg = trimmed.split(/\s+/)[1];
      if (!arg) {
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `현재: ${getProvider()}\n사용법: gemini | groq | ollama` }]);
      } else if (arg === 'auto' || arg === 'flash' || arg === 'pro') {
        const gm = arg === 'auto' ? 'auto' : arg === 'flash' ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
        setGeminiModel(gm);
        if (getProvider() !== 'gemini') { setProvider('gemini'); setProviderState('gemini'); saveConfig({ backend: 'gemini' }); }
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: arg === 'auto' ? 'Gemini 모델: auto (복잡도에 따라 flash/pro 자동 선택)' : `Gemini 모델: ${gm}` }]);
      } else if (arg === 'gemini' || arg === 'groq' || arg === 'ollama' || arg === 'manual') {
        setProvider(arg); setProviderState(arg); saveConfig({ backend: arg as any });
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `모델 전환: ${arg}` }]);
      } else {
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'error', text: `알 수 없는 모델: ${arg}` }]);
      }
      setInput('');
      return;
    }
    if (trimmed.startsWith('/ollama-model')) {
      const arg = trimmed.split(/\s+/).slice(1).join(' ').trim();
      if (!arg) {
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `현재 Ollama 모델: ${getOllamaModel()}` }]);
      } else {
        setOllamaModel(arg); saveConfig({ ollamaModel: arg });
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `Ollama 모델 변경: ${arg}` }]);
      }
      setInput('');
      return;
    }
    if (trimmed === '/memory') {
      clearSystemCache();
      setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: 'CLAUDE.md 재로드 완료' }]);
      setInput('');
      return;
    }
    if (trimmed === '/sessions') {
      const all = await listSessions();
      if (all.length === 0) {
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '저장된 세션이 없습니다.' }]);
      } else {
        const groups = groupByCwd(all);
        const blocks: string[] = [];
        for (const [dir, sess] of groups) {
          const home = process.env.HOME || '';
          const shortDir = home && dir.startsWith(home) ? '~' + dir.slice(home.length) : dir;
          const rows = sess.slice(0, 20).map((x) => '   ' + summarizeSession(x)).join('\n');
          blocks.push('\uD83D\uDCC1 ' + shortDir + '\n' + rows);
        }
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `최근 세션 (${groups.size}개 폴더):\n\n${blocks.join('\n\n')}\n\n복원: /resume <id>` }]);
      }
      setInput('');
      return;
    }
    if (trimmed.startsWith('/delete')) {
      const arg = trimmed.split(/\s+/)[1];
      if (!arg) {
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'error', text: '사용법: /delete <id>' }]);
        setInput('');
        return;
      }
      const ok = await deleteSession(arg);
      setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: ok ? 'info' : 'error', text: ok ? `\u2713 세션 삭제됨: ${arg}` : `세션을 찾을 수 없습니다: ${arg}` }]);
      setInput('');
      return;
    }
    if (trimmed.startsWith('/resume')) {
      const arg = trimmed.split(/\s+/)[1];
      const target = arg ? await loadSession(arg) : await loadLatest();
      if (!target) {
        setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'error', text: arg ? `세션을 찾을 수 없습니다: ${arg}` : '복원할 세션이 없습니다.' }]);
        setInput('');
        return;
      }
      if (target.cwd) { try { process.chdir(target.cwd); } catch {} }
      setMessages(target.messages as Message[]);
      setInputHistory(target.inputHistory ?? []);
      setHistory([
        { kind: 'info', text: `✓ 세션 복원: ${target.id} (${target.messages.length}개 메시지)` },
        ...target.messages.map((m) =>
          m.role === 'user'
            ? ({ kind: 'user', text: m.content } as DisplayItem)
            : ({ kind: 'assistant', text: m.content, provider: getProvider() } as DisplayItem),
        ),
      ]);
      setInput('');
      return;
    }
    if (trimmed === '/init') {
      setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '프로젝트 분석 중... CLAUDE.md 생성합니다.' }]);
      setInput('');
      setBusy(true); setBusyStart(Date.now());
      try {
        const result = await runInit();
        if (result.ok) {
          clearSystemCache();
          setHistory((h) => [...h, { kind: 'info', text: `✓ ${result.message}` }]);
        } else {
          setHistory((h) => [...h, { kind: 'error', text: result.message }]);
        }
      } catch (err: any) {
        setHistory((h) => [...h, { kind: 'error', text: err?.message ?? String(err) }]);
      } finally {
        setBusy(false); setUsageTick((t) => t + 1); invalidateFileCache();
      }
      return;
    }

    setInput('');
    setBusy(true); setBusyStart(Date.now());

    const expansion = await expandMentions(trimmed);
    const userContent = buildMessageWithAttachments(expansion);
    const newMessages: Message[] = [...messages, { role: 'user', content: userContent }];

    let displayText = trimmed;
    if (expansion.attachments.length > 0) {
      const files = expansion.attachments.map((a) => (a.error ? `@${a.path} (에러)` : `@${a.path}`)).join(', ');
      displayText = `${trimmed}\n  ⎿ 첨부: ${files}`;
    }
    setHistory((h) => [...h, { kind: 'user', text: displayText }]);

    try {
      const ac = new AbortController(); setAbortController(ac);
      const { text: reply, usedProvider } = await chat(newMessages, ac.signal);
      const provNow = usedProvider;
      setProviderState(provNow);
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
      let typeIdx = -1;
      setHistory((h) => { typeIdx = h.length; return [...h, { kind: 'assistant', text: '', provider: provNow }]; });
      await new Promise<void>((resolve) => {
        let i = 0;
        const SPEED = 6;
        const INTERVAL = 15;
        const timer = setInterval(() => {
          i += SPEED;
          const done = i >= reply.length;
          const slice = done ? reply : reply.slice(0, i);
          setHistory((h) => {
            if (typeIdx < 0) return h;
            const item = h[typeIdx];
            if (!item || item.kind !== 'assistant') return h;
            const nh = [...h];
            nh[typeIdx] = { ...item, text: slice };
            return nh;
          });
          if (done) { clearInterval(timer); resolve(); }
        }, INTERVAL);
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || String(err?.message ?? '').includes('aborted')) {
        setHistory((h) => [...h, { kind: 'info', text: '⎿  중단됨 (esc)' }]);
      } else {
        setHistory((h) => [...h, { kind: 'error', text: err?.message ?? String(err) }]);
      }
    } finally {
      setBusy(false); setAbortController(null); setUsageTick((t) => t + 1); invalidateFileCache();
    }
  };

  const u = getUsage();
  const ctxPct = contextPercent(u.totalTokens);
  const colors = getColors();
  const gm = getGeminiModel();
  const geminiSuffix =
    provider === 'gemini'
      ? gm === 'auto'
        ? (getGeminiRoute() ? ` · auto→${getGeminiRoute()}` : ' · auto')
        : ` · ${gm.replace('gemini-2.5-', '')}`
      : '';

  if (showRewind) {
    return (
      <RewindView
        messages={messages}
        onRewind={doRewind}
        onCancel={() => setShowRewind(false)}
      />
    );
  }
  if (showSearch) {
    return (
      <HistorySearch
        history={inputHistory}
        onSelect={(v) => {
          setInput(v);
          setShowSearch(false);
        }}
        onCancel={() => setShowSearch(false)}
      />
    );
  }
  if (showTranscript) {
    return <TranscriptView history={history} onClose={() => setShowTranscript(false)} />;
  }
  if (!trusted) {
    return (
      <TrustDialog
        onConfirm={() => {
          const cfg = loadConfig();
          saveConfig({ ...cfg, trusted: true });
          setConfig(loadConfig());
          setTrusted(true);
        }}
      />
    );
  }
  if (!wizardDone) {
    return (
      <StartupWizard
        onDone={(theme) => {
          setThemeMode(theme);
          saveConfig({ theme, backend: 'gemini', configured: true });
          setProvider('gemini');
          setProviderState('gemini');
          setConfig(loadConfig());
          setWizardDone(true);
        }}
      />
    );
  }
  return (
    <Box flexDirection="column">
      <Banner />

      {history.map((item, i) => {
        if (item.kind === 'user') {
          const lines = item.text.split('\n');
          return (
            <Box key={i} marginTop={1} flexDirection="column">
              <Box>
                <Text color="gray">{'> '}</Text>
                <Text>{lines[0]}</Text>
              </Box>
              {lines.slice(1).map((line, j) => (
                <Box key={j}><Text dimColor>{line}</Text></Box>
              ))}
            </Box>
          );
        }
        if (item.kind === 'assistant') {
          return (
            <Box key={i} marginTop={1} flexDirection="column">
              <Box>
                <Text color={colors.signature}>{'⏺ '}</Text>
                <Text>{item.text}</Text>
              </Box>
            </Box>
          );
        }
        if (item.kind === 'diff') {
          return (
            <Box key={i} marginTop={1}>
              <DiffView oldText={item.oldText} newText={item.newText} filePath={item.filePath} />
            </Box>
          );
        }
        if (item.kind === 'tool_call') {
          const arg = summarizeInput(item.name, item.input);
          const display = toolDisplayName(item.name);
          return (
            <Box key={i} marginTop={1} flexDirection="column">
              <Box>
                <Text color={item.ok === false ? 'red' : colors.signature}>{'⏺ '}</Text>
                <Text bold>{display}</Text>
                <Text dimColor>({arg})</Text>
              </Box>
              {item.result !== undefined && (() => {
                const lines = item.result.split('\n');
                const MAX = 4;
                const shown = lines.slice(0, MAX);
                const extra = lines.length - MAX;
                return (
                  <Box flexDirection="column">
                    {shown.map((ln, li) => (
                      <Box key={li}>
                        <Text color={item.ok === false ? 'red' : 'gray'}>
                          {li === 0 ? '  ⎿  ' : '     '}
                        </Text>
                        <Text color={item.ok === false ? 'red' : undefined} dimColor={item.ok !== false}>
                          {ln}
                        </Text>
                      </Box>
                    ))}
                    {extra > 0 && (
                      <Box>
                        <Text>{'     '}</Text>
                        <Text dimColor>… +{extra} lines (ctrl+o to expand)</Text>
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Box>
          );
        }
        if (item.kind === 'error') {
          return (
            <Box key={i} marginTop={1}>
              <Text color="red">{'⏺ '}</Text>
              <Text color="red">{item.text}</Text>
            </Box>
          );
        }
        return (
          <Box key={i} marginTop={1} flexDirection="column">
            {item.text.split('\n').map((line, j) => (
              <Box key={j}><Text dimColor>{line}</Text></Box>
            ))}
          </Box>
        );
      })}

      {pending && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
          <Box><Text color="yellow" bold>{'⚠ 승인 필요: '}</Text><Text bold>{pending.toolName}</Text></Box>
          <Box><Text>{pending.summary}</Text></Box>
          {pending.detail && (
            <Box marginTop={1} flexDirection="column">
              {pending.detail.split('\n').map((l, k) => (<Text key={k} dimColor>{l}</Text>))}
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="green">y</Text><Text dimColor>=승인  </Text>
            <Text color="red">n</Text><Text dimColor>=거부  </Text>
            <Text color="cyan">a</Text><Text dimColor>=세션 자동 승인</Text>
          </Box>
        </Box>
      )}

      {!pending && (
        <Box marginTop={1} borderStyle="round" borderColor={busy ? colors.signature : 'gray'} paddingX={1}>
          {busy ? (
            <Box><ClaudeSpinner startTime={busyStart} tokens={u.totalTokens} /></Box>
          ) : (
            <MentionInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="무엇을 도와드릴까요?"
              commands={SLASH_COMMANDS}
              history={inputHistory}
            />
          )}
        </Box>
      )}

      <Box paddingX={1}>
        <Text dimColor>{ctrlCHint ? '한 번 더 Ctrl+C를 누르면 종료됩니다' : '? for shortcuts'}</Text>
      </Box>

      <Box marginTop={1} paddingX={1}>
        <Text color={modeColor(mode)} bold={modeChanged}>⏵⏵ {modeLabel(mode)}{modeChanged ? '  ◄ shift+tab' : ''}</Text>
        <Text dimColor>{' · '}</Text>
        <Text color={colors.signature}>◆ {provider}{geminiSuffix}</Text>
        <Text dimColor>{' · '}</Text>
        <Text dimColor>📁 {path.basename(process.cwd())}</Text>
        <Text dimColor>{' · '}</Text>
        <Text dimColor>⚡ {formatTokens(u.totalTokens)} · {u.turns}t</Text>
      </Box>
    </Box>
  );
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  // 세션 목록 보기: claude sessions | claude --list
  if (cmd === 'delete') {
    const id = args[1];
    if (!id) { console.log('사용법: claude delete <id>'); process.exit(1); }
    const ok = await deleteSession(id);
    console.log(ok ? '\u2713 세션 삭제됨: ' + id : '세션을 찾을 수 없습니다: ' + id);
    process.exit(ok ? 0 : 1);
  }

  if (cmd === 'sessions' || cmd === '--list') {
    const all = await listSessions();
    if (all.length === 0) {
      console.log('저장된 세션이 없습니다.');
    } else {
      const groups = groupByCwd(all);
      console.log('저장된 세션 (' + groups.size + '개 폴더):\n');
      for (const [dir, sess] of groups) {
        const home = process.env.HOME || '';
        const shortDir = home && dir.startsWith(home) ? '~' + dir.slice(home.length) : dir;
        console.log('\uD83D\uDCC1 ' + shortDir);
        for (const x of sess) console.log('   ' + summarizeSession(x));
        console.log('');
      }
      console.log('이어서 시작: claude resume <id>');
    }
    process.exit(0);
  }

  // 세션 이어서 시작: claude resume [id] | claude --continue
  let initialSession = null;
  if (cmd === 'resume' || cmd === '--continue' || cmd === '-c') {
    const id = args[1];
    initialSession = id ? await loadSession(id) : await loadLatest();
    if (initialSession && initialSession.cwd) { try { process.chdir(initialSession.cwd); } catch {} }
    if (!initialSession) {
      console.log(id ? `세션을 찾을 수 없습니다: ${id}` : '이어서 시작할 세션이 없습니다.');
      process.exit(1);
    }
    console.log(`세션 복원: ${initialSession.id} (${initialSession.messages.length}개 메시지)`);
  }

  render(<App initialSession={initialSession} />, { exitOnCtrlC: false });
}

main();
