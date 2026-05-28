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
exports.registerProfileHandlers = registerProfileHandlers;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const types_1 = require("../types");
const database_1 = require("../../src/lib/database");
const seed_coa_1 = require("../../src/lib/seed-coa");
const active_db_1 = require("../active-db");
function getProfilesFilePath(app) {
    return path.join(app.getPath('userData'), 'profiles.json');
}
function readProfiles(app) {
    const filePath = getProfilesFilePath(app);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data.profiles) ? data.profiles : [];
    }
    catch {
        return [];
    }
}
function saveProfiles(app, profiles) {
    const filePath = getProfilesFilePath(app);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify({ profiles }, null, 2), 'utf-8');
}
function registerProfileHandlers(app) {
    electron_1.ipcMain.handle(types_1.IPC.PROFILES_LIST, () => readProfiles(app));
    electron_1.ipcMain.handle(types_1.IPC.PROFILES_CREATE, (_, data) => {
        const profiles = readProfiles(app);
        if (profiles.some(p => p.id === data.id)) {
            throw new Error(`Profile with id "${data.id}" already exists`);
        }
        const dbDir = path.join(app.getPath('userData'), data.id);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        const uploadsDir = path.join(app.getPath('userData'), 'uploads', data.id);
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const newProfile = {
            ...data,
            dbPath: path.join(dbDir, 'data.db'),
            createdAt: new Date().toISOString(),
            lastOpened: null,
        };
        profiles.push(newProfile);
        saveProfiles(app, profiles);
        return newProfile;
    });
    electron_1.ipcMain.handle(types_1.IPC.PROFILES_SET_OPENED, (_, profileId) => {
        const profiles = readProfiles(app);
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
            profile.lastOpened = new Date().toISOString();
            saveProfiles(app, profiles);
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.PROFILES_DELETE, (_, profileId) => {
        const profiles = readProfiles(app);
        saveProfiles(app, profiles.filter(p => p.id !== profileId));
    });
    /**
     * Open a profile — initialises its SQLite database and sets it as active.
     * Called from the profile picker before navigating to the main app.
     * The main process (not the renderer) owns the database connection.
     */
    electron_1.ipcMain.handle('profiles:open', (_, profile) => {
        const db = (0, database_1.getDatabase)(profile.dbPath);
        // Seed default chart of accounts if this is a brand-new profile
        try {
            (0, seed_coa_1.seedChartOfAccounts)(db, profile.id);
        }
        catch { /* already seeded */ }
        (0, active_db_1.setActiveDb)(db, profile.id);
        // Update last-opened timestamp
        const profiles = readProfiles(app);
        const p = profiles.find(pr => pr.id === profile.id);
        if (p) {
            p.lastOpened = new Date().toISOString();
            saveProfiles(app, profiles);
        }
        return { success: true };
    });
    electron_1.ipcMain.handle('profiles:close', () => {
        (0, active_db_1.clearActiveDb)();
        return { success: true };
    });
}
