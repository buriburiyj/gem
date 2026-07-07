import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const CONFIG_DIR = path.join(os.homedir(), '.claude');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_CONFIG = {
    theme: 'auto',
    backend: 'gemini',
    ollamaModel: 'qwen2.5-coder:7b',
    configured: false,
    trusted: false,
};
export function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH))
            return { ...DEFAULT_CONFIG };
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
}
export function saveConfig(cfg) {
    try {
        if (!fs.existsSync(CONFIG_DIR))
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        const current = loadConfig();
        const merged = { ...current, ...cfg };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('Failed to save config:', err);
    }
}
export function getConfigPath() {
    return CONFIG_PATH;
}
//# sourceMappingURL=store.js.map