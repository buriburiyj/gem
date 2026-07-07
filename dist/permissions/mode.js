const state = { current: 'default' };
export function getMode() {
    return state.current;
}
export function setMode(m) {
    state.current = m;
}
// Shift+Tab 순환 순서 (Claude Code와 동일)
const CYCLE = ['default', 'acceptEdits', 'plan'];
export function cycleMode() {
    const idx = CYCLE.indexOf(state.current);
    // bypassPermissions 상태였다면 default로 복귀
    const next = idx === -1 ? 'default' : CYCLE[(idx + 1) % CYCLE.length];
    state.current = next;
    return next;
}
export function modeLabel(m) {
    switch (m) {
        case 'default':
            return 'default mode';
        case 'acceptEdits':
            return 'accept edits';
        case 'plan':
            return 'plan mode';
        case 'bypassPermissions':
            return 'bypass permissions';
    }
}
export function modeColor(m) {
    switch (m) {
        case 'default':
            return 'gray';
        case 'acceptEdits':
            return 'green';
        case 'plan':
            return 'cyan';
        case 'bypassPermissions':
            return 'red';
    }
}
//# sourceMappingURL=mode.js.map