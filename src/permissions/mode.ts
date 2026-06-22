export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'bypassPermissions';

const state: { current: PermissionMode } = { current: 'default' };

export function getMode(): PermissionMode {
  return state.current;
}

export function setMode(m: PermissionMode) {
  state.current = m;
}

// Shift+Tab 순환 순서 (Claude Code와 동일)
const CYCLE: PermissionMode[] = ['default', 'acceptEdits', 'plan'];

export function cycleMode(): PermissionMode {
  const idx = CYCLE.indexOf(state.current);
  // bypassPermissions 상태였다면 default로 복귀
  const next = idx === -1 ? 'default' : CYCLE[(idx + 1) % CYCLE.length];
  state.current = next;
  return next;
}

export function modeLabel(m: PermissionMode): string {
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

export function modeColor(m: PermissionMode): string {
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
