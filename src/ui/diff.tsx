import React from 'react';
import { Box, Text } from 'ink';

export function DiffView({ oldText, newText, filePath }: { oldText: string; newText: string; filePath?: string }) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: { type: 'add' | 'del' | 'same'; text: string }[] = [];
  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) { result.push({ type: 'add', text: newLines[j] }); j++; }
    else if (j >= newLines.length) { result.push({ type: 'del', text: oldLines[i] }); i++; }
    else if (oldLines[i] === newLines[j]) { result.push({ type: 'same', text: newLines[j] }); i++; j++; }
    else { result.push({ type: 'del', text: oldLines[i] }); result.push({ type: 'add', text: newLines[j] }); i++; j++; }
  }
  return (
    <Box flexDirection="column" marginLeft={2}>
      {filePath && <Box><Text dimColor>{`⎿  ${filePath}`}</Text></Box>}
      {result.map((line, idx) => {
        if (line.type === 'add') return (<Box key={idx}><Text color="green">+ {line.text}</Text></Box>);
        if (line.type === 'del') return (<Box key={idx}><Text color="red">- {line.text}</Text></Box>);
        return (<Box key={idx}><Text dimColor>{'  ' + line.text}</Text></Box>);
      })}
    </Box>
  );
}
