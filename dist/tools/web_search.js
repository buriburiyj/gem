import { tool } from 'ai';
import { z } from 'zod';
import { emitToolCall, emitToolResult } from '../ui/events.js';
let callCounter = 0;
export const webSearchTool = tool({
    description: '웹을 검색해 최신 정보를 가져옵니다. 뉴스, 문서, 유튜브, 최근 사건 등 학습 데이터에 없거나 최신 정보가 필요할 때 사용하세요. 결과로 제목, URL, 요약을 반환합니다.',
    inputSchema: z.object({
        query: z.string().describe('검색어 (예: "최신 React 19 기능", "cursor AI 사용법")'),
        max_results: z.number().optional().describe('가져올 결과 수 (기본 5, 최대 10)'),
    }),
    execute: async ({ query, max_results }) => {
        const id = `web-${++callCounter}`;
        emitToolCall(id, 'web_search', { query });
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
            const msg = 'TAVILY_API_KEY가 설정되지 않았습니다. https://tavily.com 에서 무료 키를 발급받아 .env에 TAVILY_API_KEY=... 로 추가하세요.';
            emitToolResult(id, 'web_search', false, msg);
            return { error: msg };
        }
        const n = Math.min(max_results ?? 5, 10);
        try {
            const res = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: apiKey,
                    query,
                    max_results: n,
                    include_answer: true,
                    search_depth: 'advanced',
                }),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                const msg = `검색 API 오류 (${res.status}): ${txt.slice(0, 200)}`;
                emitToolResult(id, 'web_search', false, msg);
                return { error: msg };
            }
            const data = await res.json();
            const results = (data.results ?? []).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: (r.content ?? '').slice(0, 300),
            }));
            emitToolResult(id, 'web_search', true, `Found ${results.length} results for "${query}"`);
            return { query, answer: data.answer ?? null, results };
        }
        catch (err) {
            emitToolResult(id, 'web_search', false, err.message);
            return { error: `검색 실패: ${err.message}` };
        }
    },
});
//# sourceMappingURL=web_search.js.map