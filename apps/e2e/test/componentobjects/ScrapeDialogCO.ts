/// <reference types="@wdio/globals/types" />

class ScrapeDialogCO {
    get cancelButton() {
        return $('[data-testid="scrape-dialog-cancel"]')
    }

    get startButton() {
        return $('[data-testid="scrape-dialog-start"]')
    }

    get table() {
        return $('[data-testid="scrape-dialog-table"]')
    }

    get posterStatus() {
        return $('[data-testid="scrape-dialog-task-status-poster"]')
    }

    get fanartStatus() {
        return $('[data-testid="scrape-dialog-task-status-fanart"]')
    }

    get episodeThumbnailsStatus() {
        return $('[data-testid="scrape-dialog-task-status-thumbnails"]')
    }

    get nfoStatus() {
        return $('[data-testid="scrape-dialog-task-status-nfo"]')
    }
}

export default new ScrapeDialogCO()
