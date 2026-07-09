import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
const clients = [];
let mcpStatus = [];
export function getMcpStatus() { return mcpStatus; }
function logMcp(msg) {
    try {
        fs.appendFileSync(path.join(os.homedir(), '.claude', 'mcp.log'), new Date().toISOString() + ' ' + msg + '\n');
    }
    catch { }
}
export async function loadMcpTools() {
    const configPath = path.join(os.homedir(), '.claude', 'mcp.json');
    let raw;
    try {
        raw = fs.readFileSync(configPath, 'utf8');
    }
    catch {
        return {}; // 설정 없음 → MCP 미사용
    }
    let servers;
    try {
        const parsed = JSON.parse(raw);
        servers = parsed.mcpServers ?? parsed.servers ?? {};
    }
    catch (e) {
        logMcp('[mcp] mcp.json 파싱 실패: ' + String(e?.message ?? e));
        return {};
    }
    let merged = {};
    mcpStatus = [];
    for (const [name, conf] of Object.entries(servers)) {
        try {
            let client;
            if (conf.command) {
                const transport = new Experimental_StdioMCPTransport({
                    command: conf.command,
                    args: conf.args ?? [],
                    env: conf.env,
                });
                client = await createMCPClient({ transport });
            }
            else if (conf.url) {
                client = await createMCPClient({
                    transport: { type: 'sse', url: conf.url },
                });
            }
            else {
                logMcp('[mcp] ' + name + ': command 또는 url 필요 - 건너뜀');
                continue;
            }
            const toolSet = await client.tools();
            // 서버 이름을 접두어로 붙여 충돌 방지
            for (const [tName, tDef] of Object.entries(toolSet)) {
                merged[name + '__' + tName] = tDef;
            }
            clients.push(client);
            mcpStatus.push({ name, toolCount: Object.keys(toolSet).length, toolNames: Object.keys(toolSet), ok: true });
            logMcp('[mcp] ' + name + ' 연결됨 (' + Object.keys(toolSet).length + '개 툴)');
        }
        catch (e) {
            logMcp('[mcp] ' + name + ' 연결 실패: ' + String(e?.message ?? e));
            mcpStatus.push({ name, toolCount: 0, toolNames: [], ok: false, error: String(e?.message ?? e) });
        }
    }
    return merged;
}
export async function closeMcpClients() {
    await Promise.all(clients.map((c) => c.close().catch(() => { })));
    clients.length = 0;
}
//# sourceMappingURL=mcp.js.map