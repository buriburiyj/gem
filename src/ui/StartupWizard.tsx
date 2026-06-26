import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ThemeMode, getThemeLabel, setThemeMode, getColors } from './theme.js';
import type { LLMProvider } from '../llm/client.js';

type Step = 'welcome' | 'theme' | 'backend';

type Props = {
  onDone: (theme: ThemeMode, backend: LLMProvider) => void;
};

const THEME_OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'light', label: 'Light',           hint: 'Clean and bright' },
  { value: 'dark',  label: 'Dark',            hint: 'Easy on the eyes' },
  { value: 'auto',  label: 'Auto · Adaptive', hint: 'Shifts with the time of day' },
];

const BACKEND_OPTIONS: { value: LLMProvider; label: string; hint: string }[] = [
  { value: 'gemini', label: 'Gemini', hint: 'Google · Fast · Free tier' },
  { value: 'groq',   label: 'Groq',   hint: 'Ultra-fast · Free tier' },
  { value: 'ollama', label: 'Ollama', hint: 'Local · Unlimited · Auto model routing' },
];

const LOGO = [
  '   ▄████▄   ██▓    ▄▄▄       █    ██ ▓█████▄ ▓█████ ',
  '  ▒██▀ ▀█  ▓██▒   ▒████▄     ██  ▓██▒▒██▀ ██▌▓█   ▀ ',
  '  ▒▓█    ▄ ▒██░   ▒██  ▀█▄  ▓██  ▒██░░██   █▌▒███   ',
  '  ▒▓▓▄ ▄██▒▒██░   ░██▄▄▄▄██ ▓▓█  ░██░░▓█▄   ▌▒▓█  ▄ ',
  '  ▒ ▓███▀ ░░██████▒▓█   ▓██▒▒▒█████▓ ░▒████▓ ░▒████▒',
];

export function StartupWizard({ onDone }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [themeIdx, setThemeIdx] = useState(2);
  const [backendIdx, setBackendIdx] = useState(2);
  const [pickedTheme, setPickedTheme] = useState<ThemeMode>('auto');
  const [logoFrame, setLogoFrame] = useState(0);

  useEffect(() => {
    if (step !== 'welcome') return;
    const fade = setInterval(() => {
      setLogoFrame((f) => {
        if (f >= LOGO.length) { clearInterval(fade); return f; }
        return f + 1;
      });
    }, 80);
    return () => clearInterval(fade);
  }, [step]);

  const previewTheme = step === 'theme' ? THEME_OPTIONS[themeIdx].value : pickedTheme;
  setThemeMode(previewTheme);
  const colors = getColors();

  useInput((input, key) => {
    if (step === 'welcome') {
      if (key.return) setStep('theme');
      return;
    }
    if (step === 'theme') {
      if (key.upArrow)
        setThemeIdx((i) => (i - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length);
      else if (key.downArrow)
        setThemeIdx((i) => (i + 1) % THEME_OPTIONS.length);
      else if (key.return) {
        const chosen = THEME_OPTIONS[themeIdx].value;
        setPickedTheme(chosen);
        setThemeMode(chosen);
        setStep('backend');
      }
    } else if (step === 'backend') {
      if (key.upArrow)
        setBackendIdx((i) => (i - 1 + BACKEND_OPTIONS.length) % BACKEND_OPTIONS.length);
      else if (key.downArrow)
        setBackendIdx((i) => (i + 1) % BACKEND_OPTIONS.length);
      else if (key.return) {
        onDone(pickedTheme, BACKEND_OPTIONS[backendIdx].value);
      } else if (key.escape) {
        setStep('theme');
      }
    }
  });

  if (step === 'welcome') {
    const ready = logoFrame >= LOGO.length;
    return (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Box flexDirection="column">
          {LOGO.slice(0, logoFrame).map((line, i) => (
            <Text key={i} color={colors.signature} bold>{line}</Text>
          ))}
        </Box>
        {ready && (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text color={colors.accent} bold>─────  Your local coding companion  ─────</Text>
            <Box marginTop={1}>
              <Text color={colors.dim}>Press </Text>
              <Text color={colors.accent} bold>Enter</Text>
              <Text color={colors.dim}> to begin</Text>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  const stepNum = step === 'theme' ? 1 : 2;
  const stepTitle = step === 'theme' ? 'Choose your theme' : 'Choose your engine';
  const stepHint = step === 'theme'
    ? '↑/↓ navigate   ⏎ select'
    : '↑/↓ navigate   ⏎ select   esc back';
  const options = step === 'theme' ? THEME_OPTIONS : BACKEND_OPTIONS;
  const activeIdx = step === 'theme' ? themeIdx : backendIdx;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.signature} paddingX={3} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={colors.signature} bold>✦ Welcome to Claude</Text>
        <Text color={colors.dim}>{stepNum} / 2</Text>
      </Box>
      <Text color={colors.dim}>────────────────────────────────────────────────</Text>
      <Box marginTop={1} marginBottom={1}>
        <Text color={colors.text} bold>{stepTitle}</Text>
      </Box>
      <Box flexDirection="column">
        {options.map((opt, i) => {
          const active = i === activeIdx;
          return (
            <Box key={opt.value} marginY={0}>
              <Text color={active ? colors.signature : colors.dim}>{active ? '▸ ' : '  '}</Text>
              <Box width={26}>
                <Text color={active ? colors.accent : colors.text} bold={active}>{opt.label}</Text>
              </Box>
              <Text color={active ? colors.text : colors.dim}>{opt.hint}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.dim}>────────────────────────────────────────────────</Text>
      </Box>
      <Box justifyContent="space-between" marginTop={1}>
        <Text color={colors.dim}>{stepHint}</Text>
        {step === 'backend' && (
          <Box>
            <Text color={colors.dim}>theme: </Text>
            <Text color={colors.accent}>{getThemeLabel(pickedTheme)}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
