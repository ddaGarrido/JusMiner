/**
 * Domain model for a case detail from JusBrasil
 */
export class CaseDetail {
    constructor({
        id = null,
        title = null,
        url = null,
        processo = null,
        orgaoJulgador = null,
        dataPublicacao = null,
        dataJulgamento = null,
        relator = null,
        resumoText = null,
        inteiroTeorUrl = null,
        inteiroTeorText = null,
        ementa = null,
        anexos = [],
        documentosProcesso = [],
        extractionMeta = {
            extractedAt: new Date().toISOString(),
            missingFields: [],
            blocked: false,
            notes: []
        }
    } = {}) {
        this.id = id;
        this.title = title;
        this.url = url;
        this.processo = processo;
        this.orgaoJulgador = orgaoJulgador;
        this.dataPublicacao = dataPublicacao;
        this.dataJulgamento = dataJulgamento;
        this.relator = relator;
        this.resumoText = resumoText;
        this.inteiroTeorUrl = inteiroTeorUrl;
        this.inteiroTeorText = inteiroTeorText;
        this.ementa = ementa;
        this.anexos = anexos;
        this.documentosProcesso = documentosProcesso;
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
        
        // Optional but important fields
        if (!this.processo) missing.push('processo');
        if (!this.orgaoJulgador) missing.push('orgaoJulgador');
        if (!this.dataPublicacao) missing.push('dataPublicacao');
        if (!this.dataJulgamento) missing.push('dataJulgamento');
        if (!this.relator) missing.push('relator');
        if (!this.resumoText) missing.push('resumoText');
        if (!this.inteiroTeorUrl) missing.push('inteiroTeorUrl');
        if (!this.inteiroTeorText) missing.push('inteiroTeorText');
        if (!this.anexos) missing.push('anexos');
        if (!this.documentosProcesso) missing.push('documentosProcesso');
        
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
            processo: this.processo,
            orgaoJulgador: this.orgaoJulgador,
            dataPublicacao: this.dataPublicacao,
            dataJulgamento: this.dataJulgamento,
            relator: this.relator,
            resumoText: this.resumoText,
            inteiroTeorUrl: this.inteiroTeorUrl,
            inteiroTeorText: this.inteiroTeorText,
            ementa: this.ementa,
            anexos: this.anexos,
            documentosProcesso: this.documentosProcesso,
            extractionMeta: this.extractionMeta
        };
    }
}

