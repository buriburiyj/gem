import { EventEmitter } from 'node:events';

export type ToolEvent =
  | { kind: 'tool_call'; id: string; name: string; input: any }
  | { kind: 'tool_result'; id: string; name: string; ok: boolean; summary: string }
  | { kind: 'diff'; id: string; filePath: string; oldText: string; newText: string };

export const bus = new EventEmitter();

export function emitToolCall(id: string, name: string, input: any) {
  bus.emit('tool', { kind: 'tool_call', id, name, input });
}

export function emitToolResult(id: string, name: string, ok: boolean, summary: string) {
  bus.emit('tool', { kind: 'tool_result', id, name, ok, summary });
}

export function emitDiff(id: string, filePath: string, oldText: string, newText: string) {
  bus.emit('tool', { kind: 'diff', id, filePath, oldText, newText });
}
