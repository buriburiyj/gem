import { EventEmitter } from 'node:events';
class Bus extends EventEmitter {
}
export const approvalBus = new Bus();
// 세션 동안 자동 승인할 도구 이름들
const sessionAllow = new Set();
export function isSessionAllowed(toolName) {
    return sessionAllow.has(toolName);
}
export function allowForSession(toolName) {
    sessionAllow.add(toolName);
}
let counter = 0;
export function requestApproval(toolName, summary, detail) {
    if (isSessionAllowed(toolName)) {
        return Promise.resolve('yes');
    }
    const id = `approval-${++counter}`;
    return new Promise((resolve) => {
        const onAnswer = (req) => {
            if (req.id !== id)
                return;
            approvalBus.off('answer', onAnswer);
            if (req.answer === 'always')
                allowForSession(toolName);
            resolve(req.answer);
        };
        approvalBus.on('answer', onAnswer);
        approvalBus.emit('request', { id, toolName, summary, detail });
    });
}
export function answerApproval(id, answer) {
    approvalBus.emit('answer', { id, answer });
}
//# sourceMappingURL=prompt.js.map