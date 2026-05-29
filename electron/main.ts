import { app, BrowserWindow, session, Menu, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registerAllHandlers } from './ipc/index';

/** Map common file extensions to MIME types served by the app:// protocol. */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.map':   'application/json',
  '.txt':   'text/plain; charset=utf-8',
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
function staticAssetPath(relativePath: string): string {
  return path.join(__dirname, '..', '..', 'out', relativePath);
}

/**
 * Register a custom `app://` protocol that serves files from the static
 * export. This is required because Next.js generates HTML with absolute
 * asset references like /_next/static/foo.js, which Electron's file://
 * protocol blocks as "local resources." Serving via a registered protocol
 * lets the browser load these assets as expected.
 */
function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    try {
      // request.url looks like: app://factoryflow/profile-picker.html
      // We don't care about the host — only the path.
      const url = new URL(request.url);
      let relativePath = decodeURIComponent(url.pathname);
      if (relativePath.startsWith('/')) { relativePath = relativePath.slice(1); }
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
    } catch (err) {
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
async function clearStaleAuthData(): Promise<void> {
  try {
    await session.defaultSession.clearStorageData({
      storages: [
        'cookies',
        'localstorage',
        'indexdb',
        'shadercache',
        'serviceworkers',
        'cachestorage',
      ],
    });
  } catch (err) {
    console.warn('Failed to clear stale storage:', err);
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
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
  if (isDev) { win.webContents.openDevTools({ mode: 'detach' }); }

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => app.quit());
}

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
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
            const win = BrowserWindow.getFocusedWindow();
            if (win) { win.loadURL(PROFILE_PICKER_URL); }
          },
        },
        {
          label: 'Clear Session and Restart',
          click: async () => {
            await clearStaleAuthData();
            app.relaunch();
            app.exit(0);
          },
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// The custom protocol must be registered as "standard" BEFORE app.whenReady()
// so it behaves like http/https (supports SPA routing, fetch, etc.).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(async () => {
  await clearStaleAuthData();
  if (!isDev) { registerAppProtocol(); }
  registerAllHandlers(app);
  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) { createWindow(); }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
