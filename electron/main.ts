import { app, BrowserWindow, session, Menu } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc/index';

const isDev = process.env.NODE_ENV === 'development';

const PROFILE_PICKER_URL = isDev
  ? 'http://localhost:3000/profile-picker'
  : null; // production loads from file

/**
 * Clear stale Firebase auth sessions and other cached data left over from
 * previous Electron runs that may have used the cloud version. This ensures
 * the local app never falls back to a Firebase login redirect when the user
 * opens the app fresh.
 */
async function clearStaleAuthData(): Promise<void> {
  try {
    await session.defaultSession.clearStorageData({
      // Clear everything related to the dev origin (localhost:3000) and
      // anything Firebase might have cached.
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
      nodeIntegration: false,      // Never enable — security requirement
    },
    show: false,
    backgroundColor: '#0f172a',
  });

  if (isDev && PROFILE_PICKER_URL) {
    win.loadURL(PROFILE_PICKER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../out/profile-picker/index.html'));
  }

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => app.quit());
}

/**
 * Add menu items that help the user recover from issues during development.
 * "Go to Profile Picker" lets them snap back to the start of the local flow
 * if something went wrong (e.g., a stale Firebase redirect).
 */
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
            if (!win) { return; }
            if (isDev && PROFILE_PICKER_URL) {
              win.loadURL(PROFILE_PICKER_URL);
            } else {
              win.loadFile(path.join(__dirname, '../out/profile-picker/index.html'));
            }
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
  // Clear stale auth/cache from previous sessions BEFORE creating any window.
  // Without this, a leftover Firebase session can hijack the route flow.
  await clearStaleAuthData();

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
