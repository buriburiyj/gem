import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { setThemeMode, getColors } from './theme.js';
const THEME_OPTIONS = [
    { value: 'light', label: 'Light', hint: 'Clean and bright' },
    { value: 'dark', label: 'Dark', hint: 'Easy on the eyes' },
    { value: 'auto', label: 'Auto · Adaptive', hint: 'Shifts with the time of day' },
];
const LOGO = [
    '   ▄████▄   ██▓    ▄▄▄       █    ██ ▓█████▄ ▓█████ ',
    '  ▒██▀ ▀█  ▓██▒   ▒████▄     ██  ▓██▒▒██▀ ██▌▓█   ▀ ',
    '  ▒▓█    ▄ ▒██░   ▒██  ▀█▄  ▓██  ▒██░░██   █▌▒███   ',
    '  ▒▓▓▄ ▄██▒▒██░   ░██▄▄▄▄██ ▓▓█  ░██░░▓█▄   ▌▒▓█  ▄ ',
    '  ▒ ▓███▀ ░░██████▒▓█   ▓██▒▒▒█████▓ ░▒████▓ ░▒████▒',
];
export function StartupWizard({ onDone }) {
    const [step, setStep] = useState('welcome');
    const [themeIdx, setThemeIdx] = useState(2);
    const [logoFrame, setLogoFrame] = useState(0);
    useEffect(() => {
        if (step !== 'welcome')
            return;
        const fade = setInterval(() => {
            setLogoFrame((f) => {
                if (f >= LOGO.length) {
                    clearInterval(fade);
                    return f;
                }
                return f + 1;
            });
        }, 80);
        return () => clearInterval(fade);
    }, [step]);
    const previewTheme = step === 'theme' ? THEME_OPTIONS[themeIdx].value : 'auto';
    setThemeMode(previewTheme);
    const colors = getColors();
    useInput((input, key) => {
        if (step === 'welcome') {
            if (key.return)
                setStep('theme');
            return;
        }
        if (step === 'theme') {
            if (key.upArrow)
                setThemeIdx((i) => (i - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length);
            else if (key.downArrow)
                setThemeIdx((i) => (i + 1) % THEME_OPTIONS.length);
            else if (key.return) {
                onDone(THEME_OPTIONS[themeIdx].value);
            }
        }
    });
    if (step === 'welcome') {
        const ready = logoFrame >= LOGO.length;
        return (_jsxs(Box, { flexDirection: "column", alignItems: "center", paddingY: 2, children: [_jsx(Box, { flexDirection: "column", children: LOGO.slice(0, logoFrame).map((line, i) => (_jsx(Text, { color: colors.signature, bold: true, children: line }, i))) }), ready && (_jsxs(Box, { flexDirection: "column", alignItems: "center", marginTop: 1, children: [_jsx(Text, { color: colors.accent, bold: true, children: "\u2500\u2500\u2500\u2500\u2500  Your AI coding companion  \u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: colors.dim, children: "Press " }), _jsx(Text, { color: colors.accent, bold: true, children: "Enter" }), _jsx(Text, { color: colors.dim, children: " to begin" })] })] }))] }));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: colors.signature, paddingX: 3, paddingY: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 1, children: [_jsx(Text, { color: colors.signature, bold: true, children: "\u2733 Welcome to Claude Code" }), _jsx(Text, { color: colors.dim, children: "1 / 1" })] }), _jsx(Text, { color: colors.dim, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsx(Box, { marginTop: 1, marginBottom: 1, children: _jsx(Text, { color: colors.text, bold: true, children: "Choose your theme" }) }), _jsx(Box, { flexDirection: "column", children: THEME_OPTIONS.map((opt, i) => {
                    const active = i === themeIdx;
                    return (_jsxs(Box, { marginY: 0, children: [_jsx(Text, { color: active ? colors.signature : colors.dim, children: active ? '▸ ' : '  ' }), _jsx(Box, { width: 26, children: _jsx(Text, { color: active ? colors.accent : colors.text, bold: active, children: opt.label }) }), _jsx(Text, { color: active ? colors.text : colors.dim, children: opt.hint })] }, opt.value));
                }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: colors.dim, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: colors.dim, children: "\u2191/\u2193 navigate   \u23CE select" }) })] }));
}
//# sourceMappingURL=StartupWizard.js.map