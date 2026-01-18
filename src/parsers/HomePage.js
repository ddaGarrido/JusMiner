import * as cheerio from 'cheerio';

/**
 * Parses the home page to extract navigation links
 * @param {string} html - HTML content of the home page
 * @returns {Object} - Object with pesquisaJuridicaUrl if found
 */
export function parseHomePage(html) {
    const $ = cheerio.load(html);
    const result = {
        pesquisaJuridicaUrl: null
    };

    // Find the "Pesquisa Jurídica" link in the segmented control
    const pesquisaLink = $('a.index_segmentedControlLink__TkDuF')
        .filter((_, el) => $(el).text().trim() === 'Pesquisa Jurídica')
        .first();

    if (pesquisaLink.length) {
        const href = pesquisaLink.attr('href');
        if (href) {
            result.pesquisaJuridicaUrl = href.startsWith('http') ? href : `https://www.jusbrasil.com.br${href}`;
        }
    }

    return result;
}