"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const index_1 = require("./ipc/index");
/** Map common file extensions to MIME types served by the app:// protocol. */
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.map': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
};
const isDev = process.env.NODE_ENV === 'development';
const PROFILE_PICKER_URL = isDev
    ? 'http://localhost:3000/profile-picker'
    : 'app://factoryflow/profile-picker.html';
/**
 * Resolves the absolute filesystem path of a file inside the packaged app's
 * /out/ directory (the Next.js static export). Compiled main.js lives at
 * /electron-dist/electron/main.js inside the asar bundle, so we walk up two
 * levels to reach the /out/ folder that lives alongside it.
 */
function staticAssetPath(relativePath) {
    return path.join(__dirname, '..', '..', 'out', relativePath);
}
/**
 * Register a custom `app://` protocol that serves files from the static
 * export. This is required because Next.js generates HTML with absolute
 * asset references like /_next/static/foo.js, which Electron's file://
 * protocol blocks as "local resources." Serving via a registered protocol
 * lets the browser load these assets as expected.
 */
function registerAppProtocol() {
    electron_1.protocol.handle('app', async (request) => {
        try {
            // request.url looks like: app://factoryflow/profile-picker.html
            // We don't care about the host — only the path.
            const url = new URL(request.url);
            let relativePath = decodeURIComponent(url.pathname);
            if (relativePath.startsWith('/')) {
                relativePath = relativePath.slice(1);
            }
            if (!relativePath || relativePath.endsWith('/')) {
                relativePath = (relativePath || '') + 'index.html';
            }
            const fullPath = staticAssetPath(relativePath);
            console.log(`[app://] ${request.url} -> ${fullPath}`);
            // Defensive: prevent path traversal outside the out/ root
            const outRoot = staticAssetPath('');
            const normalized = path.normalize(fullPath);
            if (!normalized.startsWith(path.normalize(outRoot))) {
                return new Response('Forbidden', { status: 403 });
            }
            if (!fs.existsSync(normalized)) {
                console.warn(`[app://] not found: ${normalized}`);
                return new Response('Not found', { status: 404 });
            }
            // Read directly from disk — works for both asar and asar-unpacked files
            // thanks to Electron's asar-aware fs implementation.
            const buffer = await fs.promises.readFile(normalized);
            const ext = path.extname(normalized).toLowerCase();
            const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
            return new Response(new Uint8Array(buffer), {
                status: 200,
                headers: { 'Content-Type': mimeType },
            });
        }
        catch (err) {
            console.error('[app://] protocol error:', err);
            return new Response('Internal error', { status: 500 });
        }
    });
}
/**
 * Clear stale Firebase auth sessions and other cached data left over from
 * previous Electron runs that may have used the cloud version. This ensures
 * the local app never falls back to a Firebase login redirect when the user
 * opens the app fresh.
 */
async function clearStaleAuthData() {
    try {
        await electron_1.session.defaultSession.clearStorageData({
            storages: [
                'cookies',
                'localstorage',
                'indexdb',
                'shadercache',
                'serviceworkers',
                'cachestorage',
            ],
        });
    }
    catch (err) {
        console.warn('Failed to clear stale storage:', err);
    }
}
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
        backgroundColor: '#0f172a',
    });
    win.loadURL(PROFILE_PICKER_URL);
    if (isDev) {
        win.webContents.openDevTools({ mode: 'detach' });
    }
    win.once('ready-to-show', () => win.show());
    win.on('closed', () => electron_1.app.quit());
}
function buildAppMenu() {
    const template = [
        { role: 'fileMenu' },
        { role: 'editMenu' },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                {
                    label: 'Go to Profile Picker',
                    accelerator: 'CmdOrCtrl+Shift+P',
                    click: () => {
                        const win = electron_1.BrowserWindow.getFocusedWindow();
                        if (win) {
                            win.loadURL(PROFILE_PICKER_URL);
                        }
                    },
                },
                {
                    label: 'Clear Session and Restart',
                    click: async () => {
                        await clearStaleAuthData();
                        electron_1.app.relaunch();
                        electron_1.app.exit(0);
                    },
                },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        { role: 'windowMenu' },
    ];
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
// The custom protocol must be registered as "standard" BEFORE app.whenReady()
// so it behaves like http/https (supports SPA routing, fetch, etc.).
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
electron_1.app.whenReady().then(async () => {
    await clearStaleAuthData();
    if (!isDev) {
        registerAppProtocol();
    }
    (0, index_1.registerAllHandlers)(electron_1.app);
    buildAppMenu();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    electron_1.app.quit();
});
