/**
 * Domain model for a search result item from JusBrasil
 */
export class SearchResultItem {
    constructor({
        id = null,
        title = null,
        url = null,
        summarySnippet = null,
        metadata = {},
        extractionMeta = {
            extractedAt: new Date().toISOString(),
            missingFields: [],
            notes: []
        }
    } = {}) {
        this.id = id;
        this.title = title;
        this.url = url;
        this.summarySnippet = summarySnippet;
        this.metadata = metadata;
        this.extractionMeta = extractionMeta;
    }

    /**
     * Validates required fields and updates missingFields
     */
    validate() {
        const missing = [];
        if (!this.id) missing.push('id');
        if (!this.title) missing.push('title');
        if (!this.url) missing.push('url');
        
        this.extractionMeta.missingFields = missing;
        return missing.length === 0;
    }

    /**
     * Converts to plain object for JSON serialization
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            url: this.url,
            summarySnippet: this.summarySnippet,
            metadata: this.metadata,
            extractionMeta: this.extractionMeta
        };
    }
}

