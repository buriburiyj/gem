import { EventEmitter } from 'node:events';
export const bus = new EventEmitter();
export function emitToolCall(id, name, input) {
    bus.emit('tool', { kind: 'tool_call', id, name, input });
}
export function emitToolResult(id, name, ok, summary) {
    bus.emit('tool', { kind: 'tool_result', id, name, ok, summary });
}
export function emitDiff(id, filePath, oldText, newText) {
    bus.emit('tool', { kind: 'diff', id, filePath, oldText, newText });
}
//# sourceMappingURL=events.js.map