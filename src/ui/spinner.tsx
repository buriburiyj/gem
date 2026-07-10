import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

const FRAMES = ['·', '✻', '✽', '✶', '✳', '✢'];

const WORDS = [
  'Accomplishing', 'Architecting', 'Baking', 'Brewing', 'Calculating',
  'Cascading', 'Cerebrating', 'Channeling', 'Churning', 'Clauding',
  'Cogitating', 'Combobulating', 'Composing', 'Computing', 'Concocting',
  'Considering', 'Contemplating', 'Cooking', 'Crafting', 'Creating',
  'Crunching', 'Deciphering', 'Deliberating', 'Doodling', 'Envisioning',
  'Fermenting', 'Forging', 'Generating', 'Grooving', 'Harmonizing',
  'Hashing', 'Hatching', 'Hyperspacing', 'Ideating', 'Imagining',
  'Improvising', 'Incubating', 'Inferring', 'Kneading', 'Manifesting',
  'Marinating', 'Mulling', 'Musing', 'Noodling', 'Orbiting',
  'Orchestrating', 'Percolating', 'Pondering', 'Processing', 'Puzzling',
  'Reticulating', 'Ruminating', 'Seasoning', 'Simmering', 'Sketching',
  'Spelunking', 'Spinning', 'Stewing', 'Synthesizing', 'Tempering',
  'Thinking', 'Tinkering', 'Unfurling', 'Vibing', 'Wandering',
  'Whisking', 'Working', 'Wrangling', 'Zesting',
];

function formatTok(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}

const TOOL_WORDS: Record<string, string> = {
  read_file: 'Reading',
  write_file: 'Writing',
  edit_file: 'Editing',
  bash: 'Running',
  glob: 'Globbing',
  grep: 'Searching',
  ls: 'Listing',
  web_search: 'Searching the web',
  skill: 'Applying skill',
};

export function ClaudeSpinner({ startTime, tokens, activeTool }: { startTime: number; tokens?: number; activeTool?: string }) {
  const [frame, setFrame] = useState(0);
  const [word] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const a = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 120);
    const b = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [startTime]);

  return (
    <Text>
      <Text color="#D77757">{FRAMES[frame]}</Text>
      <Text color="#D77757">{' ' + (activeTool && TOOL_WORDS[activeTool] ? TOOL_WORDS[activeTool] : word)}…</Text>
      <Text dimColor>{` (${formatElapsed(elapsed)}${tokens ? ` · ↑ ${formatTok(tokens)} tokens` : ''} · esc to interrupt)`}</Text>
    </Text>
  );
}
