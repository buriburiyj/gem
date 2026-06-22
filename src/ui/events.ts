import { EventEmitter } from 'node:events';

export type ToolEvent =
  | { kind: 'tool_call'; id: string; name: string; input: any }
  | { kind: 'tool_result'; id: string; name: string; ok: boolean; summary: string };

class Bus extends EventEmitter {}
export const bus = new Bus();

export function emitToolCall(id: string, name: string, input: any) {
  bus.emit('tool', { kind: 'tool_call', id, name, input } as ToolEvent);
}

export function emitToolResult(id: string, name: string, ok: boolean, summary: string) {
  bus.emit('tool', { kind: 'tool_result', id, name, ok, summary } as ToolEvent);
}
