"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
/** IPC channel names — centralised to avoid typos */
exports.IPC = {
    PROFILES_LIST: 'profiles:list',
    PROFILES_CREATE: 'profiles:create',
    PROFILES_SET_OPENED: 'profiles:setLastOpened',
    PROFILES_DELETE: 'profiles:delete',
    FILES_SAVE: 'files:save',
    FILES_READ: 'files:read',
};
