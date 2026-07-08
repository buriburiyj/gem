import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const ENV_DIR = path.join(os.homedir(), '.claude');
const ENV_PATH = path.join(ENV_DIR, '.env');
// ~/.claude/.env 에 KEY=VALUE 를 추가하거나 기존 값을 갱신
export async function saveEnvKey(key, value) {
    await mkdir(ENV_DIR, { recursive: true });
    let content = '';
    try {
        content = await readFile(ENV_PATH, 'utf-8');
    }
    catch { }
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) {
        content = content.replace(re, line);
    }
    else {
        if (content.length > 0 && !content.endsWith('\n'))
            content += '\n';
        content += line + '\n';
    }
    await writeFile(ENV_PATH, content, { mode: 0o600 });
    // 즉시 현재 프로세스 환경에도 반영
    process.env[key] = value;
}
// 특정 키가 이미 설정돼 있는지 확인
export function hasEnvKey(key) {
    return typeof process.env[key] === 'string' && process.env[key].length > 0;
}
//# sourceMappingURL=env.js.map