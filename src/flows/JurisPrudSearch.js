import { parseHomePage } from '../parsers/HomePage.js';
import { parseSearchResultsPage } from '../parsers/SearchResultsPage.js';
import { parseCaseDetailPage, parseInteiroTeorPage } from '../parsers/CaseDetailPage.js';

/**
 * Flow orchestration for JusBrasil Jurisprudencia Search
 * Handles: home -> search -> results -> detail collection
 */

const BASE_URL = 'https://www.jusbrasil.com.br';

/**
 * Main flow: Search for jurisprudencia and collect details
 * @param {Object} params - Flow parameters
 * @param {HttpClient} params.httpClient - HTTP client instance
 * @param {Object} params.logger - Logger instance
 * @param {Object} params.metrics - Metrics instance
 * @param {string} params.searchTerm - Search term
 * @param {string} params.filter - Filter type (e.g., 'jurisprudencia', 'todos')
 * @param {number} params.maxResults - Maximum number of results to collect
 * @param {number} params.maxDetails - Maximum number of details to collect
 * @returns {Promise<Object>} - Flow results
 */
export async function executeJurisprudSearchFlow({
    httpClient,
    logger,
    metrics,
    searchTerm,
    filter = 'jurisprudencia',
    maxResults,
    maxDetails
}) {
    const flowLogger = logger.child({ component: 'JurisprudSearchFlow' });
    const flowMetrics = metrics.child({ component: 'JurisprudSearchFlow' });

    const results = {
        searchResults: [],
        caseDetails: [],
        errors: [],
        stats: {
            totalResultsFound: 0,
            resultsCollected: 0,
            detailsCollected: 0,
            errors: 0
        }
    };

    try {
        // Step 1: Access home page
        flowLogger.info('Accessing home page', { url: BASE_URL });
        const homeResponse = await httpClient.get('/', getBrowserHeaders(), { stage: 'home' });

        // Check for blocking
        handleBlocked(homeResponse, results, 'home');

        const homeData = parseHomePage(homeResponse.text());
        if (!homeData.pesquisaJuridicaUrl) {
            flowLogger.warn('Could not find pesquisa juridica URL');
        }

        // Step 2: Navigate to pesquisa juridica page
        flowLogger.info('Navigating to pesquisa juridica page');
        const pesquisaUrl = homeData.pesquisaJuridicaUrl || '/pesquisa-juridica';
        const pesquisaResponse = await httpClient.get(pesquisaUrl, getBrowserHeaders(BASE_URL), { stage: 'pesquisa-juridica' });

        // Check for blocking on pesquisa juridica page
        handleBlocked(pesquisaResponse, results, 'pesquisa-juridica');

        // Step 3: Perform search
        const searchPath = filter === 'jurisprudencia'
            ? `/jurisprudencia/busca?q=${encodeURIComponent(searchTerm)}`
            : `/busca?q=${encodeURIComponent(searchTerm)}`;
        const searchUrl = `${BASE_URL}${searchPath}`;

        flowLogger.info('Performing search', { searchTerm, filter, searchUrl });
        const searchResponse = await httpClient.get(searchPath, getBrowserHeaders(`${BASE_URL}${pesquisaUrl}`), { stage: 'search' });

        // Check for blocking on search
        handleBlocked(searchResponse, results, 'search');

        const searchData = parseSearchResultsPage(searchResponse.text(), BASE_URL);

        results.stats.totalResultsFound = searchData.totalCount;
        results.stats.resultsCollected = Math.min(searchData.items.length, maxResults);
        results.searchResults = searchData.items.slice(0, maxResults);

        flowLogger.info('Search completed', {
            totalFound: searchData.totalCount,
            itemsExtracted: searchData.items.length,
            itemsToProcess: results.stats.resultsCollected
        });

        // Step 4: Collect details for each result (up to maxDetails)
        await retrieveCaseDetails(httpClient, results, maxDetails, flowLogger, searchUrl);

        // Step 5 Collect Inteiro Teor for each detail

        flowLogger.info('Flow completed', {
            totalResults: results.stats.totalResultsFound,
            resultsCollected: results.stats.resultsCollected,
            detailsCollected: results.stats.detailsCollected,
            errors: results.stats.errors
        });

    } catch (error) {
        results.errors.push({
            stage: 'flow',
            error: error.message,
            errorCode: error.code
        });
        results.stats.errors++;
        flowLogger.error('Flow error', {
            error: error.message,
            errorCode: error.code
        });
        throw error;
    }

    return results;
}

async function retrieveCaseDetails(httpClient, results, maxDetails, flowLogger, searchUrl) {
    const detailsToCollect = Math.min(results.stats.resultsCollected, maxDetails);
    
    for (let i = 0; i < detailsToCollect; i++) {
        const item = results.searchResults[i];
        if (!item || !item.url) {
            flowLogger.warn('Skipping item without URL', { index: i });
            continue;
        }

        try {
            flowLogger.info('Collecting case detail', {
                index: i + 1,
                total: detailsToCollect,
                url: item.url,
                id: item.id
            });

            const detailResponse = await httpClient.get(item.url, getBrowserHeaders(searchUrl), { stage: 'detail' });

            if (handleBlocked(detailResponse, results, flowLogger, 'detail', true)) {
                continue; // Skip this item but continue with others
            }

            const caseDetail = parseCaseDetailPage(detailResponse.text(), item.url);

            const inteiroTeorResponse = await httpClient.get(caseDetail.inteiroTeorUrl, getBrowserHeaders(caseDetail.url), { stage: 'inteiro-teor' });

            if (!handleBlocked(inteiroTeorResponse, results, flowLogger, 'inteiro-teor', true)) {
                caseDetail.inteiroTeorText = parseInteiroTeorPage(inteiroTeorResponse.text());
            }


            // Merge data from search result if detail is missing some fields
            if (!caseDetail.id && item.id) caseDetail.id = item.id;
            if (!caseDetail.title && item.title) caseDetail.title = item.title;
            if (!caseDetail.url) caseDetail.url = item.url;
    
            caseDetail.validate();
            results.caseDetails.push(caseDetail);
            results.stats.detailsCollected++;
    
            flowLogger.info('Case detail collected', {
                id: caseDetail.id,
                title: caseDetail.title?.substring(0, 10),
                missingFields: caseDetail.extractionMeta.missingFields.length,
                blocked: caseDetail.extractionMeta.blocked
            });
    
            // Small delay between requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            results.errors.push({
                stage: 'detail',
                url: item.url,
                error: error.message,
                errorCode: error.code
            });
            results.stats.errors++;
            flowLogger.error('Error collecting case detail', {
                url: item.url,
                error: error.message,
                errorCode: error.code
            });
        }
    }
}

// Browser Headers
function getBrowserHeaders(referer = null) {
    const headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept-encoding': 'gzip, deflate, br',
        'upgrade-insecure-requests': '1'
    };
    if (referer) {
        headers['referer'] = referer;
    }
    return headers;
};

// Helper to check if response indicates blocking
function handleBlocked(response, results, flowLogger, location = 'unknown', skipThrow = false) {
    if (response && (response.status === 403 || response.status === 429)) {
        const error = new Error(`Blocked: Received ${response.status} on ${location} page`);
        error.code = 'BLOCKED';
        error.statusCode = response.status;
        results.errors.push({
            stage: location,
            error: error.message,
            errorCode: error.code,
            statusCode: response.status
        });
        results.stats.errors++;
        flowLogger.error(`Blocked on ${location} page`, { statusCode: response.status });
        if (!skipThrow) throw error;
    }
    return response && (response.status === 403 || response.status === 429);
};