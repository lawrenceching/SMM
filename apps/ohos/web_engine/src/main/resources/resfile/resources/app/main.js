const { app, BrowserWindow, Tray, nativeImage, Menu, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { createCoreRoutesRequestHandler } = require('./core-routes.js');

let mainWindow, tray;
let mainHttpServer = null;

const useDevPage = false;

const MAIN_HTTP_PORT = 18081;
const MAIN_HTTP_ORIGIN = `http://127.0.0.1:${MAIN_HTTP_PORT}`;
const MAIN_HTTP_HELLO_BODY = 'Hello from Electron Main process';
const APP_ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json; charset=utf-8',
};
const DIST_DIR = path.join(APP_ROOT, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');

const TEST_INDEX = path.join(APP_ROOT, 'testPage', 'index.html')

// Vite 输出的资源引用是 /assets/xxx.js 这种 root-absolute 形式。
// 当 index.html 以 file:///.../dist/index.html 加载时，浏览器把 /assets/xxx.js
// 解析成 file:///assets/xxx.js（根目录变成 /），导致 404。
// 这里用 webRequest.onBeforeRequest + redirectURL 把这类请求重定向到
// file:///.../dist/assets/xxx.js。为了安全，只对 DIST_DIR 下的根级项放行。

console.log(`>>> process.platform=${process.platform}`)
console.log(`>>> os.homedir=${os.homedir()}`)
console.log(`>>> os.tmpdir=${os.tmpdir()}`)

const allowedRootItems = new Set();
try {
    const entries = fs.readdirSync(DIST_DIR, { withFileTypes: true });
    for (const e of entries) {
        if (e.name === 'index.html') continue;
        allowedRootItems.add(e.name + (e.isDirectory() ? '/' : ''));
    }
} catch (e) {
    console.error('[electron-port] read DIST_DIR failed:', e);
}

function toFileUrl(absPath) {
    let p = absPath.replace(/\\/g, '/');
    if (/^[A-Za-z]:\//.test(p)) p = '/' + p; // Windows: C:/x -> /C:/x
    return 'file://' + p;                    // Linux/HarmonyOS: /data/x -> file:///data/x
}

function resolveRedirect(urlString) {
    if (!urlString.startsWith('file://')) return null;

    let pathname;
    try {
        pathname = new URL(urlString).pathname;
    } catch {
        return null;
    }

    // 只处理 Linux/HarmonyOS 形式（/xxx），跳过 Windows（/C:/xxx）
    if (!pathname.startsWith('/')) return null;
    if (/^\/[A-Za-z]:/.test(pathname)) return null;

    let rel;
    try {
        rel = decodeURIComponent(pathname.slice(1));
    } catch {
        rel = pathname.slice(1);
    }
    if (!rel) return null;

    // 含 .. 或 . 的请求解析后看是否还在 DIST_DIR 下
    if (rel.split('/').some(seg => seg === '..' || seg === '.')) {
        const abs = path.resolve(DIST_DIR, rel);
        if (abs !== DIST_DIR && !abs.startsWith(DIST_DIR + path.sep)) return null;
        return toFileUrl(abs);
    }

    // 根级白名单：只有 DIST_DIR 一级目录/文件中的项才允许映射
    const firstSeg = rel.split('/')[0];
    const first = firstSeg + (rel.includes('/') ? '/' : '');
    if (!allowedRootItems.has(first)) return null;

    return toFileUrl(path.join(DIST_DIR, rel));
}

function isPathWithinRoot(rootDir, absPath) {
    return absPath === rootDir || absPath.startsWith(rootDir + path.sep);
}

function getMimeType(filePath) {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function resolveStaticPath(rootDir, urlPath) {
    let pathname = urlPath;
    try {
        pathname = decodeURIComponent(urlPath);
    } catch {
        // keep raw pathname
    }

    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const abs = path.resolve(rootDir, rel);
    if (!isPathWithinRoot(rootDir, abs)) {
        return null;
    }
    return abs;
}

function serveStaticFile(req, res, rootDir) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
    }

    const url = req.url?.split('?')[0] ?? '/';
    const absPath = resolveStaticPath(rootDir, url);
    if (!absPath) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.stat(absPath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
            return;
        }

        res.writeHead(200, { 'Content-Type': getMimeType(absPath) });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        fs.createReadStream(absPath).pipe(res);
    });
}

function toPosixAllowlistEntry(dir) {
    return dir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1');
}

function buildCoreRoutesAllowlist() {
    const entries = new Set();
    const add = (dir) => {
        if (dir) entries.add(toPosixAllowlistEntry(dir));
    };

    try {
        add(app.getPath('userData'));
        add(app.getPath('temp'));
    } catch (err) {
        console.warn('[main] app.getPath failed, falling back to os.tmpdir():', err);
        add(os.tmpdir());
    }

    add(os.homedir());
    add(APP_ROOT);

    return [...entries];
}

function createCoreRoutesLogger() {
    return {
        debug: (obj, msg) => console.debug(`[core-routes] ${msg ?? 'debug'}`, obj),
        info: (obj, msg) => console.info(`[core-routes] ${msg ?? 'info'}`, obj),
        warn: (obj, msg) => console.warn(`[core-routes] ${msg ?? 'warn'}`, obj),
        error: (obj, msg) => console.error(`[core-routes] ${msg ?? 'error'}`, obj),
    };
}

/** Apply CORS headers on every response (Electron renderer may be cross-origin vs 127.0.0.1). */
function applyCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
    const requestedHeaders = req.headers['access-control-request-headers'];
    res.setHeader(
        'Access-Control-Allow-Headers',
        typeof requestedHeaders === 'string' && requestedHeaders.length > 0
            ? requestedHeaders
            : 'Content-Type, Authorization, x-trace-id',
    );
    res.setHeader('Access-Control-Max-Age', '86400');
}

function buildHelloConfig() {
    let userDataDir;
    let tmpDir;
    try {
        userDataDir = app.getPath('userData');
        tmpDir = app.getPath('temp');
    } catch (err) {
        console.warn('[main] app.getPath failed for hello config, falling back to os.tmpdir():', err);
        userDataDir = os.tmpdir();
        tmpDir = os.tmpdir();
    }

    const logDir = path.join(userDataDir, 'logs');
    let version = '0.0.0';
    try {
        version = require('./package.json').version;
    } catch {
        // keep default
    }

    return {
        version,
        userDataDir,
        appDataDir: userDataDir,
        logDir,
        tmpDir,
        reverseProxyUrl: null,
        osLocale: app.getLocale(),
    };
}

function startMainHttpServer() {
    if (mainHttpServer) return;

    const allowlist = buildCoreRoutesAllowlist();
    console.log('[main] core-routes allowlist:', allowlist);

    const coreRoutesHandler = createCoreRoutesRequestHandler(
        { allowlist, logger: createCoreRoutesLogger(), hello: buildHelloConfig() },
        { fallbackPort: MAIN_HTTP_PORT },
    );

    mainHttpServer = http.createServer((req, res) => {
        applyCorsHeaders(req, res);

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = req.url?.split('?')[0] ?? '';

        if (req.method === 'GET' && url === '/hello') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(MAIN_HTTP_HELLO_BODY);
            return;
        }

        if (url.startsWith('/api/')) {
            coreRoutesHandler(req, res);
            return;
        }

        serveStaticFile(req, res, DIST_DIR);
    });

    mainHttpServer.on('error', (err) => {
        console.error('[main] HTTP server error:', err);
    });

    mainHttpServer.listen(MAIN_HTTP_PORT, '127.0.0.1', () => {
        console.log(`[main] HTTP server listening on ${MAIN_HTTP_ORIGIN}/`);
    });
}

ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
        return win
            ? await dialog.showOpenDialog(win, options)
            : await dialog.showOpenDialog(options);
    } catch (err) {
        console.error('[main] dialog:showOpenDialog failed:', err);
        throw err;
    }
});

ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
        return win
            ? await dialog.showSaveDialog(win, options)
            : await dialog.showSaveDialog(options);
    } catch (err) {
        console.error('[main] dialog:showSaveDialog failed:', err);
        throw err;
    }
});

app.whenReady().then(() => {
    try {
        startMainHttpServer();
    } catch (err) {
        console.error('[main] failed to start HTTP server:', err);
    }

    session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
        const redirect = resolveRedirect(details.url);
        if (redirect && redirect !== details.url) {
            cb({ redirectURL: redirect });
        } else {
            cb({ cancel: false });
        }
    });

    tray = new Tray(nativeImage.createFromPath(path.join(APP_ROOT, 'electron_white.png')));
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(APP_ROOT, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.setWindowButtonVisibility(true);

    if(useDevPage) {
        mainWindow.loadFile(TEST_INDEX);
    } else {
        mainWindow.loadURL(`${MAIN_HTTP_ORIGIN}/`);
    }

});
