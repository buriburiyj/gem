import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ThemeMode, getThemeLabel, setThemeMode, getColors } from './theme.js';
import { saveEnvKey, hasEnvKey } from '../config/env.js';

type Step = 'welcome' | 'theme' | 'apikey';

type Props = {
  onDone: (theme: ThemeMode) => void;
};

const THEME_OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'light', label: 'Light',           hint: 'Clean and bright' },
  { value: 'dark',  label: 'Dark',            hint: 'Easy on the eyes' },
  { value: 'auto',  label: 'Auto · Adaptive', hint: 'Shifts with the time of day' },
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
  const [logoFrame, setLogoFrame] = useState(0);
  const [chosenTheme, setChosenTheme] = useState<ThemeMode>('auto');

  // API key 입력 상태
  const keyAlreadySet = hasEnvKey('GOOGLE_GENERATIVE_AI_API_KEY');
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);

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

  const finish = (theme: ThemeMode) => onDone(theme);

  const submitKey = async () => {
    if (saving) return;
    const trimmed = keyInput.trim();
    if (trimmed.length > 0) {
      setSaving(true);
      await saveEnvKey('GOOGLE_GENERATIVE_AI_API_KEY', trimmed);
    }
    finish(chosenTheme);
  };

  const previewTheme = step === 'theme' ? THEME_OPTIONS[themeIdx].value : chosenTheme;
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
        const t = THEME_OPTIONS[themeIdx].value;
        setChosenTheme(t);
        setStep('apikey');
      }
      return;
    }
    if (step === 'apikey') {
      if (keyAlreadySet) {
        if (key.return) finish(chosenTheme);
        return;
      }
      if (key.return) { void submitKey(); return; }
      if (key.backspace || key.delete) {
        setKeyInput((v) => v.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setKeyInput((v) => v + input);
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
            <Text color={colors.accent} bold>─────  Your AI coding companion  ─────</Text>
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

  if (step === 'theme') {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={colors.signature} paddingX={3} paddingY={1}>
        <Box justifyContent="space-between" marginBottom={1}>
          <Text color={colors.signature} bold>✳ Welcome to Claude Code</Text>
          <Text color={colors.dim}>1 / 2</Text>
        </Box>
        <Text color={colors.dim}>────────────────────────────────────────────────</Text>
        <Box marginTop={1} marginBottom={1}>
          <Text color={colors.text} bold>Choose your theme</Text>
        </Box>
        <Box flexDirection="column">
          {THEME_OPTIONS.map((opt, i) => {
            const active = i === themeIdx;
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
        <Box marginTop={1}>
          <Text color={colors.dim}>↑/↓ navigate   ⏎ select</Text>
        </Box>
      </Box>
    );
  }

  // step === 'apikey'
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.signature} paddingX={3} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={colors.signature} bold>✳ Welcome to Claude Code</Text>
        <Text color={colors.dim}>2 / 2</Text>
      </Box>
      <Text color={colors.dim}>────────────────────────────────────────────────</Text>
      <Box marginTop={1} marginBottom={1}>
        <Text color={colors.text} bold>Gemini API key</Text>
      </Box>
      {keyAlreadySet ? (
        <Box flexDirection="column">
          <Text color={colors.accent}>✓ API key detected</Text>
          <Box marginTop={1}>
            <Text color={colors.dim}>Press </Text>
            <Text color={colors.accent} bold>Enter</Text>
            <Text color={colors.dim}> to continue</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color={colors.dim}>Get a free key at https://aistudio.google.com/apikey</Text>
          <Box marginTop={1}>
            <Text color={colors.signature}>{'▸ '}</Text>
            <Text color={colors.text}>
              {keyInput.length > 0 ? '•'.repeat(Math.min(keyInput.length, 40)) : ''}
            </Text>
            <Text color={colors.dim}>{keyInput.length === 0 ? 'paste your key here' : ''}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.dim}>⏎ save & continue   (leave empty to skip)</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
