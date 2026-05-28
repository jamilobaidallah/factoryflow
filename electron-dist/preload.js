"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Secure bridge between Electron main process and Next.js renderer.
 * Exposes window.electron.invoke() — the only channel the renderer needs.
 * contextIsolation: true ensures the renderer cannot access Node.js APIs directly.
 */
electron_1.contextBridge.exposeInMainWorld('electron', {
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
});
