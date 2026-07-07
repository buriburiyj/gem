// 테마 시스템 — 터미널 배경은 못 바꾸니 텍스트/보더/액센트 색으로 표현
// Claude 시그니처 오렌지(#D77757)는 모든 테마에서 유지
const LIGHT = {
    signature: '#D77757',
    text: 'black',
    dim: 'gray',
    border: 'black',
    accent: '#D77757',
    user: 'blue',
    assistant: 'black',
    success: 'green',
    error: 'red',
    info: 'cyan',
    label: '☀️  라이트',
};
const DARK = {
    signature: '#D77757',
    text: 'white',
    dim: 'gray',
    border: 'white',
    accent: '#D77757',
    user: 'cyan',
    assistant: 'white',
    success: 'green',
    error: 'red',
    info: 'magenta',
    label: '🌙 다크',
};
// 시간대별 자동 테마
function autoColors() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
        // 아침 — 부드러운 노랑
        return {
            signature: '#D77757',
            text: '#FFF4C2',
            dim: '#C9A96E',
            border: '#FFB347',
            accent: '#FFB347',
            user: '#FFD700',
            assistant: '#FFF4C2',
            success: 'green',
            error: 'red',
            info: '#FFB347',
            label: `🌅 자동 · 아침 (${hour}시)`,
        };
    }
    if (hour >= 12 && hour < 18) {
        // 낮 — 흰색
        return { ...LIGHT, label: `☀️  자동 · 낮 (${hour}시)` };
    }
    if (hour >= 18 && hour < 21) {
        // 노을 — 주황
        return {
            signature: '#D77757',
            text: '#FFDAB9',
            dim: '#CD853F',
            border: '#FF8C42',
            accent: '#FF8C42',
            user: '#FFA07A',
            assistant: '#FFDAB9',
            success: 'green',
            error: 'red',
            info: '#FF8C42',
            label: `🌇 자동 · 노을 (${hour}시)`,
        };
    }
    if (hour >= 21 && hour < 24) {
        // 저녁 — 보라
        return {
            signature: '#D77757',
            text: '#E0BBE4',
            dim: '#957DAD',
            border: '#9B7EDE',
            accent: '#9B7EDE',
            user: '#C9A0DC',
            assistant: '#E0BBE4',
            success: 'green',
            error: 'red',
            info: '#9B7EDE',
            label: `🌙 자동 · 저녁 (${hour}시)`,
        };
    }
    // 새벽 — 다크
    return { ...DARK, label: `🌌 자동 · 새벽 (${hour}시)` };
}
// 현재 활성 테마 (런타임 변경 가능)
let currentMode = 'auto';
export function setThemeMode(mode) {
    currentMode = mode;
}
export function getThemeMode() {
    return currentMode;
}
export function getColors() {
    if (currentMode === 'light')
        return LIGHT;
    if (currentMode === 'dark')
        return DARK;
    return autoColors();
}
export function getThemeLabel(mode) {
    const m = mode ?? currentMode;
    if (m === 'light')
        return '☀️  라이트';
    if (m === 'dark')
        return '🌙 다크';
    return autoColors().label;
}
//# sourceMappingURL=theme.js.map