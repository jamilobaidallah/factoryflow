import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerProfileHandlers } from './ipc/profiles.ipc';

const isDev = process.env.NODE_ENV === 'development';

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
    show: false,                   // Show only when ready (prevents white flash)
    backgroundColor: '#0f172a',   // Slate-900 matches app background
  });

  if (isDev) {
    // Development: point to Next.js dev server (supports hot reload)
    win.loadURL('http://localhost:3000/profile-picker');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load static export
    win.loadFile(path.join(__dirname, '../out/profile-picker/index.html'));
  }

  win.once('ready-to-show', () => win.show());

  win.on('closed', () => app.quit());
}

app.whenReady().then(() => {
  registerProfileHandlers(app);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) { createWindow(); }
  });
});

app.on('window-all-closed', () => {
  // Quit on all platforms (macOS convention differs but this is Windows-only app)
  app.quit();
});
