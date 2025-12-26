import { create } from "xmlbuilder2";

export type ThumbAspect = "poster" | "clearlogo" | null


export interface NfoThumb {
    url: string;
    aspect: ThumbAspect;
    season?: number;
    type?: string;
}

export class Nfo {

    id?: string;
    title?: string;
    originalTitle?: string;
    showTitle?: string;
    plot?: string;
    thumbs?: NfoThumb[];
    fanart?: string;
    tmdbid?: string;

    constructor() {
    }

    toXML() {
        const root = create({ version: '1.0', encoding: 'UTF-8', standalone: true })
        const tvshow = root.ele('tvshow')
            if(this.id) tvshow.ele('id').txt(this.id).up()
            if(this.title) tvshow.ele('title').txt(this.title).up()
            if(this.originalTitle) tvshow.ele('originaltitle').txt(this.originalTitle).up()
            if(this.showTitle) tvshow.ele('showtitle').txt(this.showTitle).up()
            if(this.plot) tvshow.ele('plot').txt(this.plot).up()
            if(this.fanart) tvshow.ele('fanart').txt(this.fanart).up()
            if(this.tmdbid) tvshow.ele('tmdbid').txt(this.tmdbid).up()
            
            if(this.thumbs && this.thumbs.length > 0) {
                this.thumbs.forEach(thumb => {
                    if(thumb.url) {
                        const thumbEle = tvshow.ele('thumb')
                        thumbEle.txt(thumb.url)
                        if(thumb.aspect) thumbEle.att('aspect', thumb.aspect)
                        if(thumb.season) thumbEle.att('season', thumb.season.toString())
                        if(thumb.type) thumbEle.att('type', thumb.type)
                        thumbEle.up()
                    }
                })
            }

        tvshow.up()

        // convert the XML tree to string
        const xml = root.end({ prettyPrint: true });
        console.log(xml)
        return xml;
    }

}

export default Nfo