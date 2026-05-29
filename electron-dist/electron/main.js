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
const index_1 = require("./ipc/index");
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
async function clearStaleAuthData() {
    try {
        await electron_1.session.defaultSession.clearStorageData({
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
            nodeIntegration: false, // Never enable — security requirement
        },
        show: false,
        backgroundColor: '#0f172a',
    });
    if (isDev && PROFILE_PICKER_URL) {
        win.loadURL(PROFILE_PICKER_URL);
        win.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        win.loadFile(path.join(__dirname, '../out/profile-picker/index.html'));
    }
    win.once('ready-to-show', () => win.show());
    win.on('closed', () => electron_1.app.quit());
}
/**
 * Add menu items that help the user recover from issues during development.
 * "Go to Profile Picker" lets them snap back to the start of the local flow
 * if something went wrong (e.g., a stale Firebase redirect).
 */
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
                        if (!win) {
                            return;
                        }
                        if (isDev && PROFILE_PICKER_URL) {
                            win.loadURL(PROFILE_PICKER_URL);
                        }
                        else {
                            win.loadFile(path.join(__dirname, '../out/profile-picker/index.html'));
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
electron_1.app.whenReady().then(async () => {
    // Clear stale auth/cache from previous sessions BEFORE creating any window.
    // Without this, a leftover Firebase session can hijack the route flow.
    await clearStaleAuthData();
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
