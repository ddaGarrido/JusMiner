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
            blockedFields: [],
            errors: [],
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
     * Note: This only checks if fields are null/empty, not if they were blocked or missing during extraction
     */
    validate() {
        const requiredFields = ['id', 'title', 'url'];
        const optionalFields = [
            'processo', 'orgaoJulgador', 'dataPublicacao', 'dataJulgamento',
            'relator', 'resumoText', 'inteiroTeorUrl', 'inteiroTeorText',
            'anexos', 'documentosProcesso'
        ];
        
        const missing = [];
        
        // Check required fields
        for (const field of requiredFields) {
            if (!this[field]) {
                missing.push(field);
            }
        }
        
        // Check optional fields (only if not already marked as missing/blocked in extractionMeta)
        for (const field of optionalFields) {
            const value = this[field];
            const isArray = Array.isArray(value);
            const isEmpty = value === null || value === undefined || (isArray && value.length === 0);
            
            if (isEmpty && 
                !this.extractionMeta.missingFields.includes(field) && 
                !this.extractionMeta.blockedFields.includes(field)) {
                missing.push(field);
            }
        }
        
        // Merge with existing missing fields from extraction
        const allMissing = [...new Set([...this.extractionMeta.missingFields, ...missing])];
        this.extractionMeta.missingFields = allMissing;
        
        return allMissing.length === 0;
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

