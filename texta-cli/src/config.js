// src/config.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.texta');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CACHE_FILE = path.join(CONFIG_DIR, 'cache.json'); // stores last list result

function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

function readConfig() {
    ensureConfigDir();
    if (!fs.existsSync(CONFIG_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function writeConfig(data) {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function getToken() {
    return readConfig().token || null;
}

function getRefreshToken() {
    return readConfig().refreshToken || null;
}

function getUser() {
    return readConfig().user || null;
}

function setAuth(token, refreshToken, user) {
    const config = readConfig();
    config.token = token;
    config.refreshToken = refreshToken || null;
    config.user = user;
    writeConfig(config);
}

function clearAuth() {
    const config = readConfig();
    delete config.token;
    delete config.refreshToken;
    delete config.user;
    writeConfig(config);
}

function getBaseUrl() {
    const config = readConfig();
    return config.baseUrl || process.env.TEXTA_API_URL || 'http://localhost:3000/api/v1';
}

function setBaseUrl(url) {
    const config = readConfig();
    config.baseUrl = url;
    writeConfig(config);
}

// ─── Task cache (# → ID mapping) ─────────────────────────────────────────────
// Every time `texta list` runs it saves the ordered task list here.
// Other commands call resolveTaskId() to convert a row number to a real ID.

function saveTaskCache(tasks) {
    ensureConfigDir();
    // Store minimal info: position (1-based), id, and message for confirmation
    const cache = tasks.map((t, i) => ({
        num: i + 1,
        id: (t.id || t._id).toString(),
        msg: (t.message || t.text || '').substring(0, 60),
    }));
    try {
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify({ tasks: cache, savedAt: new Date().toISOString() }, null, 2)
        );
    } catch {
        /* non-fatal */
    }
}

function resolveTaskId(input) {
    // If input is a plain number (1, 2, 3…) look it up in the cache
    if (/^\d+$/.test(String(input).trim())) {
        const num = parseInt(input, 10);
        let cache = { tasks: [] };
        try {
            cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } catch {
            /* no cache yet */
        }

        const entry = cache.tasks.find((t) => t.num === num);
        if (!entry) return { id: null, num, notFound: true, cacheEmpty: cache.tasks.length === 0 };
        return { id: entry.id, num, msg: entry.msg, fromCache: true };
    }
    // Otherwise treat as a full 24-char MongoDB ObjectId
    return { id: input, num: null, fromCache: false };
}

module.exports = {
    getToken,
    getRefreshToken,
    getUser,
    setAuth,
    clearAuth,
    getBaseUrl,
    setBaseUrl,
    saveTaskCache,
    resolveTaskId,
};
