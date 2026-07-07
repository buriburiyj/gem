import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
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
function formatTok(n) {
    if (n >= 1000)
        return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
}
export function ClaudeSpinner({ startTime, tokens }) {
    const [frame, setFrame] = useState(0);
    const [word] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const a = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 120);
        const b = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
        return () => { clearInterval(a); clearInterval(b); };
    }, [startTime]);
    return (_jsxs(Text, { children: [_jsx(Text, { color: "#D77757", children: FRAMES[frame] }), _jsxs(Text, { color: "#D77757", children: [' ' + word, "\u2026"] }), _jsx(Text, { dimColor: true, children: ` (${elapsed}s${tokens ? ` · ↑ ${formatTok(tokens)} tokens` : ''} · esc to interrupt)` })] }));
}
//# sourceMappingURL=spinner.js.map