'use strict';

const { systemPreferences } = require('electron');
const {
    FILE_ACCESS_PERSIST_CHANNEL,
    FILE_ACCESS_ACTIVATE_CHANNEL,
} = require('./electron-common.cjs');

const LOG_PREFIX = '[ohos-file-access]';
const REACTIVATE_FOLDERS_BINDING = 'PermissionManagerAdapter.ReactivateFolders';

function logError(message, err) {
    if (err instanceof Error) {
        console.error(`${LOG_PREFIX} ${message}:`, err.message, err.stack);
        return;
    }
    console.error(`${LOG_PREFIX} ${message}:`, err);
}

function isHarmonyOSPlatform() {
    return process.platform === 'ohos' || process.platform === 'openharmony';
}

function validatePaths(paths, context) {
    if (!Array.isArray(paths)) {
        const message = `paths must be an array (${context})`;
        console.error(`${LOG_PREFIX} ${message}`, { paths });
        throw new Error(message);
    }
    if (paths.length === 0) {
        const message = `paths must be non-empty (${context})`;
        console.error(`${LOG_PREFIX} ${message}`);
        throw new Error(message);
    }
    if (!paths.every((entry) => typeof entry === 'string' && entry.length > 0)) {
        const message = `paths must be non-empty strings (${context})`;
        console.error(`${LOG_PREFIX} ${message}`, { paths });
        throw new Error(message);
    }
    return paths;
}

function callReactivateFolders(paths, context) {
    if (typeof systemPreferences.callArkTSFunction !== 'function') {
        console.error(`${LOG_PREFIX} callArkTSFunction unavailable (${context})`);
        return false;
    }

    try {
        systemPreferences.callArkTSFunction(REACTIVATE_FOLDERS_BINDING, 'void', [paths]);
        return true;
    } catch (err) {
        logError(`callReactivateFolders failed (${context})`, err);
        return false;
    }
}

/**
 * Dispatch fileShare.activatePermission via ArkTS (non-blocking).
 * @returns {{ ok: boolean, skipped?: boolean, error?: string }}
 */
function activateOhosFileAccessPermission(paths, context = 'direct') {
    if (!isHarmonyOSPlatform()) {
        return { ok: true, skipped: true };
    }

    let validated;
    try {
        validated = validatePaths(paths, context);
    } catch (err) {
        logError(`activate validation failed (${context})`, err);
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    if (!callReactivateFolders(validated, context)) {
        const message = `ReactivateFolders dispatch failed (${context})`;
        console.error(`${LOG_PREFIX} ${message}`, { paths: validated });
        return { ok: false, error: message };
    }

    return { ok: true };
}

function registerOhosFileAccessPermission(ipcMain) {
    if (!ipcMain || typeof ipcMain.handle !== 'function') {
        console.error(`${LOG_PREFIX} registerOhosFileAccessPermission: invalid ipcMain`);
        return;
    }

    ipcMain.handle(FILE_ACCESS_PERSIST_CHANNEL, async (_event, payload) => {
        let paths;
        try {
            paths = validatePaths(payload?.paths, 'IPC-persist');
        } catch (err) {
            logError('IPC persist validation failed', err);
            throw err;
        }

        if (!isHarmonyOSPlatform()) {
            return { ok: true, skipped: true };
        }

        if (typeof systemPreferences.fileAccessPersist !== 'function') {
            const message = 'systemPreferences.fileAccessPersist is not available';
            console.error(`${LOG_PREFIX} IPC persist: ${message}`);
            throw new Error(message);
        }

        try {
            systemPreferences.fileAccessPersist(paths);
        } catch (err) {
            logError('IPC persist: fileAccessPersist failed', err);
            throw err;
        }

        if (!callReactivateFolders(paths, 'IPC-persist')) {
            const message = 'ReactivateFolders failed after persist';
            console.error(`${LOG_PREFIX} IPC persist: ${message}`, { paths });
            throw new Error(message);
        }

        return { ok: true };
    });

    ipcMain.handle(FILE_ACCESS_ACTIVATE_CHANNEL, async (_event, payload) => {
        let paths;
        try {
            paths = validatePaths(payload?.paths, 'IPC-activate');
        } catch (err) {
            logError('IPC activate validation failed', err);
            throw err;
        }

        if (!isHarmonyOSPlatform()) {
            return { ok: true, skipped: true };
        }

        if (!callReactivateFolders(paths, 'IPC-activate')) {
            const message = 'ReactivateFolders dispatch failed';
            console.error(`${LOG_PREFIX} IPC activate: ${message}`, { paths });
            throw new Error(message);
        }

        return { ok: true };
    });
}

module.exports = {
    registerOhosFileAccessPermission,
    activateOhosFileAccessPermission,
    isHarmonyOSPlatform,
};
