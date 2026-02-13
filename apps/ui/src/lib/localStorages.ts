const STORAGE_KEY_SELECTED_FOLDER_INDEX = 'selectedFolderIndex';
const STORAGE_KEY_FILE_PICKER_LAST_DIR = 'filepickerdialog.lastdir';

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
    }
}

export default localStorages;