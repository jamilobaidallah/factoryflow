/** Profile — one isolated business database */
export interface Profile {
  id: string;           // slug, e.g. 'factory1'
  name: string;         // display name, e.g. 'Factory 1'
  emoji: string;        // e.g. '🏭'
  color: string;        // e.g. 'blue' | 'emerald' | 'amber' | 'violet' | 'slate'
  dbPath: string;       // absolute path to data.db (resolved by main process)
  createdAt: string;    // UTC ISO string
  lastOpened: string | null;
}

/** Color options available when creating a profile */
export const PROFILE_COLORS = [
  { id: 'blue',    label: 'أزرق',   bg: 'bg-blue-500',    ring: 'ring-blue-400' },
  { id: 'emerald', label: 'أخضر',   bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { id: 'amber',   label: 'ذهبي',   bg: 'bg-amber-500',   ring: 'ring-amber-400' },
  { id: 'violet',  label: 'بنفسجي', bg: 'bg-violet-500',  ring: 'ring-violet-400' },
  { id: 'rose',    label: 'وردي',   bg: 'bg-rose-500',    ring: 'ring-rose-400' },
  { id: 'slate',   label: 'رمادي',  bg: 'bg-slate-500',   ring: 'ring-slate-400' },
] as const;

export type ProfileColor = typeof PROFILE_COLORS[number]['id'];

/** Emoji options for profile icons */
export const PROFILE_EMOJIS = ['🏭', '🏗️', '🧪', '📊', '🏢', '⚙️', '🔨', '💼'] as const;

/** IPC channel names — must match electron/types.ts */
export const IPC = {
  PROFILES_LIST:       'profiles:list',
  PROFILES_CREATE:     'profiles:create',
  PROFILES_SET_OPENED: 'profiles:setLastOpened',
  PROFILES_DELETE:     'profiles:delete',
} as const;

/** Type-safe wrapper around window.electron.invoke */
export async function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (typeof window === 'undefined' || !('electron' in window)) {
    throw new Error('window.electron is not available — are you running in Electron?');
  }
  const w = window as Window & { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } };
  return w.electron.invoke(channel, ...args) as Promise<T>;
}

/** Fetch all profiles from disk (via IPC) */
export async function listProfiles(): Promise<Profile[]> {
  return ipcInvoke<Profile[]>(IPC.PROFILES_LIST);
}

/** Create a new profile (main process creates the db folder) */
export async function createProfile(
  data: Pick<Profile, 'id' | 'name' | 'emoji' | 'color'>
): Promise<Profile> {
  return ipcInvoke<Profile>(IPC.PROFILES_CREATE, data);
}

/** Mark a profile as last opened (updates profiles.json) */
export async function markProfileOpened(profileId: string): Promise<void> {
  return ipcInvoke<void>(IPC.PROFILES_SET_OPENED, profileId);
}

/** Delete a profile entry (does NOT delete the db file) */
export async function deleteProfile(profileId: string): Promise<void> {
  return ipcInvoke<void>(IPC.PROFILES_DELETE, profileId);
}

/** Format a last-opened timestamp for display */
export function formatLastOpened(iso: string | null): string {
  if (!iso) { return 'لم يُفتح بعد'; }
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) { return 'اليوم'; }
  if (diffDays === 1) { return 'أمس'; }
  if (diffDays < 7)  { return `منذ ${diffDays} أيام`; }
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Window type augmentation so TypeScript knows about window.electron */
declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}
