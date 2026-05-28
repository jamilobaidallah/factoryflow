/**
 * SQLite connection manager — Phase 0 skeleton.
 *
 * In the local version (NEXT_PUBLIC_DATA_SOURCE=local), all data operations
 * go through Electron IPC to the main process, which owns the SQLite connection.
 * This file will be expanded in Phase 1 (schema definition) and Phase 2
 * (service layer replacement).
 *
 * The renderer never touches SQLite directly — it calls window.electron.invoke()
 * and the main process handles the database.
 */

export const isLocalMode =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_DATA_SOURCE === 'local';
