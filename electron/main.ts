import { app, BrowserWindow, session, Menu } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc/index';
import { startStaticServer, type StaticServer } from './static-server';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Origin of the embedded static server in production. Populated during
 * app startup before the first window is created. In dev we point at the
 * running `next dev` server instead.
 */
let staticServer: StaticServer | null = null;

/**
 * Absolute path to the Next.js static export (`out/`). The compiled main.js
 * lives at `electron-dist/electron/main.js` inside the asar bundle, so we walk
 * up two levels to reach the `out/` folder packaged alongside it (asarUnpack'd).
 */
function staticExportDir(): string {
  return path.join(__dirname, '..', '..', 'out');
}

/** URL of the profile picker — the app's entry screen. */
function profilePickerUrl(): string {
  if (isDev) { return 'http://localhost:3000/profile-picker'; }
  return `${staticServer?.origin ?? ''}/profile-picker.html`;
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

  win.loadURL(profilePickerUrl());
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
            if (win) { win.loadURL(profilePickerUrl()); }
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

app.whenReady().then(async () => {
  await clearStaleAuthData();

  // In production, serve the static export over a loopback HTTP origin so that
  // Next.js's absolute asset paths (/_next/static/...) resolve correctly. The
  // file:// protocol blocks these, which previously left the window blank.
  if (!isDev) {
    try {
      staticServer = await startStaticServer(staticExportDir());
    } catch (err) {
      console.error('Failed to start static server:', err);
    }
  }

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

app.on('will-quit', () => {
  // Release the loopback port on exit.
  if (staticServer) { void staticServer.close(); }
});
