const STORAGE_KEY_SELECTED_FOLDER_INDEX = 'selectedFolderIndex';
const STORAGE_KEY_FILE_PICKER_LAST_DIR = 'filepickerdialog.lastdir';
const STORAGE_KEY_SIDEBAR_SELECTED_FOLDER = 'sidebar.selectedFolder';
const STORAGE_KEY_COOKIE_GUIDE_URL = 'cookie_guide_url';

const localStorages = {
    get selectedFolderIndex(): number | null {
        const stored = localStorage.getItem(STORAGE_KEY_SELECTED_FOLDER_INDEX);
        if (stored === null) {
            return null;
        }
        const index = parseInt(stored, 10);
        return isNaN(index) ? null : index;
    },
    set selectedFolderIndex(index: number) {
        localStorage.setItem(STORAGE_KEY_SELECTED_FOLDER_INDEX, index.toString());
    },
    get sidebarSelectedFolder(): string | null {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_SIDEBAR_SELECTED_FOLDER);
            return stored || null;
        } catch {
            return null;
        }
    },
    set sidebarSelectedFolder(path: string | null) {
        try {
            if (path && path.trim() !== "") {
                localStorage.setItem(STORAGE_KEY_SIDEBAR_SELECTED_FOLDER, path);
            } else {
                localStorage.removeItem(STORAGE_KEY_SIDEBAR_SELECTED_FOLDER);
            }
        } catch {
            // Ignore localStorage errors
        }
    },
    get filePickerLastDir(): string {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_FILE_PICKER_LAST_DIR);
            return stored || "~";
        } catch {
            return "~";
        }
    },
    set filePickerLastDir(path: string) {
        try {
            localStorage.setItem(STORAGE_KEY_FILE_PICKER_LAST_DIR, path);
        } catch {
            // Ignore localStorage errors
        }
    },
    get cookieGuideUrl(): string | null {
        try {
            return localStorage.getItem(STORAGE_KEY_COOKIE_GUIDE_URL);
        } catch {
            return null;
        }
    },
    set cookieGuideUrl(url: string | null) {
        try {
            if (url) {
                localStorage.setItem(STORAGE_KEY_COOKIE_GUIDE_URL, url);
            } else {
                localStorage.removeItem(STORAGE_KEY_COOKIE_GUIDE_URL);
            }
        } catch {
            // Ignore localStorage errors
        }
    }
}

export default localStorages;