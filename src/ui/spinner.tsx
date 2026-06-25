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

export function ClaudeSpinner({ startTime }: { startTime: number }) {
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
      <Text color="#D77757">{' ' + word}…</Text>
      <Text dimColor>{` (${elapsed}s · esc to interrupt)`}</Text>
    </Text>
  );
}
