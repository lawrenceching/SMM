/// <reference types="@wdio/globals/types" />

class MusicPanelComponentObject {
    get title() {
        return $('[data-testid="music-panel-title"]')
    }
}

const MusicPanelCO = new MusicPanelComponentObject()
export default MusicPanelCO
