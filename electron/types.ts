/** Profile — a completely isolated business database */
export interface Profile {
  id: string;          // slug, e.g. 'factory1', 'factory2', 'test'
  name: string;        // display name, e.g. 'Factory 1'
  emoji: string;       // e.g. '🏭'
  color: string;       // Tailwind color token, e.g. 'blue'
  dbPath: string;      // absolute path to data.db
  createdAt: string;   // UTC ISO string
  lastOpened: string | null;
}

export interface ProfilesFile {
  profiles: Profile[];
}

/** IPC channel names — centralised to avoid typos */
export const IPC = {
  PROFILES_LIST:        'profiles:list',
  PROFILES_CREATE:      'profiles:create',
  PROFILES_SET_OPENED:  'profiles:setLastOpened',
  PROFILES_DELETE:      'profiles:delete',
  FILES_SAVE:           'files:save',
  FILES_READ:           'files:read',
} as const;
