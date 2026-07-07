const usage = {};
function ensure(provider) {
    if (!usage[provider]) {
        usage[provider] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 };
    }
    return usage[provider];
}
export function addUsage(provider, u) {
    const p = ensure(provider);
    p.inputTokens += u.inputTokens ?? 0;
    p.outputTokens += u.outputTokens ?? 0;
    p.totalTokens += u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
    p.turns += 1;
}
export function getUsageByProvider() {
    return { ...usage };
}
export function getUsage() {
    const total = { inputTokens: 0, outputTokens: 0, totalTokens: 0, turns: 0 };
    for (const p of Object.values(usage)) {
        total.inputTokens += p.inputTokens;
        total.outputTokens += p.outputTokens;
        total.totalTokens += p.totalTokens;
        total.turns += p.turns;
    }
    return total;
}
export function resetUsage() {
    for (const k of Object.keys(usage))
        delete usage[k];
}
// USD per 1M tokens
const PRICING = {
    gemini: { input: 0.30, output: 2.50 }, // gemini-2.5-flash
    groq: { input: 0.59, output: 0.79 }, // llama-3.3-70b 추정
    manual: { input: 0, output: 0 },
};
export function estimateCost(provider, u) {
    const p = PRICING[provider] ?? { input: 0, output: 0 };
    return (u.inputTokens * p.input + u.outputTokens * p.output) / 1_000_000;
}
export function formatCost(usd) {
    if (usd < 0.0001)
        return '$0.0000';
    if (usd < 0.01)
        return '$' + usd.toFixed(5);
    return '$' + usd.toFixed(4);
}
export function formatTokensCompact(n) {
    if (n < 1000)
        return String(n);
    if (n < 1_000_000)
        return (n / 1000).toFixed(1) + 'k';
    return (n / 1_000_000).toFixed(1) + 'M';
}
//# sourceMappingURL=usage.js.map