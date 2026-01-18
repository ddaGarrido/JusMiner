import * as cheerio from 'cheerio';
import { CaseDetail } from '../domain/CaseDetail.js';

export function parseCaseDetailPage(html, url) {
    const $ = cheerio.load(html);
    const detail = new CaseDetail({ url });

    // Extract Data from HTML
    try {
        extractIdFromUrl(detail,url);
        detail.inteiroTeorUrl = $(`a[href*="inteiro-teor"]`).attr('href');

        extractTitle(detail, $);

        extractResumo(detail, $);

        const sidebar = extractSideBar(detail, $);
        if (!sidebar) return detail;

        extractProcesso(detail, $, sidebar);

        extractOrgaoJulgador(detail, $, sidebar);

        extractDataPublicacao(detail, $, sidebar);

        extractDataJulgamento(detail, $, sidebar);

        extractRelator(detail, $, sidebar);

        extractCaseDocuments(detail, $, sidebar);
    } catch (error) {
        detail.extractionMeta.notes.push(`Error parsing case detail: ${error.message}`);
        detail.extractionMeta.blocked = true;
        detail.extractionMeta.missingFields.push('caseDetail');
    }
    detail.validate();

    return detail;
}

function extractIdFromUrl(detail, url) {
    const idMatch = url.match(/\/jurisprudencia\/[^\/]+\/(\d+)/);
    if (idMatch) detail.id = idMatch[1];
    else markAsMissing(detail, 'id','Jurisprudencia ID not found in URL');
}

function extractTitle(detail, $) {
    const titleEl = extractIfExists($, 'h1.heading_root__J_K7z.heading_size2xl__V6Mbz, h1[class*="heading_size2xl"]');

    if (titleEl) detail.title = titleEl.text().trim();
    else markAsMissing(detail, 'title','Title not found');
}

function extractSideBar(detail, $) {
    const sidebar = extractIfExists($, 'aside.layout_sidebarWrapper__vtUZP, .sidebar_sidebar___Bcz3');

    if (sidebar) return sidebar;
    else {
        markAsMissing(detail, 'sidebar','Sidebar not found');

        // Sidebard other fields missed
        markAsMissing(detail, 'processo','Processo not found');
        markAsMissing(detail, 'orgaoJulgador','Órgão Julgador not found');
        markAsMissing(detail, 'dataPublicacao','Data de publicação not found');
        markAsMissing(detail, 'dataJulgamento','Data de julgamento not found');
        markAsMissing(detail, 'relator','Relator not found');
        markAsMissing(detail, 'caseDocuments','Documentos do processo not found');

        return null;
    }
}

function extractProcesso(detail, $, sidebar) {
    const processo = extractSidebarDetailValue($, sidebar, 'Processo');
    if (processo) detail.processo = processo;
    else markAsMissing(detail, 'processo','Processo not found');
} 

function extractOrgaoJulgador(detail, $, sidebar) {
    const orgaoJulgador = extractSidebarDetailValue($, sidebar, 'Órgão Julgador');
    if (orgaoJulgador) detail.orgaoJulgador = orgaoJulgador;
    else markAsMissing(detail, 'orgaoJulgador','Órgão Julgador not found');
}

function extractDataPublicacao(detail, $, sidebar) {
    const dataPublicacao = extractSidebarDetailValue($, sidebar, 'Data de publicação');
    if (dataPublicacao) detail.dataPublicacao = dataPublicacao;
    else markAsMissing(detail, 'dataPublicacao','Data de publicação not found');
}

function extractDataJulgamento(detail, $, sidebar) {
    const dataJulgamento = extractSidebarDetailValue($, sidebar, 'Data de julgamento');
    if (dataJulgamento) detail.dataJulgamento = dataJulgamento;
    else markAsMissing(detail, 'dataJulgamento','Data de julgamento not found');
}

function extractRelator(detail, $, sidebar) {
    const relator = extractSidebarDetailValue($, sidebar, 'Relator');
    if (relator) detail.relator = relator;
    else markAsMissing(detail, 'relator','Relator not found');
}

function extractCaseDocuments(detail, $, sidebar) {    
    // case attachments
    const attachmentsDiv = extractIfExists($, 'div.attachments_attachmentList__8tkHF');

    const attachmentDivs = attachmentsDiv.find('div.file-content_root__35RS2', false);

    attachmentDivs.each((index, element) => {
        const $attachmentDiv = $(element);
        const $pTags = $attachmentDiv.find('p');
        const attachmentDivText = $pTags.map((index, element) => {
            return $(element).text().trim();
        }).get().join(' | ');
        detail.anexos.push(attachmentDivText);
    });

    // case documents
    const caseDocumentsDivs = extractIfExists($, 'div.related-documents_textWrapper__aEph8', false);

    caseDocumentsDivs.each((index, element) => {
        const $caseDocumentsDiv = $(element);
        const $pTags = $caseDocumentsDiv.find('p');
        const caseDocumentsDivText = $pTags.map((index, element) => {
            return $(element).text().trim();
        }).get().join(' | ');
        detail.documentosProcesso.push(caseDocumentsDivText);
    });
}

function extractSidebarDetailValue($, sidebar, selector) {
    // Find the label index based on the selector inside the sidebar
    const $label = $(`h3[data-fds-detail-label="true"]:contains("${selector}")`);
    const labelIndex = $(`h3[data-fds-detail-label="true"]`).index($label);

    if (!labelIndex || labelIndex === -1) {
        console.log('Label not found for selector: ', selector);
        return null;
    }

    //Find the element with the value to check if it is blocked by a button
    const valueElement = $(`div[data-fds-detail-value="true"]`).eq(labelIndex);

    if (!valueElement || valueElement.length === 0) {
        console.log('Value element not found for selector: ', selector);
        return null;
    }

    if (isBlockedByButton(valueElement)) {
        console.log('Value element is blocked by a button: ', selector);
        return null;
    }

    return valueElement.text().trim();
}

function isBlockedByButton(element) {
    return element.find('button').text().trim().includes('Mostrar');
}

function extractIfExists($, selector, first = true) {
    const element = $(selector);
    if (element && element.length > 0) {
        return first ? element.first() : element;
    } else {
        return null;
    }
}

function markAsMissing(detail, field, reason) {
    detail.extractionMeta ||= { missingFields: [], notes: [] };
    if (!detail.extractionMeta.missingFields.includes(field)) {
        detail.extractionMeta.missingFields.push(field);
    }
    if (reason) detail.extractionMeta.notes.push(reason);
}

function extractResumo(detail, $) {
    const resumo = extractIfExists($, 'div[data-text-from-component="docview/JurisDocument"]');

    const title = resumo.find('h2').text().trim();
    const content = resumo.find('p').text().length;

    detail.resumoText = title + ' - ' + content;
}

export function parseInteiroTeorPage(html) {
    const $ = cheerio.load(html);
    
    const inteiroTeorContent = extractIfExists($, 'div[data-text-from-component="docview/JurisDocument"]');

    const title = inteiroTeorContent.find('h2').text().trim();
    const content = inteiroTeorContent.find('p').text().length;

    return title + ' - ' + content;
}