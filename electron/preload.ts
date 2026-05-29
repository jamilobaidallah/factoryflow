import { contextBridge, ipcRenderer } from 'electron';

/**
 * Secure bridge between Electron main process and Next.js renderer.
 * Exposes window.electron.invoke() — the only channel the renderer needs.
 * contextIsolation: true ensures the renderer cannot access Node.js APIs directly.
 */
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args),
});
