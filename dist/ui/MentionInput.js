import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import fg from 'fast-glob';
import path from 'node:path';
function findActiveMention(text, cursor) {
    let i = cursor - 1;
    while (i >= 0) {
        const ch = text[i];
        if (ch === '@') {
            if (i === 0 || /\s/.test(text[i - 1]))
                return { start: i, query: text.slice(i + 1, cursor) };
            return null;
        }
        if (/\s/.test(ch))
            return null;
        i--;
    }
    return null;
}
function findActiveSlash(text, cursor) {
    if (!text.startsWith('/'))
        return null;
    const firstSpace = text.indexOf(' ');
    const end = firstSpace === -1 ? text.length : firstSpace;
    if (cursor > end)
        return null;
    return { start: 0, query: text.slice(1, cursor) };
}
let fileCache = null;
let scanning = false;
async function getProjectFiles() {
    if (fileCache)
        return fileCache;
    if (scanning) {
        while (scanning)
            await new Promise((r) => setTimeout(r, 50));
        return fileCache ?? [];
    }
    scanning = true;
    try {
        const files = await fg(['**/*'], {
            cwd: process.cwd(),
            ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**', '**/.next/**', '**/.Trash/**', '**/Library/**', '**/.cache/**', '**/.npm/**', '**/.pnpm-store/**', '**/.gem/**', '**/.local/**'],
            suppressErrors: true,
            deep: 10,
            dot: false,
            onlyFiles: true,
        });
        fileCache = files.sort();
        return fileCache;
    }
    finally {
        scanning = false;
    }
}
export function invalidateFileCache() {
    fileCache = null;
}
function filterFiles(files, query, limit = 8) {
    if (!query)
        return files.slice(0, limit);
    const q = query.toLowerCase();
    const starts = [];
    const contains = [];
    for (const f of files) {
        const lower = f.toLowerCase();
        const base = path.basename(lower);
        if (lower.startsWith(q) || base.startsWith(q))
            starts.push(f);
        else if (lower.includes(q))
            contains.push(f);
        if (starts.length >= limit)
            break;
    }
    return [...starts, ...contains].slice(0, limit);
}
function filterCommands(cmds, query) {
    if (!query)
        return cmds;
    const q = query.toLowerCase();
    return cmds.filter((c) => c.name.toLowerCase().startsWith(q));
}
export function MentionInput({ value, onChange, onSubmit, placeholder, disabled, commands = [], history = [], }) {
    const [cursor, setCursor] = useState(value.length);
    const [files, setFiles] = useState([]);
    const [highlight, setHighlight] = useState(0);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [draft, setDraft] = useState('');
    useEffect(() => {
        getProjectFiles().then(setFiles);
    }, []);
    useEffect(() => {
        if (cursor > value.length)
            setCursor(value.length);
    }, [value, cursor]);
    const mention = useMemo(() => findActiveMention(value, cursor), [value, cursor]);
    const slash = useMemo(() => findActiveSlash(value, cursor), [value, cursor]);
    const fileCandidates = useMemo(() => (mention ? filterFiles(files, mention.query) : []), [mention, files]);
    const cmdCandidates = useMemo(() => (slash ? filterCommands(commands, slash.query) : []), [slash, commands]);
    const activeMode = mention && fileCandidates.length ? 'file' : slash && cmdCandidates.length ? 'cmd' : null;
    useEffect(() => {
        setHighlight(0);
    }, [mention?.query, slash?.query]);
    const acceptFile = (cand) => {
        if (!mention)
            return;
        const before = value.slice(0, mention.start);
        const after = value.slice(cursor);
        const inserted = '@' + cand;
        const newValue = before + inserted + (after.startsWith(' ') ? '' : ' ') + after;
        onChange(newValue);
        setCursor(before.length + inserted.length + 1);
    };
    const acceptCommand = (cand) => {
        const after = value.slice(cursor);
        const inserted = '/' + cand.name;
        const newValue = inserted + (after.startsWith(' ') || after.length === 0 ? after : ' ' + after);
        onChange(newValue);
        setCursor(inserted.length);
    };
    useInput((inputChar, key) => {
        if (disabled)
            return;
        if (activeMode === 'file') {
            if (key.upArrow) {
                setHighlight((h) => (h - 1 + fileCandidates.length) % fileCandidates.length);
                return;
            }
            if (key.downArrow) {
                setHighlight((h) => (h + 1) % fileCandidates.length);
                return;
            }
            if (key.tab) {
                acceptFile(fileCandidates[highlight]);
                return;
            }
            if (key.escape) {
                const before = value.slice(0, mention.start);
                const after = value.slice(cursor);
                onChange(before + after);
                setCursor(before.length);
                return;
            }
        }
        else if (activeMode === 'cmd') {
            if (key.upArrow) {
                setHighlight((h) => (h - 1 + cmdCandidates.length) % cmdCandidates.length);
                return;
            }
            if (key.downArrow) {
                setHighlight((h) => (h + 1) % cmdCandidates.length);
                return;
            }
            if (key.tab) {
                acceptCommand(cmdCandidates[highlight]);
                return;
            }
            if (key.escape) {
                onChange('');
                setCursor(0);
                return;
            }
        }
        else {
            if (key.upArrow) {
                if (history.length === 0)
                    return;
                if (historyIdx === -1) {
                    setDraft(value);
                    const next = history.length - 1;
                    setHistoryIdx(next);
                    onChange(history[next]);
                    setCursor(history[next].length);
                }
                else if (historyIdx > 0) {
                    const next = historyIdx - 1;
                    setHistoryIdx(next);
                    onChange(history[next]);
                    setCursor(history[next].length);
                }
                return;
            }
            if (key.downArrow) {
                if (historyIdx === -1)
                    return;
                if (historyIdx < history.length - 1) {
                    const next = historyIdx + 1;
                    setHistoryIdx(next);
                    onChange(history[next]);
                    setCursor(history[next].length);
                }
                else {
                    setHistoryIdx(-1);
                    onChange(draft);
                    setCursor(draft.length);
                }
                return;
            }
            if (key.escape && historyIdx !== -1) {
                setHistoryIdx(-1);
                onChange(draft);
                setCursor(draft.length);
                return;
            }
        }
        if (key.ctrl && inputChar === 'a') {
            let start = cursor;
            while (start > 0 && value[start - 1] !== '\n')
                start--;
            setCursor(start);
            return;
        }
        if (key.ctrl && inputChar === 'e') {
            let end = cursor;
            while (end < value.length && value[end] !== '\n')
                end++;
            setCursor(end);
            return;
        }
        if (key.ctrl && inputChar === 'u') {
            let start = cursor;
            while (start > 0 && value[start - 1] !== '\n')
                start--;
            const newVal = value.slice(0, start) + value.slice(cursor);
            onChange(newVal);
            setCursor(start);
            return;
        }
        if (key.ctrl && inputChar === 'k') {
            let end = cursor;
            while (end < value.length && value[end] !== '\n')
                end++;
            const newVal = value.slice(0, cursor) + value.slice(end);
            onChange(newVal);
            return;
        }
        if (key.ctrl && inputChar === 'w') {
            if (cursor === 0)
                return;
            let end = cursor;
            while (end > 0 && /\s/.test(value[end - 1]))
                end--;
            while (end > 0 && !/\s/.test(value[end - 1]))
                end--;
            const newVal = value.slice(0, end) + value.slice(cursor);
            onChange(newVal);
            setCursor(end);
            return;
        }
        if (key.return) {
            if (key.meta || key.shift) {
                const newVal = value.slice(0, cursor) + '\n' + value.slice(cursor);
                onChange(newVal);
                setCursor((c) => c + 1);
                return;
            }
            if (value.endsWith('\\')) {
                const newVal = value.slice(0, value.length - 1) + '\n';
                onChange(newVal);
                setCursor(newVal.length);
                return;
            }
            if (activeMode === 'cmd') {
                const typed = value.trim();
                const firstToken = typed.split(/\s+/)[0];
                const exact = cmdCandidates.find((c) => '/' + c.name === firstToken);
                if (typed.includes(' ') || exact) {
                    setHistoryIdx(-1);
                    setDraft('');
                    onSubmit(value);
                    return;
                }
                acceptCommand(cmdCandidates[highlight]);
                return;
            }
            if (activeMode === 'file') {
                acceptFile(fileCandidates[highlight]);
                return;
            }
            setHistoryIdx(-1);
            setDraft('');
            onSubmit(value);
            return;
        }
        if (key.leftArrow) {
            setCursor((c) => Math.max(0, c - 1));
            return;
        }
        if (key.rightArrow) {
            setCursor((c) => Math.min(value.length, c + 1));
            return;
        }
        if (key.backspace || key.delete) {
            if (cursor === 0)
                return;
            const newVal = value.slice(0, cursor - 1) + value.slice(cursor);
            onChange(newVal);
            setCursor((c) => Math.max(0, c - 1));
            return;
        }
        if (inputChar && !key.ctrl && !key.meta) {
            const newVal = value.slice(0, cursor) + inputChar + value.slice(cursor);
            onChange(newVal);
            setCursor((c) => c + inputChar.length);
        }
    });
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "#D77757", bold: true, children: '> ' }), value.length === 0 ? (_jsx(Text, { dimColor: true, children: placeholder ?? '' })) : (_jsxs(Text, { children: [before, _jsx(Text, { inverse: true, children: " " }), after] }))] }), activeMode === 'file' && (_jsxs(Box, { marginLeft: 2, flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, children: [_jsxs(Text, { dimColor: true, children: ["@", mention.query, " \u2014 Tab/Enter \uC120\uD0DD \u00B7 \u2191\u2193 \uC774\uB3D9 \u00B7 Esc \uCDE8\uC18C"] }), fileCandidates.map((c, i) => (_jsxs(Box, { children: [_jsx(Text, { color: i === highlight ? '#D77757' : undefined, bold: i === highlight, children: i === highlight ? '▸ ' : '  ' }), _jsx(Text, { color: i === highlight ? '#D77757' : undefined, children: c })] }, c)))] })), activeMode === 'cmd' && (_jsxs(Box, { marginLeft: 2, flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, children: [_jsxs(Text, { dimColor: true, children: ["/", slash.query, " \u2014 Tab/Enter \uC120\uD0DD \u00B7 \u2191\u2193 \uC774\uB3D9 \u00B7 Esc \uCDE8\uC18C"] }), cmdCandidates.map((c, i) => (_jsxs(Box, { children: [_jsx(Text, { color: i === highlight ? '#D77757' : undefined, bold: i === highlight, children: i === highlight ? '▸ ' : '  ' }), _jsxs(Text, { color: i === highlight ? '#D77757' : undefined, children: ["/", c.name] }), _jsxs(Text, { dimColor: true, children: ['  ', c.description] })] }, c.name)))] }))] }));
}
//# sourceMappingURL=MentionInput.js.map