import { EventEmitter } from 'node:events';

export type ApprovalRequest = {
  id: string;
  toolName: string;
  summary: string;
  detail?: string;
};

export type ApprovalAnswer = 'yes' | 'no' | 'always';

class Bus extends EventEmitter {}
export const approvalBus = new Bus();

// 세션 동안 자동 승인할 도구 이름들
const sessionAllow = new Set<string>();

export function isSessionAllowed(toolName: string): boolean {
  return sessionAllow.has(toolName);
}

export function allowForSession(toolName: string) {
  sessionAllow.add(toolName);
}

let counter = 0;

export function requestApproval(
  toolName: string,
  summary: string,
  detail?: string,
): Promise<ApprovalAnswer> {
  if (isSessionAllowed(toolName)) {
    return Promise.resolve('yes');
  }
  const id = `approval-${++counter}`;
  return new Promise((resolve) => {
    const onAnswer = (req: { id: string; answer: ApprovalAnswer }) => {
      if (req.id !== id) return;
      approvalBus.off('answer', onAnswer);
      if (req.answer === 'always') allowForSession(toolName);
      resolve(req.answer);
    };
    approvalBus.on('answer', onAnswer);
    approvalBus.emit('request', { id, toolName, summary, detail } as ApprovalRequest);
  });
}

export function answerApproval(id: string, answer: ApprovalAnswer) {
  approvalBus.emit('answer', { id, answer });
}
