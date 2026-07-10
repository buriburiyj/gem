#!/usr/bin/env node
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import path from 'node:path';
import { chat, getProvider, setProvider, clearSystemCache, } from './llm/client.js';
import { spawn } from 'node:child_process';
import { getUsage, getUsageByProvider, resetUsage, estimateCost, formatCost, formatTokensCompact } from './llm/usage.js';
import { getMode, cycleMode, modeLabel, modeColor, } from './permissions/mode.js';
import { bus } from './ui/events.js';
import { ClaudeSpinner } from './ui/spinner.js';
import { DiffView } from './ui/diff.js';
import { approvalBus, answerApproval, } from './permissions/prompt.js';
import { expandMentions, buildMessageWithAttachments, } from './context/mentions.js';
import { runInit } from './commands/init.js';
import { MentionInput, invalidateFileCache } from './ui/MentionInput.js';
import { newSessionId, saveSession, loadLatest, loadSession, deleteSession, listSessions, groupByCwd, summarizeSession, } from './session/store.js';
import { StartupWizard } from './ui/StartupWizard.js';
import { loadConfig, saveConfig } from './config/store.js';
import { setThemeMode, getColors, getThemeLabel } from './ui/theme.js';
import { setOllamaModel, getOllamaModel } from './llm/client.js';
import { setGeminiModel, getGeminiModel, getGeminiRoute } from './llm/client.js';
import { getMcpStatus, loadMcpTools, addMcpServer, removeMcpServer, listMcpConfig } from './tools/mcp.js';
import { scanSkills, findSkill } from './tools/skills.js';
const SLASH_COMMANDS = [
    { name: 'help', description: '도움말 표시' },
    { name: 'clear', description: '대화 초기화' },
    { name: 'compact', description: '대화를 요약해 토큰 절약' },
    { name: 'mcp', description: '연결된 MCP 서버·툴 목록' },
    { name: 'skills', description: '사용 가능한 스킬 목록' },
    { name: 'skill', description: '스킬 실행: /skill run <이름>' },
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
function summarizeInput(name, input) {
    if (name === 'skill')
        return input?.name ?? '';
    if (name === 'web_search')
        return input?.query ?? '';
    if (name === 'read_file')
        return input?.path ?? '';
    if (name === 'write_file')
        return input?.path ?? '';
    if (name === 'edit_file')
        return input?.path ?? '';
    if (name === 'bash')
        return input?.command ?? '';
    if (name === 'glob')
        return input?.pattern ?? '';
    if (name === 'grep') {
        const p = input?.pattern ?? '';
        const g = input?.glob ? ` in ${input.glob}` : '';
        return `"${p}"${g}`;
    }
    if (name === 'ls')
        return input?.path ?? '.';
    try {
        return JSON.stringify(input);
    }
    catch {
        return '';
    }
}
function toolDisplayName(name) {
    const map = {
        read_file: 'Read',
        web_search: 'Web Search',
        write_file: 'Write',
        edit_file: 'Edit',
        bash: 'Bash',
        glob: 'Glob',
        grep: 'Grep',
        ls: 'List',
        skill: 'Skill',
    };
    return map[name] ?? name;
}
function formatTokens(n) {
    if (n < 1000)
        return `${n}`;
    if (n < 1_000_000)
        return `${(n / 1000).toFixed(1)}k`;
    return `${(n / 1_000_000).toFixed(2)}M`;
}
function contextPercent(totalTokens) {
    const CONTEXT_SIZE = 1_000_000;
    return Math.min(100, Math.floor((totalTokens / CONTEXT_SIZE) * 100));
}
function Banner() {
    const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
    const colors = getColors();
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: colors.signature, paddingX: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: colors.signature, bold: true, children: '✳ ' }), _jsx(Text, { bold: true, children: "Welcome to Claude Code" })] }), _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { dimColor: true, children: cwd }) })] }), _jsxs(Box, { marginTop: 1, paddingX: 1, flexDirection: "column", children: [_jsx(Text, { color: colors.signature, bold: true, children: "Tips for getting started" }), _jsx(Text, { dimColor: true, children: "Ask Claude to create a new app or edit files" })] }), _jsx(Box, { marginTop: 1, paddingX: 1, children: _jsx(Text, { dimColor: true, children: "? for shortcuts" }) })] }));
}
function TrustDialog({ onConfirm }) {
    const colors = getColors();
    const [sel, setSel] = useState(0);
    const cwd = process.cwd();
    useInput((_input, key) => {
        if (key.upArrow || key.downArrow)
            setSel((s) => (s === 0 ? 1 : 0));
        if (key.return) {
            if (sel === 0)
                onConfirm();
            else
                process.exit(0);
        }
    });
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: colors.signature, paddingX: 2, paddingY: 1, children: [_jsx(Text, { bold: true, children: "Do you trust the files in this folder?" }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: colors.signature, children: cwd }) }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Claude Code may read, write, and execute files" }), _jsx(Text, { dimColor: true, children: "in this folder. Only proceed if you trust it." })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: sel === 0 ? colors.signature : undefined, children: [sel === 0 ? '❯ ' : '  ', "Yes, proceed"] }), _jsxs(Text, { color: sel === 1 ? colors.signature : undefined, children: [sel === 1 ? '❯ ' : '  ', "No, exit"] })] })] }), _jsx(Box, { marginTop: 1, paddingX: 1, children: _jsx(Text, { dimColor: true, children: "\u2191\u2193 to select \u00B7 Enter to confirm" }) })] }));
}
function TranscriptView({ history, onClose, }) {
    const colors = getColors();
    useInput(() => onClose());
    const tools = history.filter((it) => it.kind === 'tool_call');
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Box, { borderStyle: "round", borderColor: colors.signature, paddingX: 1, children: _jsxs(Text, { bold: true, children: ["Transcript \u00B7 tool calls (", tools.length, ")"] }) }), tools.length === 0 ? (_jsx(Box, { paddingX: 1, marginTop: 1, children: _jsx(Text, { dimColor: true, children: "\uC544\uC9C1 \uB3C4\uAD6C \uD638\uCD9C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }) })) : (tools.map((t, i) => (_jsxs(Box, { flexDirection: "column", paddingX: 1, marginTop: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: t.ok === false ? 'red' : colors.signature, bold: true, children: t.ok === false ? '✗ ' : '⏺ ' }), _jsx(Text, { bold: true, children: t.name })] }), _jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { dimColor: true, children: ["input: ", JSON.stringify(t.input).slice(0, 200)] }) }), t.result ? (_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { dimColor: true, children: ["result: ", t.result.slice(0, 400)] }) })) : (_jsx(Box, { paddingLeft: 2, children: _jsx(Text, { dimColor: true, children: "result: (\uC5C6\uC74C)" }) }))] }, t.id + i)))), _jsx(Box, { marginTop: 1, paddingX: 1, children: _jsx(Text, { dimColor: true, children: "\uC544\uBB34 \uD0A4\uB098 \uB20C\uB7EC \uB2EB\uAE30" }) })] }));
}
function HistorySearch({ history, onSelect, onCancel, }) {
    const colors = getColors();
    const [query, setQuery] = useState('');
    const [sel, setSel] = useState(0);
    const matches = query
        ? history.filter((h) => h.toLowerCase().includes(query.toLowerCase())).reverse()
        : [...history].reverse();
    const shown = matches.slice(0, 8);
    useInput((inputChar, key) => {
        if (key.escape) {
            onCancel();
            return;
        }
        if (key.return) {
            if (shown.length > 0)
                onSelect(shown[Math.min(sel, shown.length - 1)]);
            else
                onCancel();
            return;
        }
        if (key.upArrow) {
            setSel((x) => Math.max(0, x - 1));
            return;
        }
        if (key.downArrow) {
            setSel((x) => Math.min(shown.length - 1, x + 1));
            return;
        }
        if (key.backspace || key.delete) {
            setQuery((q) => q.slice(0, -1));
            setSel(0);
            return;
        }
        if (inputChar && !key.ctrl && !key.meta) {
            setQuery((q) => q + inputChar);
            setSel(0);
        }
    });
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { borderStyle: "round", borderColor: colors.signature, paddingX: 1, children: [_jsxs(Text, { bold: true, children: ['⌕ ', "history search: "] }), _jsx(Text, { children: query }), _jsx(Text, { color: colors.signature, children: '█' })] }), _jsx(Box, { flexDirection: "column", marginTop: 1, paddingX: 1, children: shown.length === 0 ? (_jsx(Text, { dimColor: true, children: "\uC77C\uCE58\uD558\uB294 \uC785\uB825\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." })) : (shown.map((h, i) => (_jsxs(Text, { color: i === sel ? colors.signature : undefined, children: [i === sel ? '❯ ' : '  ', h.replace(/\n/g, ' ').slice(0, 70)] }, i)))) }), _jsx(Box, { marginTop: 1, paddingX: 1, children: _jsx(Text, { dimColor: true, children: "\u2191\u2193 select \u00B7 Enter confirm \u00B7 Esc cancel" }) })] }));
}
function RewindView({ messages, onRewind, onCancel, }) {
    const colors = getColors();
    const userTurns = messages
        .map((m, i) => ({ m, i }))
        .filter((x) => x.m.role === 'user');
    const [sel, setSel] = useState(Math.max(0, userTurns.length - 1));
    useInput((_inputChar, key) => {
        if (key.escape) {
            onCancel();
            return;
        }
        if (key.upArrow) {
            setSel((x) => Math.max(0, x - 1));
            return;
        }
        if (key.downArrow) {
            setSel((x) => Math.min(userTurns.length - 1, x + 1));
            return;
        }
        if (key.return) {
            if (userTurns.length > 0)
                onRewind(userTurns[sel].i);
            else
                onCancel();
        }
    });
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Box, { borderStyle: "round", borderColor: colors.signature, paddingX: 1, children: _jsxs(Text, { bold: true, children: ['⏪ ', "Rewind \u00B7 \uB418\uB3CC\uB9B4 \uC9C0\uC810 \uC120\uD0DD"] }) }), _jsx(Box, { flexDirection: "column", marginTop: 1, paddingX: 1, children: userTurns.length === 0 ? (_jsx(Text, { dimColor: true, children: "\uB418\uB3CC\uB9B4 \uB300\uD654\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." })) : (userTurns.map((x, i) => {
                    const text = String(x.m.content ?? '').replace(/\n/g, ' ').slice(0, 60);
                    return (_jsxs(Text, { color: i === sel ? colors.signature : undefined, children: [i === sel ? '❯ ' : '  ', String(i + 1).padStart(2), ". ", text] }, i));
                })) }), _jsxs(Box, { marginTop: 1, paddingX: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "\uC120\uD0DD\uD55C \uC9C0\uC810 \uC774\uD6C4\uC758 \uB300\uD654\uAC00 \uC0AD\uC81C\uB429\uB2C8\uB2E4 (\uD30C\uC77C\uC740 \uBCF5\uAD6C\uB418\uC9C0 \uC54A\uC74C)" }), _jsx(Text, { dimColor: true, children: "\u2191\u2193 select \u00B7 Enter rewind \u00B7 Esc cancel" })] })] }));
}
function App({ initialSession, initialInput }) {
    const { exit } = useApp();
    const [input, setInput] = useState('');
    const [history, setHistory] = useState(() => {
        if (!initialSession)
            return [];
        return (initialSession.messages || []).map((m) => m.role === 'user'
            ? { kind: 'user', text: String(m.content ?? '') }
            : { kind: 'assistant', text: String(m.content ?? ''), provider: getProvider() });
    });
    const [messages, setMessages] = useState(() => initialSession?.messages ?? []);
    const [busy, setBusy] = useState(false);
    const [busyStart, setBusyStart] = useState(0);
    const [abortController, setAbortController] = useState(null);
    const [mode, setModeState] = useState(getMode());
    const [modeChanged, setModeChanged] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showRewind, setShowRewind] = useState(false);
    const lastEscRef = React.useRef(0);
    const lastCtrlCRef = React.useRef(0);
    const [ctrlCHint, setCtrlCHint] = useState(false);
    const [pending, setPending] = useState(null);
    const [inputHistory, setInputHistory] = useState([]);
    const [sessionId] = useState(() => newSessionId());
    const [provider, setProviderState] = useState(getProvider());
    const [, setUsageTick] = useState(0);
    const [config, setConfig] = useState(() => loadConfig());
    const [wizardDone, setWizardDone] = useState(false);
    const [trusted, setTrusted] = useState(() => loadConfig().trusted === true);
    useEffect(() => {
        // initialInput 자동 실행 (claude skill run 등)
        if (initialInput && initialInput.trim()) {
            const t = setTimeout(() => {
                const mm = initialInput.match(/Use the \"([^\"]+)\" skill/);
                if (mm)
                    setHistory((h) => [...h, { kind: 'tool_call', id: 'skill-' + Date.now(), name: 'skill', input: { name: mm[1] }, ok: true, result: undefined }]);
                void handleSubmit(initialInput, { silent: true });
            }, 300);
            return () => clearTimeout(t);
        }
    }, []);
    useEffect(() => {
        // MCP 서버 백그라운드 프리로드 (시작 속도 영향 없음)
        loadMcpTools().catch(() => { });
        if (config.configured) {
            setThemeMode(config.theme);
            setProvider(config.backend);
            setOllamaModel(config.ollamaModel);
            setProviderState(config.backend);
            setWizardDone(true);
        }
    }, []);
    useEffect(() => {
        if (messages.length === 0)
            return;
        const session = {
            id: sessionId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cwd: process.cwd(),
            messages: messages,
            inputHistory,
        };
        saveSession(session).catch(() => { });
    }, [messages]);
    const saveAndExit = async () => {
        if (messages.length > 0) {
            const session = {
                id: sessionId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                cwd: process.cwd(),
                messages: messages,
                inputHistory,
            };
            try {
                await saveSession(session);
            }
            catch { }
        }
        exit();
        process.exit(0);
    };
    useInput((inputChar, key) => {
        if (pending) {
            if (inputChar === 'y' || key.return) {
                answerApproval(pending.id, 'yes');
                setPending(null);
            }
            else if (inputChar === 'n' || key.escape) {
                answerApproval(pending.id, 'no');
                setPending(null);
            }
            else if (inputChar === 'a') {
                answerApproval(pending.id, 'always');
                setPending(null);
            }
            return;
        }
        if (key.ctrl && inputChar === 'c') {
            const now = Date.now();
            if (now - lastCtrlCRef.current < 2000) {
                void saveAndExit();
            }
            else {
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
    }, { isActive: pending !== null || !busy });
    useInput((_inputChar, key) => {
        if (key.escape && busy && abortController) {
            abortController.abort();
        }
    }, { isActive: busy && abortController !== null });
    useInput((_inputChar, key) => {
        if (key.escape) {
            const now = Date.now();
            if (now - lastEscRef.current < 500) {
                lastEscRef.current = 0;
                setShowRewind(true);
            }
            else {
                lastEscRef.current = now;
            }
        }
    }, { isActive: !busy && !pending && !showTranscript && !showSearch && !showRewind });
    useEffect(() => {
        const onTool = (ev) => {
            if (ev.kind === 'tool_call') {
                setHistory((h) => [
                    ...h,
                    { kind: 'tool_call', id: ev.id, name: ev.name, input: ev.input },
                ]);
            }
            else if (ev.kind === 'diff') {
                setHistory((h) => [...h, { kind: 'diff', id: ev.id, filePath: ev.filePath, oldText: ev.oldText, newText: ev.newText }]);
            }
            else {
                setHistory((h) => h.map((it) => it.kind === 'tool_call' && it.id === ev.id
                    ? { ...it, result: ev.summary, ok: ev.ok }
                    : it));
            }
        };
        const onApprovalRequest = (req) => {
            setPending(req);
        };
        bus.on('tool', onTool);
        approvalBus.on('request', onApprovalRequest);
        return () => {
            bus.off('tool', onTool);
            approvalBus.off('request', onApprovalRequest);
        };
    }, []);
    const doRewind = (userMsgIndex) => {
        const trimmedMsgs = messages.slice(0, userMsgIndex);
        setMessages(trimmedMsgs);
        const rebuilt = [];
        for (const m of trimmedMsgs) {
            if (m.role === 'user')
                rebuilt.push({ kind: 'user', text: String(m.content ?? '') });
            else if (m.role === 'assistant')
                rebuilt.push({ kind: 'assistant', text: String(m.content ?? ''), provider: getProvider() });
        }
        setHistory(rebuilt);
        setShowRewind(false);
    };
    const handleSubmit = async (value, opts) => {
        const trimmed = value.trim();
        if (!trimmed || busy)
            return;
        setInputHistory((h) => {
            if (h.length > 0 && h[h.length - 1] === trimmed)
                return h;
            const next = [...h, trimmed];
            return next.length > 100 ? next.slice(next.length - 100) : next;
        });
        if (trimmed.startsWith('!')) {
            const command = trimmed.slice(1).trim();
            if (!command) {
                setInput('');
                return;
            }
            setHistory((h) => [...h, { kind: 'user', text: trimmed }]);
            setInput('');
            setBusy(true);
            setBusyStart(Date.now());
            const ac = new AbortController();
            setAbortController(ac);
            const id = Date.now().toString();
            const proc = spawn('bash', ['-c', command], { cwd: process.cwd() });
            ac.signal.addEventListener('abort', () => proc.kill('SIGTERM'));
            let stdout = '';
            let stderr = '';
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
        if (trimmed === '/exit' || trimmed === '/quit') {
            void saveAndExit();
            return;
        }
        if (trimmed === '/clear') {
            setHistory([]);
            setMessages([]);
            resetUsage();
            setUsageTick((t) => t + 1);
            setInput('');
            return;
        }
        if (trimmed === '/compact') {
            if (messages.length === 0) {
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '압축할 대화가 없습니다.' }]);
                setInput('');
                return;
            }
            setInput('');
            const prevCount = messages.length;
            setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '대화를 요약하는 중...' }]);
            try {
                const ac = new AbortController();
                const summaryReq = [...messages, { role: 'user', content: '지금까지의 대화를 한국어로 3~5문장으로 요약해줘. 앞으로 대화를 이어가는 데 필요한 핵심 맥락(작업 내용, 결정 사항, 파일/경로)만 담아. 요약문만 출력해.' }];
                const { text: summary } = await chat(summaryReq, ac.signal);
                const compacted = [{ role: 'system', content: '이전 대화 요약:\n' + summary }];
                setMessages(compacted);
                setHistory((h) => [...h, { kind: 'info', text: '\u2713 대화 압축됨 (' + prevCount + '개 \u2192 요약 1개)\n\n' + summary }]);
            }
            catch (e) {
                setHistory((h) => [...h, { kind: 'error', text: '압축 실패: ' + (e?.message ?? e) }]);
            }
            return;
        }
        if (trimmed === '/help') {
            setHistory((h) => [
                ...h,
                { kind: 'user', text: trimmed },
                { kind: 'info', text: '슬래시 명령:\n' +
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
            const lines = [];
            let totalUsd = 0;
            const provs = Object.entries(byProv);
            if (provs.length === 0) {
                lines.push('아직 사용량이 없습니다.');
            }
            else {
                lines.push('세션 사용량:');
                for (const [prov, uu] of provs) {
                    const cost = estimateCost(prov, uu);
                    totalUsd += cost;
                    lines.push('  ' + prov.padEnd(8) +
                        '  in:' + formatTokensCompact(uu.inputTokens).padStart(6) +
                        '  out:' + formatTokensCompact(uu.outputTokens).padStart(6) +
                        '  total:' + formatTokensCompact(uu.totalTokens).padStart(6) +
                        '  turns:' + String(uu.turns).padStart(3) +
                        '   ' + formatCost(cost));
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
        if (trimmed === '/skill' || trimmed.startsWith('/skill ')) {
            const parts = trimmed.split(/\s+/);
            const sub = parts[1];
            if (!sub || sub === 'help') {
                const lines = [
                    '스킬 명령어',
                    '',
                    '  /skills           사용 가능한 스킬 목록',
                    '  /skill run <이름>  스킬 실행',
                    '  /skill help       이 도움말',
                ];
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: lines.join('\n') }]);
                setInput('');
                return;
            }
            if (sub === 'run') {
                const name = parts[2];
                if (!name) {
                    setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '사용법: /skill run <이름>' }]);
                    setInput('');
                    return;
                }
                const sk = findSkill(name);
                if (!sk) {
                    setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '스킬을 찾을 수 없습니다: ' + name + ' (/skills 로 확인)' }]);
                    setInput('');
                    return;
                }
                const extra = parts.slice(3).join(' ');
                const instr = 'Use the "' + name + '" skill. First read its instructions at ' + sk.skillFile +
                    ' with the read_file tool, then carry out the task.' + (extra ? ' Additional instructions: ' + extra : '');
                setInput('');
                setHistory((h) => [...h, { kind: 'tool_call', id: 'skill-' + Date.now(), name: 'skill', input: { name }, ok: true, result: undefined }]);
                void handleSubmit(instr, { silent: true });
                return;
            }
            setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '알 수 없는 스킬 명령: ' + sub + ' (/skill help 참고)' }]);
            setInput('');
            return;
        }
        if (trimmed === '/skills') {
            const sk = scanSkills();
            let lines;
            if (sk.length === 0) {
                lines = ['스킬', '', '  사용 가능한 스킬이 없습니다.', '  ~/.claude/skills/<이름>/SKILL.md 를 만드세요.'];
            }
            else {
                lines = ['스킬 (' + sk.length + '개)', ''];
                for (const x of sk) {
                    lines.push('  \u2022 ' + x.name);
                    lines.push('     ' + x.description);
                }
            }
            setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: lines.join('\n') }]);
            setInput('');
            return;
        }
        if (trimmed.startsWith('/mcp')) {
            const parts = trimmed.split(/\s+/);
            const sub = parts[1];
            // /mcp help 또는 알 수 없는 서브명령 → 사용법
            if (sub === 'help' || (sub && !['add', 'remove', 'rm', 'list'].includes(sub))) {
                const lines = [
                    'MCP 명령어',
                    '',
                    '  /mcp                      연결된 서버·툴 상태 보기',
                    '  /mcp list                 등록된 서버 목록 (설정 기준)',
                    '  /mcp add <이름> <명령> [인자...]   서버 추가',
                    '  /mcp remove <이름>        서버 삭제',
                    '',
                    '  예) /mcp add github npx -y @modelcontextprotocol/server-github',
                ];
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: lines.join('\n') }]);
                setInput('');
                return;
            }
            // /mcp add <이름> <명령> [인자...]
            if (sub === 'add') {
                const name = parts[2];
                const cmd = parts[3];
                const args = parts.slice(4);
                const res = name && cmd ? addMcpServer(name, cmd, args) : 'error: 사용법: /mcp add <이름> <명령> [인자...]';
                const note = res.startsWith('ok') ? '\n\n  (재시작하면 적용됩니다: claude 다시 실행)' : '';
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: 'MCP 추가\n\n  ' + res + note }]);
                setInput('');
                return;
            }
            // /mcp remove <이름>
            if (sub === 'remove' || sub === 'rm') {
                const name = parts[2];
                const res = name ? removeMcpServer(name) : 'error: 사용법: /mcp remove <이름>';
                const note = res.startsWith('ok') ? '\n\n  (재시작하면 적용됩니다: claude 다시 실행)' : '';
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: 'MCP 삭제\n\n  ' + res + note }]);
                setInput('');
                return;
            }
            // /mcp list — 설정 파일 기준 목록
            if (sub === 'list') {
                const cfg = listMcpConfig();
                const lines = cfg.length === 0
                    ? ['MCP 설정', '', '  등록된 서버가 없습니다.', '  추가: /mcp add <이름> <명령> [인자...]']
                    : ['MCP 설정 (' + cfg.length + '개)', '', ...cfg.map((c) => '  \u2022 ' + c.name + '  →  ' + c.command)];
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: lines.join('\n') }]);
                setInput('');
                return;
            }
            // /mcp (인자 없음) — 연결 상태 표시
            {
                const st = getMcpStatus();
                let lines;
                if (st.length === 0) {
                    lines = ['MCP 서버', '', '  연결된 서버가 없습니다.', '  ~/.claude/mcp.json 에 서버를 추가하세요.'];
                }
                else {
                    lines = ['MCP 서버 (' + st.length + '개)', ''];
                    for (const s of st) {
                        if (s.ok) {
                            lines.push('  \u2713 ' + s.name + ' — ' + s.toolCount + '개 툴');
                            lines.push('     ' + s.toolNames.join(', '));
                        }
                        else {
                            lines.push('  \u2717 ' + s.name + ' — 실패: ' + (s.error ?? ''));
                        }
                    }
                }
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: lines.join('\n') }]);
                setInput('');
                return;
            }
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
            }
            else if (arg === 'light' || arg === 'dark' || arg === 'auto') {
                setThemeMode(arg);
                saveConfig({ theme: arg });
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `테마 변경: ${getThemeLabel(arg)}` }]);
            }
            else {
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'error', text: `알 수 없는 테마: ${arg}` }]);
            }
            setInput('');
            return;
        }
        if (trimmed.startsWith('/backend') || trimmed.startsWith('/model')) {
            const arg = trimmed.split(/\s+/)[1];
            if (!arg) {
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `현재: ${getProvider()}\n사용법: gemini | groq | ollama` }]);
            }
            else if (arg === 'auto' || arg === 'flash' || arg === 'pro') {
                const gm = arg === 'auto' ? 'auto' : arg === 'flash' ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
                setGeminiModel(gm);
                if (getProvider() !== 'gemini') {
                    setProvider('gemini');
                    setProviderState('gemini');
                    saveConfig({ backend: 'gemini' });
                }
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: arg === 'auto' ? 'Gemini 모델: auto (복잡도에 따라 flash/pro 자동 선택)' : `Gemini 모델: ${gm}` }]);
            }
            else if (arg === 'gemini' || arg === 'groq' || arg === 'ollama' || arg === 'manual') {
                setProvider(arg);
                setProviderState(arg);
                saveConfig({ backend: arg });
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `모델 전환: ${arg}` }]);
            }
            else {
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'error', text: `알 수 없는 모델: ${arg}` }]);
            }
            setInput('');
            return;
        }
        if (trimmed.startsWith('/ollama-model')) {
            const arg = trimmed.split(/\s+/).slice(1).join(' ').trim();
            if (!arg) {
                setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: `현재 Ollama 모델: ${getOllamaModel()}` }]);
            }
            else {
                setOllamaModel(arg);
                saveConfig({ ollamaModel: arg });
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
            }
            else {
                const groups = groupByCwd(all);
                const blocks = [];
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
            if (target.cwd) {
                try {
                    process.chdir(target.cwd);
                }
                catch { }
            }
            setMessages(target.messages);
            setInputHistory(target.inputHistory ?? []);
            setHistory([
                { kind: 'info', text: `✓ 세션 복원: ${target.id} (${target.messages.length}개 메시지)` },
                ...target.messages.map((m) => m.role === 'user'
                    ? { kind: 'user', text: m.content }
                    : { kind: 'assistant', text: m.content, provider: getProvider() }),
            ]);
            setInput('');
            return;
        }
        if (trimmed === '/init') {
            setHistory((h) => [...h, { kind: 'user', text: trimmed }, { kind: 'info', text: '프로젝트 분석 중... CLAUDE.md 생성합니다.' }]);
            setInput('');
            setBusy(true);
            setBusyStart(Date.now());
            try {
                const result = await runInit();
                if (result.ok) {
                    clearSystemCache();
                    setHistory((h) => [...h, { kind: 'info', text: `✓ ${result.message}` }]);
                }
                else {
                    setHistory((h) => [...h, { kind: 'error', text: result.message }]);
                }
            }
            catch (err) {
                setHistory((h) => [...h, { kind: 'error', text: err?.message ?? String(err) }]);
            }
            finally {
                setBusy(false);
                setUsageTick((t) => t + 1);
                invalidateFileCache();
            }
            return;
        }
        setInput('');
        setBusy(true);
        setBusyStart(Date.now());
        const expansion = await expandMentions(trimmed);
        const userContent = buildMessageWithAttachments(expansion);
        const newMessages = [...messages, { role: 'user', content: userContent }];
        let displayText = trimmed;
        if (expansion.attachments.length > 0) {
            const files = expansion.attachments.map((a) => (a.error ? `@${a.path} (에러)` : `@${a.path}`)).join(', ');
            displayText = `${trimmed}\n  ⎿ 첨부: ${files}`;
        }
        if (!opts?.silent)
            setHistory((h) => [...h, { kind: 'user', text: displayText }]);
        try {
            const ac = new AbortController();
            setAbortController(ac);
            const { text: reply, usedProvider } = await chat(newMessages, ac.signal);
            const provNow = usedProvider;
            setProviderState(provNow);
            setMessages([...newMessages, { role: 'assistant', content: reply }]);
            let typeIdx = -1;
            setHistory((h) => { typeIdx = h.length; return [...h, { kind: 'assistant', text: '', provider: provNow }]; });
            await new Promise((resolve) => {
                let i = 0;
                // 답변 길이에 따라 타이핑 속도 자동 조절 (긴 답변은 빠르게)
                const SPEED = reply.length > 1200 ? 24 : reply.length > 500 ? 12 : 6;
                const INTERVAL = 12;
                const timer = setInterval(() => {
                    i += SPEED;
                    const done = i >= reply.length;
                    const slice = done ? reply : reply.slice(0, i);
                    setHistory((h) => {
                        if (typeIdx < 0)
                            return h;
                        const item = h[typeIdx];
                        if (!item || item.kind !== 'assistant')
                            return h;
                        const nh = [...h];
                        nh[typeIdx] = { ...item, text: slice };
                        return nh;
                    });
                    if (done) {
                        clearInterval(timer);
                        resolve();
                    }
                }, INTERVAL);
            });
        }
        catch (err) {
            if (err?.name === 'AbortError' || String(err?.message ?? '').includes('aborted')) {
                setHistory((h) => [...h, { kind: 'info', text: '⎿  중단됨 (esc)' }]);
            }
            else {
                const raw = String(err?.message ?? err);
                let friendly;
                if (raw.includes('All providers exhausted') || raw.includes('429') || raw.includes('quota') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('rate')) {
                    friendly = '지금 요청이 몰려 잠시 응답할 수 없어요. 30초쯤 뒤에 다시 시도해 주세요.\n(무료 API 사용 한도에 일시적으로 도달했습니다.)';
                }
                else {
                    friendly = '오류가 발생했어요: ' + raw;
                }
                setHistory((h) => [...h, { kind: 'error', text: friendly }]);
            }
        }
        finally {
            setBusy(false);
            setAbortController(null);
            setUsageTick((t) => t + 1);
            invalidateFileCache();
        }
    };
    const u = getUsage();
    const ctxPct = contextPercent(u.totalTokens);
    const colors = getColors();
    const gm = getGeminiModel();
    const geminiSuffix = provider === 'gemini'
        ? gm === 'auto'
            ? (getGeminiRoute() ? ` · auto→${getGeminiRoute()}` : ' · auto')
            : ` · ${gm.replace('gemini-2.5-', '')}`
        : '';
    if (showRewind) {
        return (_jsx(RewindView, { messages: messages, onRewind: doRewind, onCancel: () => setShowRewind(false) }));
    }
    if (showSearch) {
        return (_jsx(HistorySearch, { history: inputHistory, onSelect: (v) => {
                setInput(v);
                setShowSearch(false);
            }, onCancel: () => setShowSearch(false) }));
    }
    if (showTranscript) {
        return _jsx(TranscriptView, { history: history, onClose: () => setShowTranscript(false) });
    }
    if (!trusted) {
        return (_jsx(TrustDialog, { onConfirm: () => {
                const cfg = loadConfig();
                saveConfig({ ...cfg, trusted: true });
                setConfig(loadConfig());
                setTrusted(true);
            } }));
    }
    if (!wizardDone) {
        return (_jsx(StartupWizard, { onDone: (theme) => {
                setThemeMode(theme);
                saveConfig({ theme, backend: 'gemini', configured: true });
                setProvider('gemini');
                setProviderState('gemini');
                setConfig(loadConfig());
                setWizardDone(true);
            } }));
    }
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Banner, {}), history.map((item, i) => {
                if (item.kind === 'user') {
                    const lines = item.text.split('\n');
                    return (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: '> ' }), _jsx(Text, { children: lines[0] })] }), lines.slice(1).map((line, j) => (_jsx(Box, { children: _jsx(Text, { dimColor: true, children: line }) }, j)))] }, i));
                }
                if (item.kind === 'assistant') {
                    return (_jsx(Box, { marginTop: 1, flexDirection: "column", children: _jsxs(Box, { children: [_jsx(Text, { color: colors.signature, children: '⏺ ' }), _jsx(Text, { children: item.text })] }) }, i));
                }
                if (item.kind === 'diff') {
                    return (_jsx(Box, { marginTop: 1, children: _jsx(DiffView, { oldText: item.oldText, newText: item.newText, filePath: item.filePath }) }, i));
                }
                if (item.kind === 'tool_call') {
                    const arg = summarizeInput(item.name, item.input);
                    const display = toolDisplayName(item.name);
                    return (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: item.ok === false ? 'red' : colors.signature, children: '⏺ ' }), _jsx(Text, { bold: true, children: display }), _jsxs(Text, { dimColor: true, children: ["(", arg, ")"] })] }), item.result !== undefined && (() => {
                                const lines = item.result.split('\n');
                                const MAX = 4;
                                const shown = lines.slice(0, MAX);
                                const extra = lines.length - MAX;
                                return (_jsxs(Box, { flexDirection: "column", children: [shown.map((ln, li) => (_jsxs(Box, { children: [_jsx(Text, { color: item.ok === false ? 'red' : 'gray', children: li === 0 ? '  ⎿  ' : '     ' }), _jsx(Text, { color: item.ok === false ? 'red' : undefined, dimColor: item.ok !== false, children: ln })] }, li))), extra > 0 && (_jsxs(Box, { children: [_jsx(Text, { children: '     ' }), _jsxs(Text, { dimColor: true, children: ["\u2026 +", extra, " lines (ctrl+o to expand)"] })] }))] }));
                            })()] }, i));
                }
                if (item.kind === 'error') {
                    return (_jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "red", children: '⏺ ' }), _jsx(Text, { color: "red", children: item.text })] }, i));
                }
                return (_jsx(Box, { marginTop: 1, flexDirection: "column", children: item.text.split('\n').map((line, j) => (_jsx(Box, { children: _jsx(Text, { dimColor: true, children: line }) }, j))) }, i));
            }), pending && (_jsxs(Box, { marginTop: 1, flexDirection: "column", borderStyle: "round", borderColor: "yellow", paddingX: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: "yellow", bold: true, children: '⚠ 승인 필요: ' }), _jsx(Text, { bold: true, children: pending.toolName })] }), _jsx(Box, { children: _jsx(Text, { children: pending.summary }) }), pending.detail && (_jsx(Box, { marginTop: 1, flexDirection: "column", children: pending.detail.split('\n').map((l, k) => (_jsx(Text, { dimColor: true, children: l }, k))) })), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "green", children: "y" }), _jsx(Text, { dimColor: true, children: "=\uC2B9\uC778  " }), _jsx(Text, { color: "red", children: "n" }), _jsx(Text, { dimColor: true, children: "=\uAC70\uBD80  " }), _jsx(Text, { color: "cyan", children: "a" }), _jsx(Text, { dimColor: true, children: "=\uC138\uC158 \uC790\uB3D9 \uC2B9\uC778" })] })] })), !pending && (_jsx(Box, { marginTop: 1, borderStyle: "round", borderColor: busy ? colors.signature : 'gray', paddingX: 1, children: busy ? (_jsx(Box, { children: _jsx(ClaudeSpinner, { startTime: busyStart, tokens: u.totalTokens }) })) : (_jsx(MentionInput, { value: input, onChange: setInput, onSubmit: handleSubmit, placeholder: "\uBB34\uC5C7\uC744 \uB3C4\uC640\uB4DC\uB9B4\uAE4C\uC694?", commands: SLASH_COMMANDS, history: inputHistory })) })), _jsx(Box, { paddingX: 1, children: _jsx(Text, { dimColor: true, children: ctrlCHint ? '한 번 더 Ctrl+C를 누르면 종료됩니다' : '? for shortcuts' }) }), _jsxs(Box, { marginTop: 1, paddingX: 1, children: [_jsxs(Text, { color: modeColor(mode), bold: modeChanged, children: ["\u23F5\u23F5 ", modeLabel(mode), modeChanged ? '  ◄ shift+tab' : ''] }), _jsx(Text, { dimColor: true, children: ' · ' }), _jsxs(Text, { color: colors.signature, children: ["\u25C6 ", provider, geminiSuffix] }), _jsx(Text, { dimColor: true, children: ' · ' }), _jsxs(Text, { dimColor: true, children: ["\uD83D\uDCC1 ", path.basename(process.cwd())] }), _jsx(Text, { dimColor: true, children: ' · ' }), _jsxs(Text, { dimColor: true, children: ["\u26A1 ", formatTokens(u.totalTokens), " \u00B7 ", u.turns, "t"] })] })] }));
}
async function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];
    const printHelp = () => {
        const lines = [
            '',
            '  \x1b[1mClaude Code\x1b[0m — AI 코딩 어시스턴트 \x1b[2m(v0.0.1)\x1b[0m',
            '',
            '  \x1b[1m사용법:\x1b[0m',
            '    claude                 새 세션 시작',
            '    claude resume [id]     세션 이어서 진행 (id 없으면 최근)',
            '    claude sessions        저장된 세션 목록 (폴더별)',
            '    claude delete <id>     세션 삭제',
            '',
            '  \x1b[1m별칭:\x1b[0m',
            '    claude --list          = claude sessions',
            '    claude --continue, -c  = claude resume',
            '',
            '  \x1b[1m옵션:\x1b[0m',
            '    -h, --help             이 도움말 표시',
            '    -v, --version          버전 표시',
            '',
            '  \x1b[2m앱 실행 중에는 /help 로 명령 목록을 볼 수 있습니다.\x1b[0m',
            '',
        ];
        console.log(lines.join('\n'));
    };
    // --version
    if (cmd === '--version' || cmd === '-v') {
        console.log('claude v0.0.1');
        process.exit(0);
    }
    // --help
    if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
        printHelp();
        process.exit(0);
    }
    // 알 수 없는 옵션(--xxx)이면 도움말 표시
    if (cmd && cmd.startsWith('-') && !['--help', '-h', 'help', '--version', '-v', '--list', '--continue', '-c'].includes(cmd)) {
        console.log('\n  \x1b[2m알 수 없는 옵션: ' + cmd + '\x1b[0m');
        printHelp();
        process.exit(1);
    }
    // 세션 목록 보기: claude sessions | claude --list
    if (cmd === 'delete') {
        const id = args[1];
        if (!id) {
            console.log('사용법: claude delete <id>');
            process.exit(1);
        }
        const ok = await deleteSession(id);
        console.log(ok ? '\u2713 세션 삭제됨: ' + id : '세션을 찾을 수 없습니다: ' + id);
        process.exit(ok ? 0 : 1);
    }
    if (cmd === 'sessions' || cmd === '--list') {
        const all = await listSessions();
        if (all.length === 0) {
            console.log('저장된 세션이 없습니다.');
        }
        else {
            const groups = groupByCwd(all);
            console.log('저장된 세션 (' + groups.size + '개 폴더):\n');
            for (const [dir, sess] of groups) {
                const home = process.env.HOME || '';
                const shortDir = home && dir.startsWith(home) ? '~' + dir.slice(home.length) : dir;
                console.log('\uD83D\uDCC1 ' + shortDir);
                for (const x of sess)
                    console.log('   ' + summarizeSession(x));
                console.log('');
            }
            console.log('이어서 시작: claude resume <id>');
        }
        process.exit(0);
    }
    // 세션 이어서 시작: claude resume [id] | claude --continue
    let initialSession = null;
    let initialInput;
    if (cmd === 'skill') {
        const sub = args[1];
        if (!sub || sub === 'help') {
            console.log('스킬 명령어');
            console.log('');
            console.log('  claude skill list              사용 가능한 스킬 목록');
            console.log('  claude skill run <이름> [지시]  스킬 실행');
            console.log('  claude skill help              이 도움말');
            console.log('');
            console.log('  스킬 위치: ~/.claude/skills/<이름>/SKILL.md');
            process.exit(0);
        }
        if (sub === 'list') {
            const sk = scanSkills();
            if (sk.length === 0) {
                console.log('사용 가능한 스킬이 없습니다. ~/.claude/skills/<이름>/SKILL.md 를 만드세요.');
            }
            else {
                console.log('스킬 (' + sk.length + '개):');
                for (const x of sk)
                    console.log('  • ' + x.name + ' — ' + x.description);
            }
            process.exit(0);
        }
        if (sub === 'run') {
            const name = args[2];
            if (!name) {
                console.log('사용법: claude skill run <이름> [추가 지시]');
                process.exit(1);
            }
            const sk = findSkill(name);
            if (!sk) {
                console.log('스킬을 찾을 수 없습니다: ' + name + ' (claude skill list 로 확인)');
                process.exit(1);
            }
            const extra = args.slice(3).join(' ');
            initialInput = 'Use the "' + name + '" skill. First read its instructions at ' + sk.skillFile +
                ' with the read_file tool, then carry out the task.' + (extra ? ' Additional instructions: ' + extra : '');
        }
        else {
            console.log('알 수 없는 스킬 명령: ' + sub + ' (claude skill help 참고)');
            process.exit(1);
        }
    }
    if (cmd === 'resume' || cmd === '--continue' || cmd === '-c') {
        const id = args[1];
        initialSession = id ? await loadSession(id) : await loadLatest();
        if (initialSession && initialSession.cwd) {
            try {
                process.chdir(initialSession.cwd);
            }
            catch { }
        }
        if (!initialSession) {
            console.log(id ? `세션을 찾을 수 없습니다: ${id}` : '이어서 시작할 세션이 없습니다.');
            process.exit(1);
        }
        console.log(`세션 복원: ${initialSession.id} (${initialSession.messages.length}개 메시지)`);
    }
    render(_jsx(App, { initialSession: initialSession, initialInput: initialInput }), { exitOnCtrlC: false });
}
main();
//# sourceMappingURL=cli.js.map