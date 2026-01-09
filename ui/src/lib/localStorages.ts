const localStorages = {
    get selectedFolderIndex(): number | null {
        const stored = localStorage.getItem('selectedFolderIndex');
        if (stored === null) {
            return null;
        }
        const index = parseInt(stored, 10);
        return isNaN(index) ? null : index;
    },
    set selectedFolderIndex(index: number) {
        localStorage.setItem('selectedFolderIndex', index.toString());
    }
}

export default localStorages;