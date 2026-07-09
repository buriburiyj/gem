import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

// ~/.claude/mcp.json 형식 (Claude Desktop 호환):
// {
//   "mcpServers": {
//     "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"] },
//     "some-http":  { "url": "http://localhost:3000/mcp" }
//   }
// }

type ServerConf = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
};

const clients: Array<{ close: () => Promise<void> }> = [];

function logMcp(msg: string): void {
  try {
    fs.appendFileSync(path.join(os.homedir(), '.claude', 'mcp.log'), new Date().toISOString() + ' ' + msg + '\n');
  } catch {}
}

export async function loadMcpTools(): Promise<Record<string, any>> {
  const configPath = path.join(os.homedir(), '.claude', 'mcp.json');
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    return {}; // 설정 없음 → MCP 미사용
  }

  let servers: Record<string, ServerConf>;
  try {
    const parsed = JSON.parse(raw);
    servers = parsed.mcpServers ?? parsed.servers ?? {};
  } catch (e: any) {
    logMcp('[mcp] mcp.json 파싱 실패: ' + String(e?.message ?? e));
    return {};
  }

  let merged: Record<string, any> = {};

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
      } else if (conf.url) {
        client = await createMCPClient({
          transport: { type: 'sse', url: conf.url },
        });
      } else {
        logMcp('[mcp] ' + name + ': command 또는 url 필요 - 건너뜀');
        continue;
      }

      const toolSet = await client.tools();
      // 서버 이름을 접두어로 붙여 충돌 방지
      for (const [tName, tDef] of Object.entries(toolSet)) {
        merged[name + '__' + tName] = tDef;
      }
      clients.push(client as any);
      logMcp('[mcp] ' + name + ' 연결됨 (' + Object.keys(toolSet).length + '개 툴)');
    } catch (e: any) {
      logMcp('[mcp] ' + name + ' 연결 실패: ' + String(e?.message ?? e));
    }
  }

  return merged;
}

export async function closeMcpClients(): Promise<void> {
  await Promise.all(clients.map((c) => c.close().catch(() => {})));
  clients.length = 0;
}
