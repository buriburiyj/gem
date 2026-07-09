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
                    stderr: 'ignore',
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
const CONFIG_PATH = path.join(os.homedir(), '.claude', 'mcp.json');
function readConfig() {
    try {
        const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return { mcpServers: parsed.mcpServers ?? parsed.servers ?? {} };
    }
    catch {
        return { mcpServers: {} };
    }
}
function writeConfig(cfg) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
export function listMcpConfig() {
    const cfg = readConfig();
    return Object.entries(cfg.mcpServers).map(([name, c]) => ({
        name,
        command: c.command ? [c.command, ...(c.args ?? [])].join(' ') : (c.url ?? '(unknown)'),
    }));
}
export function addMcpServer(name, command, args) {
    if (!name || !command)
        return 'error: 이름과 명령이 필요합니다.';
    const cfg = readConfig();
    cfg.mcpServers[name] = { command, args };
    writeConfig(cfg);
    return 'ok: ' + name + ' 추가됨 (' + command + ' ' + args.join(' ') + ')';
}
export function removeMcpServer(name) {
    const cfg = readConfig();
    if (!cfg.mcpServers[name])
        return 'error: ' + name + ' 서버가 없습니다.';
    delete cfg.mcpServers[name];
    writeConfig(cfg);
    return 'ok: ' + name + ' 삭제됨';
}
export async function closeMcpClients() {
    await Promise.all(clients.map((c) => c.close().catch(() => { })));
    clients.length = 0;
}
//# sourceMappingURL=mcp.js.map