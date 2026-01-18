import * as cheerio from 'cheerio';
import { SearchResultItem } from '../domain/SearchResultItem.js';

/**
 * Parses the search results page
 * @param {string} html - HTML content of the search results page
 * @param {string} baseUrl - Base URL for resolving relative URLs
 * @returns {Object} - Object with items array and totalCount
 */
export function parseSearchResultsPage(html, baseUrl = 'https://www.jusbrasil.com.br') {
    const $ = cheerio.load(html);
    const items = [];
    const extractionMeta = {
        extractedAt: new Date().toISOString(),
        missingFields: [],
        notes: []
    };

    // Try to find result items - common patterns in JusBrasil
    // Look for snippet containers or result cards
    const resultSelectors = [
        '.snippet_root__Qj02N',
        '.snippet-container_root__doXpz',
        '[data-text-from-component*="JURISPRUDENCIA"]',
        'article[class*="snippet"]',
        '.result-item',
        '.search-result'
    ];

    let foundItems = $();
    for (const selector of resultSelectors) {
        foundItems = $(selector);
        if (foundItems.length > 0) {
            extractionMeta.notes.push(`Using selector: ${selector}`);
            break;
        }
    }

    // If no specific selector works, try finding links that look like jurisprudencia URLs
    if (foundItems.length === 0) {
        const jurisLinks = $('a[href*="/jurisprudencia/"]').not('a[href*="/busca"]');
        if (jurisLinks.length > 0) {
            extractionMeta.notes.push('Using fallback: jurisprudencia links');
            foundItems = jurisLinks.closest('article, div[class*="snippet"], div[class*="result"]');
        }
    }

    foundItems.each((_, element) => {
        const $el = $(element);
        const item = new SearchResultItem();

        // Extract title
        const titleEl = $el.find('h3 a, h2 a, .shared-styles_title__lHa8U a, .snippet-header_root__o3qAx a').first();
        if (titleEl.length) {
            item.title = titleEl.text().trim();
            const href = titleEl.attr('href');
            if (href) {
                item.url = href.startsWith('http') ? href : `${baseUrl}${href}`;
            }
        }

        // Extract ID from URL if available
        if (item.url) {
            const idMatch = item.url.match(/\/jurisprudencia\/[^\/]+\/(\d+)/);
            if (idMatch) {
                item.id = idMatch[1];
            }
        }

        // Extract summary snippet
        const snippetEl = $el.find('.snippet-content_root__XTdtm, .snippet-body_root__N558O blockquote, .body-text_root__2yfxU').first();
        if (snippetEl.length) {
            item.summarySnippet = snippetEl.text().trim();
        }

        // Extract metadata (caption info)
        const captionEl = $el.find('.shared-styles_caption__lR2A6, .body-text_root__2yfxU.body-text_sizemd__1G72f');
        if (captionEl.length) {
            const captionText = captionEl.text().trim();
            item.metadata = {
                caption: captionText,
                // Try to extract date if present
                dateMatch: captionText.match(/Data de publicação:\s*([^<]+)/i)
            };
        }

        // Validate and add to items
        item.validate();
        if (item.id || item.url) {
            items.push(item);
        }
    });

    // Try to extract total count if available
    let totalCount = items.length;
    const countText = $('body').text();
    const countMatch = countText.match(/(\d+(?:\.\d+)?)\s*(?:milhões?|mil|resultados?)/i);
    if (countMatch) {
        const num = parseFloat(countMatch[1].replace('.', ''));
        if (countMatch[0].includes('milhões') || countMatch[0].includes('milhão')) {
            totalCount = Math.floor(num * 1000000);
        } else if (countMatch[0].includes('mil')) {
            totalCount = Math.floor(num * 1000);
        }
    }

    return {
        items,
        totalCount,
        extractionMeta
    };
}