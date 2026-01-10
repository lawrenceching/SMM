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
        // Create XML document
        const doc = document.implementation.createDocument(null, 'tvshow', null);
        const tvshow = doc.documentElement;

        // Helper function to add text elements
        const addElement = (name: string, value: string) => {
            const element = doc.createElement(name);
            element.textContent = value;
            tvshow.appendChild(element);
        };

        // Add elements in order
        if (this.id) addElement('id', this.id);
        if (this.title) addElement('title', this.title);
        if (this.originalTitle) addElement('originaltitle', this.originalTitle);
        if (this.showTitle) addElement('showtitle', this.showTitle);
        if (this.plot) addElement('plot', this.plot);
        if (this.fanart) addElement('fanart', this.fanart);
        if (this.tmdbid) addElement('tmdbid', this.tmdbid);

        // Add thumb elements with attributes
        if (this.thumbs && this.thumbs.length > 0) {
            this.thumbs.forEach(thumb => {
                if (thumb.url) {
                    const thumbEle = doc.createElement('thumb');
                    thumbEle.textContent = thumb.url;
                    if (thumb.aspect) thumbEle.setAttribute('aspect', thumb.aspect);
                    if (thumb.season !== undefined) thumbEle.setAttribute('season', thumb.season.toString());
                    if (thumb.type) thumbEle.setAttribute('type', thumb.type);
                    tvshow.appendChild(thumbEle);
                }
            });
        }

        // Serialize to XML string with XML declaration
        const serializer = new XMLSerializer();
        const xmlString = serializer.serializeToString(doc);
        
        // Add XML declaration and format
        const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + this.formatXML(xmlString);
        
        console.log(xml);
        return xml;
    }

    /**
     * Format XML string with proper indentation
     */
    private formatXML(xml: string): string {
        const PADDING = '  '; // 2 spaces for indentation
        const reg = /(>)(<)(\/*)/g;
        let formatted = '';
        
        // Add newlines between tags
        xml = xml.replace(reg, '$1\n$2$3');
        
        let pad = 0;
        xml.split('\n').forEach((node) => {
            let indent = 0;
            if (node.match(/.+<\/\w[^>]*>$/)) {
                // Self-contained tag
                indent = 0;
            } else if (node.match(/^<\/\w/)) {
                // Closing tag
                if (pad > 0) {
                    pad -= 1;
                }
            } else if (node.match(/^<\w([^>]*[^\/])?>.*$/)) {
                // Opening tag
                indent = 1;
            }
            
            formatted += PADDING.repeat(pad) + node + '\n';
            pad += indent;
        });
        
        return formatted.trim();
    }

}

export default Nfo
