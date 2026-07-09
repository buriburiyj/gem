import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const SESSION_DIR = path.join(os.homedir(), '.claude', 'sessions');
async function ensureDir() {
    await fs.mkdir(SESSION_DIR, { recursive: true });
}
export function newSessionId() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        '-' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds()));
}
export async function saveSession(s) {
    await ensureDir();
    s.updatedAt = Date.now();
    const file = path.join(SESSION_DIR, `${s.id}.json`);
    await fs.writeFile(file, JSON.stringify(s, null, 2), 'utf-8');
}
export async function listSessions() {
    try {
        await ensureDir();
        const files = await fs.readdir(SESSION_DIR);
        const sessions = [];
        for (const f of files) {
            if (!f.endsWith('.json'))
                continue;
            try {
                const raw = await fs.readFile(path.join(SESSION_DIR, f), 'utf-8');
                sessions.push(JSON.parse(raw));
            }
            catch { }
        }
        return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    catch {
        return [];
    }
}
export async function loadSession(id) {
    try {
        const file = path.join(SESSION_DIR, `${id}.json`);
        const raw = await fs.readFile(file, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function deleteSession(id) {
    try {
        const file = path.join(SESSION_DIR, `${id}.json`);
        await fs.unlink(file);
        return true;
    }
    catch {
        return false;
    }
}
export async function loadLatest() {
    const all = await listSessions();
    return all[0] ?? null;
}
export function summarizeSession(s) {
    const firstUser = s.messages.find((m) => m.role === 'user');
    const preview = firstUser?.content.slice(0, 50).replace(/\n/g, ' ') ?? '(빈 세션)';
    const d = new Date(s.updatedAt);
    const pad = (n) => String(n).padStart(2, '0');
    const when = `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${s.id}  ${when}  (${s.messages.length}msg)  ${preview}`;
}
export function groupByCwd(sessions) {
    const groups = new Map();
    for (const sess of sessions) {
        const key = sess.cwd || '(unknown)';
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(sess);
    }
    return groups;
}
//# sourceMappingURL=store.js.map