import { ipcMain, type App } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC, type Profile, type ProfilesFile } from '../types';

function getProfilesFilePath(app: App): string {
  return path.join(app.getPath('userData'), 'profiles.json');
}

function readProfiles(app: App): Profile[] {
  const filePath = getProfilesFilePath(app);
  if (!fs.existsSync(filePath)) { return []; }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: ProfilesFile = JSON.parse(raw);
    return Array.isArray(data.profiles) ? data.profiles : [];
  } catch {
    return [];
  }
}

function saveProfiles(app: App, profiles: Profile[]): void {
  const filePath = getProfilesFilePath(app);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  fs.writeFileSync(filePath, JSON.stringify({ profiles }, null, 2), 'utf-8');
}

export function registerProfileHandlers(app: App): void {
  ipcMain.handle(IPC.PROFILES_LIST, () => readProfiles(app));

  ipcMain.handle(
    IPC.PROFILES_CREATE,
    (_, data: Pick<Profile, 'id' | 'name' | 'emoji' | 'color'>) => {
      const profiles = readProfiles(app);

      if (profiles.some(p => p.id === data.id)) {
        throw new Error(`Profile with id "${data.id}" already exists`);
      }

      const dbDir = path.join(app.getPath('userData'), data.id);
      if (!fs.existsSync(dbDir)) { fs.mkdirSync(dbDir, { recursive: true }); }

      const uploadsDir = path.join(app.getPath('userData'), 'uploads', data.id);
      if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); }

      const newProfile: Profile = {
        ...data,
        dbPath: path.join(dbDir, 'data.db'),
        createdAt: new Date().toISOString(),
        lastOpened: null,
      };

      profiles.push(newProfile);
      saveProfiles(app, profiles);
      return newProfile;
    }
  );

  ipcMain.handle(IPC.PROFILES_SET_OPENED, (_, profileId: string) => {
    const profiles = readProfiles(app);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      profile.lastOpened = new Date().toISOString();
      saveProfiles(app, profiles);
    }
  });

  ipcMain.handle(IPC.PROFILES_DELETE, (_, profileId: string) => {
    const profiles = readProfiles(app);
    saveProfiles(app, profiles.filter(p => p.id !== profileId));
  });
}
