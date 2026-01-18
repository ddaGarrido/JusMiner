import * as cheerio from 'cheerio';
import { CaseDetail } from '../domain/CaseDetail.js';

/**
 * Extraction result status
 */
const EXTRACTION_STATUS = {
    FOUND: 'found',
    MISSING: 'missing',
    BLOCKED: 'blocked'
};

/**
 * Main parser function for case detail pages
 */
export function parseCaseDetailPage(html, url) {
    const $ = cheerio.load(html);
    const detail = new CaseDetail({ url });

    try {
        // Extract basic fields
        extractIdFromUrl(detail, url);
        extractInteiroTeorUrl(detail, $);
        extractTitle(detail, $);
        extractResumo(detail, $);

        // Extract sidebar fields
        const sidebar = extractSideBar(detail, $);
        if (sidebar) {
            extractSidebarFields(detail, $, sidebar);
        }

    } catch (error) {
        recordError(detail, error, 'parseCaseDetailPage');
    } finally {
        detail.validate();
    }

    return detail;
}

/**
 * Extract ID from URL
 */
function extractIdFromUrl(detail, url) {
    try {
        const idMatch = url.match(/\/jurisprudencia\/[^\/]+\/(\d+)/);
        if (idMatch) {
            detail.id = idMatch[1];
        } else {
            markAsMissing(detail, 'id', 'Jurisprudencia ID not found in URL');
        }
    } catch (error) {
        recordError(detail, error, 'extractIdFromUrl');
        markAsMissing(detail, 'id', `Error extracting ID: ${error.message}`);
    }
}

/**
 * Extract inteiro teor URL
 */
function extractInteiroTeorUrl(detail, $) {
    try {
        const url = $(`a[href*="inteiro-teor"]`).attr('href');
        if (url) {
            detail.inteiroTeorUrl = url;
        } else {
            markAsMissing(detail, 'inteiroTeorUrl', 'Inteiro teor URL not found');
        }
    } catch (error) {
        recordError(detail, error, 'extractInteiroTeorUrl');
        markAsMissing(detail, 'inteiroTeorUrl', `Error extracting inteiro teor URL: ${error.message}`);
    }
}

/**
 * Extract title from page
 */
function extractTitle(detail, $) {
    try {
        const titleEl = extractIfExists($, 'h1.heading_root__J_K7z.heading_size2xl__V6Mbz, h1[class*="heading_size2xl"]');
        if (titleEl) {
            detail.title = titleEl.text();
        } else {
            markAsMissing(detail, 'title', 'Title not found on page');
        }
    } catch (error) {
        recordError(detail, error, 'extractTitle');
        markAsMissing(detail, 'title', `Error extracting title: ${error.message}`);
    }
}

/**
 * Extract resumo (summary) from page
 */
function extractResumo(detail, $) {
    try {
        const resumo = extractIfExists($, 'div[data-text-from-component="docview/JurisDocument"]');
        if (resumo && resumo.length > 0) {
            const title = resumo.find('h2').text();
            const content = resumo.find('p').text();
            detail.resumoText = title ? `${title} - ${content.substring(0, 100)}...` : content.substring(0, 100) + '...';
        } else {
            markAsMissing(detail, 'resumoText', 'Resumo section not found on page');
        }
    } catch (error) {
        recordError(detail, error, 'extractResumo');
        markAsMissing(detail, 'resumoText', `Error extracting resumo: ${error.message}`);
    }
}

/**
 * Extract sidebar element
 */
function extractSideBar(detail, $) {
    try {
        const sidebar = extractIfExists($, 'aside.layout_sidebarWrapper__vtUZP, .sidebar_sidebar___Bcz3');
        if (!sidebar) {
            markAsMissing(detail, 'sidebar', 'Sidebar not found on page');
            // Mark all sidebar-dependent fields as missing
            const sidebarFields = ['processo', 'orgaoJulgador', 'dataPublicacao', 'dataJulgamento', 'relator', 'anexos', 'documentosProcesso'];
            sidebarFields.forEach(field => {
                markAsMissing(detail, field, 'Sidebar not found, cannot extract field');
            });
        }
        return sidebar;
    } catch (error) {
        recordError(detail, error, 'extractSideBar');
        markAsMissing(detail, 'sidebar', `Error extracting sidebar: ${error.message}`);
        return null;
    }
}

/**
 * Extract all sidebar fields using a unified approach
 */
function extractSidebarFields(detail, $, sidebar) {
    const sidebarFieldMappings = [
        { field: 'processo', label: 'Processo' },
        { field: 'orgaoJulgador', label: 'Órgão Julgador' },
        { field: 'dataPublicacao', label: 'Data de publicação' },
        { field: 'dataJulgamento', label: 'Data de julgamento' },
        { field: 'relator', label: 'Relator' }
    ];

    sidebarFieldMappings.forEach(({ field, label }) => {
        try {
            const result = extractSidebarDetailValue($, sidebar, label);
            if (result.status === EXTRACTION_STATUS.FOUND) {
                detail[field] = result.value;
            } else if (result.status === EXTRACTION_STATUS.BLOCKED) {
                markAsBlocked(detail, field, result.reason || `${label} is blocked by login requirement`);
            } else {
                markAsMissing(detail, field, result.reason || `${label} not found in sidebar`);
            }
        } catch (error) {
            recordError(detail, error, `extractSidebarFields.${field}`);
            markAsMissing(detail, field, `Error extracting ${label}: ${error.message}`);
        }
    });

    // Extract documents separately as they have different structure
    extractCaseDocuments(detail, $, sidebar);
}

/**
 * Extract sidebar detail value with status tracking
 * Returns: { status: 'found'|'missing'|'blocked', value?: string, reason?: string }
 */
function extractSidebarDetailValue($, sidebar, label) {
    try {
        // Find the label index based on the label text inside the sidebar
        const $label = sidebar.find(`h3[data-fds-detail-label="true"]:contains("${label}")`);
        
        if (!$label || $label.length === 0) {
            return {
                status: EXTRACTION_STATUS.MISSING,
                reason: `Label "${label}" not found in sidebar`
            };
        }

        const allLabels = sidebar.find('h3[data-fds-detail-label="true"]');
        const labelIndex = allLabels.index($label);

        if (labelIndex === -1) {
            return {
                status: EXTRACTION_STATUS.MISSING,
                reason: `Could not determine index for label "${label}"`
            };
        }

        // Find the corresponding value element
        const valueElements = sidebar.find('div[data-fds-detail-value="true"]');
        const valueElement = valueElements.eq(labelIndex);

        if (!valueElement || valueElement.length === 0) {
            return {
                status: EXTRACTION_STATUS.MISSING,
                reason: `Value element not found for label "${label}" at index ${labelIndex}`
            };
        }

        // Check if blocked by login button
        if (isBlockedByButton(valueElement)) {
            return {
                status: EXTRACTION_STATUS.BLOCKED,
                reason: `Value for "${label}" is blocked by login requirement (Mostrar button present)`
            };
        }

        const value = valueElement.text();
        if (!value) {
            return {
                status: EXTRACTION_STATUS.MISSING,
                reason: `Value for "${label}" is empty`
            };
        }

        return {
            status: EXTRACTION_STATUS.FOUND,
            value
        };
    } catch (error) {
        return {
            status: EXTRACTION_STATUS.MISSING,
            reason: `Error extracting "${label}": ${error.message}`
        };
    }
}

/**
 * Check if element is blocked by a login button
 */
function isBlockedByButton(element) {
    try {
        const button = element.find('button');
        if (button && button.length > 0) {
            const buttonText = button.text().toLowerCase();
            return buttonText.includes('mostrar') || buttonText.includes('login') || buttonText.includes('entrar');
        }
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Extract case documents (attachments and related documents)
 */
function extractCaseDocuments(detail, $, sidebar) {
    try {
        // Extract attachments
        const attachmentsDiv = extractIfExists($, 'div.attachments_attachmentList__8tkHF');
        if (attachmentsDiv && attachmentsDiv.length > 0) {
            const attachmentDivs = attachmentsDiv.find('div.file-content_root__35RS2');
            attachmentDivs.each((index, element) => {
                try {
                    const $attachmentDiv = $(element);
                    const $pTags = $attachmentDiv.find('p');
                    const attachmentText = $pTags.map((i, el) => $(el).text())
                        .get()
                        .filter(text => text.length > 0)
                        .join(' | ');
                    if (attachmentText) {
                        detail.anexos.push(attachmentText);
                    }
                } catch (error) {
                    recordError(detail, error, `extractCaseDocuments.attachment[${index}]`);
                }
            });
        }

        // Extract related documents
        const caseDocumentsDivs = extractIfExists($, 'div.related-documents_textWrapper__aEph8', false);
        if (caseDocumentsDivs && caseDocumentsDivs.length > 0) {
            caseDocumentsDivs.each((index, element) => {
                try {
                    const $caseDocumentsDiv = $(element);
                    const $pTags = $caseDocumentsDiv.find('p');
                    const caseDocumentsText = $pTags.map((i, el) => $(el).text())
                        .get()
                        .filter(text => text.length > 0)
                        .join(' | ');
                    if (caseDocumentsText) {
                        detail.documentosProcesso.push(caseDocumentsText);
                    }
                } catch (error) {
                    recordError(detail, error, `extractCaseDocuments.document[${index}]`);
                }
            });
        }

        // Mark as missing if no documents found
        if (detail.anexos.length === 0 && detail.documentosProcesso.length === 0) {
            markAsMissing(detail, 'anexos', 'No attachments found');
            markAsMissing(detail, 'documentosProcesso', 'No related documents found');
        }
    } catch (error) {
        recordError(detail, error, 'extractCaseDocuments');
        markAsMissing(detail, 'anexos', `Error extracting documents: ${error.message}`);
        markAsMissing(detail, 'documentosProcesso', `Error extracting documents: ${error.message}`);
    }
}

/**
 * Extract element if it exists in the DOM
 */
function extractIfExists($, selector, first = true) {
    try {
        const element = $(selector);
        if (element && element.length > 0) {
            return first ? element.first() : element;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Mark a field as missing (not present on page)
 */
function markAsMissing(detail, field, reason) {
    ensureExtractionMeta(detail);
    if (!detail.extractionMeta.missingFields.includes(field)) {
        detail.extractionMeta.missingFields.push(field);
    }
    if (reason) {
        detail.extractionMeta.notes.push(`[${field}] ${reason}`);
    }
}

/**
 * Mark a field as blocked (requires login)
 */
function markAsBlocked(detail, field, reason) {
    ensureExtractionMeta(detail);
    if (!detail.extractionMeta.blockedFields.includes(field)) {
        detail.extractionMeta.blockedFields.push(field);
    }
    if (reason) {
        detail.extractionMeta.notes.push(`[${field}] BLOCKED: ${reason}`);
    }
}

/**
 * Record an error with stack trace
 */
function recordError(detail, error, context) {
    ensureExtractionMeta(detail);
    const errorInfo = {
        context,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    };
    detail.extractionMeta.errors.push(errorInfo);
    
    // Also add to notes for visibility
    detail.extractionMeta.notes.push(
        `[ERROR in ${context}] ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`
    );
}

/**
 * Ensure extractionMeta is properly initialized
 */
function ensureExtractionMeta(detail) {
    if (!detail.extractionMeta) {
        detail.extractionMeta = {
            extractedAt: new Date().toISOString(),
            missingFields: [],
            blockedFields: [],
            errors: [],
            notes: []
        };
    }
    if (!detail.extractionMeta.missingFields) detail.extractionMeta.missingFields = [];
    if (!detail.extractionMeta.blockedFields) detail.extractionMeta.blockedFields = [];
    if (!detail.extractionMeta.errors) detail.extractionMeta.errors = [];
    if (!detail.extractionMeta.notes) detail.extractionMeta.notes = [];
}

/**
 * Parse inteiro teor page
 */
export function parseInteiroTeorPage(html) {
    try {
        const $ = cheerio.load(html);
        const inteiroTeorContent = extractIfExists($, 'div[data-text-from-component="docview/JurisDocument"]');
        
        if (!inteiroTeorContent || inteiroTeorContent.length === 0) {
            return null;
        }

        const title = inteiroTeorContent.find('h2').text();
        const content = inteiroTeorContent.find('p').text();
        
        return title ? `${title} - ${content.substring(0, 100)}...` : content.substring(0, 100) + '...';
    } catch (error) {
        throw new Error(`Error parsing inteiro teor page: ${error.message}\n${error.stack}`);
    }
}
