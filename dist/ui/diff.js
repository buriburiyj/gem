import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function DiffView({ oldText, newText, filePath }) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result = [];
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
        if (i >= oldLines.length) {
            result.push({ type: 'add', text: newLines[j] });
            j++;
        }
        else if (j >= newLines.length) {
            result.push({ type: 'del', text: oldLines[i] });
            i++;
        }
        else if (oldLines[i] === newLines[j]) {
            result.push({ type: 'same', text: newLines[j] });
            i++;
            j++;
        }
        else {
            result.push({ type: 'del', text: oldLines[i] });
            result.push({ type: 'add', text: newLines[j] });
            i++;
            j++;
        }
    }
    return (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [filePath && _jsx(Box, { children: _jsx(Text, { dimColor: true, children: `⎿  ${filePath}` }) }), result.map((line, idx) => {
                if (line.type === 'add')
                    return (_jsx(Box, { children: _jsxs(Text, { color: "green", children: ["+ ", line.text] }) }, idx));
                if (line.type === 'del')
                    return (_jsx(Box, { children: _jsxs(Text, { color: "red", children: ["- ", line.text] }) }, idx));
                return (_jsx(Box, { children: _jsx(Text, { dimColor: true, children: '  ' + line.text }) }, idx));
            })] }));
}
//# sourceMappingURL=diff.js.map