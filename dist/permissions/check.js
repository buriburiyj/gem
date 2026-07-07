import { getMode } from './mode.js';
// 위험한 bash 명령 패턴
const DANGEROUS_BASH = [
    /\brm\s+-rf\s+\//,
    /\bsudo\b/,
    /\bmkfs\b/,
    /\bdd\s+if=/,
    /:\(\)\{/, // fork bomb
    /\bchmod\s+-R\s+777\s+\//,
    /\b>\s*\/dev\/sda/,
    /\bcurl\s+[^|]*\|\s*sh\b/,
    /\bwget\s+[^|]*\|\s*sh\b/,
];
function isDangerousBash(cmd) {
    return DANGEROUS_BASH.some((re) => re.test(cmd));
}
export function checkPermission(kind, info = {}) {
    const mode = getMode();
    if (mode === 'bypassPermissions')
        return { kind: 'allow' };
    if (mode === 'plan') {
        if (kind === 'read')
            return { kind: 'allow' };
        return {
            kind: 'deny',
            reason: 'plan 모드에서는 변경 작업이 차단됩니다. 계획만 제안하세요.',
        };
    }
    if (kind === 'read')
        return { kind: 'allow' };
    if (mode === 'acceptEdits') {
        if (kind === 'write' || kind === 'edit')
            return { kind: 'allow' };
        if (kind === 'bash') {
            if (info.command && isDangerousBash(info.command))
                return { kind: 'ask' };
            return { kind: 'allow' };
        }
    }
    // default mode
    if (kind === 'bash' && info.command && isDangerousBash(info.command)) {
        return { kind: 'ask' };
    }
    return { kind: 'ask' };
}
//# sourceMappingURL=check.js.map