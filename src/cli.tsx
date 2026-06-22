#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { chat, getProvider } from './llm/client.js';
import {
  getMode,
  cycleMode,
  modeLabel,
  modeColor,
  PermissionMode,
} from './permissions/mode.js';
import { bus, ToolEvent } from './ui/events.js';
import {
  approvalBus,
  answerApproval,
  ApprovalRequest,
} from './permissions/prompt.js';

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
    };

function summarizeInput(name: string, input: any): string {
  if (name === 'read_file') return input?.path ?? '';
  if (name === 'write_file')
    return `${input?.path ?? ''} (${input?.bytes ?? 0} bytes)`;
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


function App() {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<DisplayItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setModeState] = useState<PermissionMode>(getMode());
  const [pending, setPending] = useState<ApprovalRequest | null>(null);

  // Shift+Tab 모드 순환 + 승인 키 처리
  useInput((inputChar, key) => {
    if (pending) {
      if (inputChar === 'y' || key.return) {
        answerApproval(pending.id, 'yes');
        setHistory((h) => [
          ...h,
          { kind: 'info', text: `✓ 승인: ${pending.toolName}` },
        ]);
        setPending(null);
      } else if (inputChar === 'n' || key.escape) {
        answerApproval(pending.id, 'no');
        setHistory((h) => [
          ...h,
          { kind: 'info', text: `✗ 거부: ${pending.toolName}` },
        ]);
        setPending(null);
      } else if (inputChar === 'a') {
        answerApproval(pending.id, 'always');
        setHistory((h) => [
          ...h,
          {
            kind: 'info',
            text: `✓ 세션 자동 승인 활성: ${pending.toolName}`,
          },
        ]);
        setPending(null);
      }
      return;
    }
    if (key.shift && key.tab) {
      const next = cycleMode();
      setModeState(next);
      setHistory((h) => [
        ...h,
        { kind: 'info', text: `⏵ 모드 변경: ${modeLabel(next)}` },
      ]);
    }
  });

  // 도구 이벤트 구독
  useEffect(() => {
    const onTool = (ev: ToolEvent) => {
      if (ev.kind === 'tool_call') {
        setHistory((h) => [
          ...h,
          {
            kind: 'tool_call',
            id: ev.id,
            name: ev.name,
            input: ev.input,
          },
        ]);
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

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;

    if (trimmed === '/exit' || trimmed === '/quit') {
      exit();
      return;
    }
    if (trimmed === '/clear') {
      setHistory([]);
      setMessages([]);
      setInput('');
      return;
    }
    if (trimmed === '/help') {
      setHistory((h) => [
        ...h,
        { kind: 'user', text: trimmed },
        {
          kind: 'info',
          text:
            '슬래시 명령:\n  /help   도움말\n  /clear  대화 초기화\n  /exit   종료\n\n단축키:\n  Shift+Tab  모드 전환 (default → accept edits → plan)\n  y/n/a      승인 프롬프트 응답 (a = 세션 자동 승인)',
        },
      ]);
      setInput('');
      return;
    }

    setInput('');
    setBusy(true);

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: trimmed },
    ];
    setHistory((h) => [...h, { kind: 'user', text: trimmed }]);

    try {
      const reply = await chat(newMessages);
      const provider = getProvider();
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
      setHistory((h) => [
        ...h,
        { kind: 'assistant', text: reply, provider },
      ]);
    } catch (err: any) {
      setHistory((h) => [
        ...h,
        { kind: 'error', text: err?.message ?? String(err) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* 헤더 */}
      <Box>
        <Text color="cyan" bold>
          ✦ gem{' '}
        </Text>
        <Text dimColor>v0.0.1 </Text>
        <Text color="yellow">[{getProvider()}] </Text>
        <Text color={modeColor(mode)}>⏵ {modeLabel(mode)}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          /help 도움말 · /clear 초기화 · /exit 종료 · Shift+Tab 모드 전환
        </Text>
      </Box>

      {/* 대화 기록 */}
      {history.map((item, i) => {
        if (item.kind === 'user') {
          return (
            <Box key={i} marginTop={1}>
              <Text color="green" bold>{'> '}</Text>
              <Text>{item.text}</Text>
            </Box>
          );
        }
        if (item.kind === 'assistant') {
          return (
            <Box key={i} marginTop={1} flexDirection="column">
              <Text color="cyan" bold>
                ✦ gem <Text dimColor>[{item.provider}]</Text>
              </Text>
              <Text>{item.text}</Text>
            </Box>
          );
        }
        if (item.kind === 'tool_call') {
          const arg = summarizeInput(item.name, item.input);
          return (
            <Box key={i} marginTop={1} flexDirection="column">
              <Box>
                <Text color={item.ok === false ? 'red' : 'magenta'}>● </Text>
                <Text bold>{item.name}</Text>
                <Text dimColor>({arg})</Text>
              </Box>
              {item.result !== undefined && (
                <Box marginLeft={2}>
                  <Text dimColor>⎿  {item.result}</Text>
                </Box>
              )}
            </Box>
          );
        }
        if (item.kind === 'error') {
          return (
            <Box key={i} marginTop={1}>
              <Text color="red">✗ {item.text}</Text>
            </Box>
          );
        }
        return (
          <Box key={i} marginTop={1}>
            <Text dimColor>{item.text}</Text>
          </Box>
        );
      })}

      {/* 승인 프롬프트 */}
      {pending && (
        <Box
          marginTop={1}
          flexDirection="column"
          borderStyle="round"
          borderColor="yellow"
          paddingX={1}
        >
          <Box>
            <Text color="yellow" bold>
              ⚠ 승인 필요:{' '}
            </Text>
            <Text bold>{pending.toolName}</Text>
          </Box>
          <Box>
            <Text>{pending.summary}</Text>
          </Box>
          {pending.detail && (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>{pending.detail}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text>
              <Text color="green">y</Text>=승인{'  '}
              <Text color="red">n</Text>=거부{'  '}
              <Text color="cyan">a</Text>=세션 동안 자동 승인
            </Text>
          </Box>
        </Box>
      )}

      {/* 입력창 / 로딩 */}
      {!pending && (
        <Box marginTop={1}>
          {busy ? (
            <Text color="yellow">
              <Spinner type="dots" /> 생각 중...
            </Text>
          ) : (
            <>
              <Text color="green" bold>{'> '}</Text>
              <TextInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                placeholder="메시지를 입력하세요 (/help)"
              />
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

render(<App />);
