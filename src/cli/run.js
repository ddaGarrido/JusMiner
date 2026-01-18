#!/usr/bin/env node

import { HttpClient } from '../http/HttpClient.js';
import { createContext } from '../observability/Context.js';
import { createLogger, createLogSink } from '../observability/Logger.js';
import { createMetricsCore, createMetrics } from '../observability/Metrics.js';
import { executeJurisprudSearchFlow } from '../flows/jurisprudSearch.js';
import { getRunDir, getLogPath, getSummaryPath, getResultsPath, getCasesPath } from '../storage/runPaths.js';
import { ensureDir, writeJson, writeJsonl } from '../storage/runWriters.js';

const BASE_URL = 'https://www.jusbrasil.com.br';

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        searchTerm: null,
        filter: 'jurisprudencia',
        maxResults: 5,
        maxDetails: 5,
        outputDir: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--term' || arg === '-t') {
            config.searchTerm = args[++i];
        } else if (arg === '--filter' || arg === '-f') {
            config.filter = args[++i] || 'jurisprudencia';
        } else if (arg === '--max-results' || arg === '-r') {
            config.maxResults = parseInt(args[++i]) || 5;
        } else if (arg === '--max-details' || arg === '-d') {
            config.maxDetails = parseInt(args[++i]) || 5;
        } else if (arg === '--output' || arg === '-o') {
            config.outputDir = args[++i];
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
            Usage: node src/cli/run.js [options]

            Options:
            -t, --term <term>          Search term (required)
            -f, --filter <filter>      Filter type: jurisprudencia, todos, etc. (default: jurisprudencia)
            -r, --max-results <num>    Maximum number of search results to collect (default: 1)
            -d, --max-details <num>    Maximum number of case details to collect (default: 1)
            -o, --output <dir>         Output directory (default: runs/<runId>)
            -h, --help                 Show this help message

            Example:
            node src/cli/run.js --term "direito penal" --max-results 20 --max-details 10
            `);
            process.exit(0);
        } else if (!arg.startsWith('-') && !config.searchTerm) {
            // First non-flag argument is the search term
            config.searchTerm = arg;
        }
    }

    if (!config.searchTerm) {
        console.error('Error: Search term is required. Use --term or provide as first argument.');
        console.error('Use --help for usage information.');
        process.exit(1);
    }

    return config;
}

/**
 * Calculate coverage statistics
 */
function calculateCoverage(caseDetails) {
    const fieldCounts = {
        id: 0,
        title: 0,
        url: 0,
        processo: 0,
        orgaoJulgador: 0,
        dataPublicacao: 0,
        dataJulgamento: 0,
        relator: 0,
        resumoText: 0,
        inteiroTeorText: 0,
        ementa: 0
    };

    let blockedCount = 0;

    caseDetails.forEach(detail => {
        Object.keys(fieldCounts).forEach(field => {
            if (detail[field]) {
                fieldCounts[field]++;
            }
        });
        if (detail.extractionMeta?.blocked) {
            blockedCount++;
        }
    });

    const total = caseDetails.length;
    const coverage = {};
    Object.keys(fieldCounts).forEach(field => {
        coverage[field] = total > 0 ? (fieldCounts[field] / total * 100).toFixed(1) + '%' : '0%';
    });

    return {
        fieldCounts,
        coverage,
        blockedCount,
        total
    };
}

/**
 * Main entrypoint
 */
async function main() {
    const config = parseArgs();
    
    // Initialize context
    const context = createContext();
    const runDir = config.outputDir || getRunDir(context.runId);
    ensureDir(runDir);

    // Initialize logging
    const logPath = getLogPath(context.runId);
    const logSink = createLogSink({
        runId: context.runId,
        logFilePath: logPath,
        alsoConsole: false
    });
    const rootLogger = createLogger(logSink, { runId: context.runId });

    // Initialize metrics
    const metricsCore = createMetricsCore();
    const rootMetrics = createMetrics(metricsCore, { runId: context.runId });

    const logger = rootLogger.child({ component: 'CLI' });
    logger.info('Starting Jurisprudencia Search', {
        searchTerm: config.searchTerm,
        filter: config.filter,
        maxResults: config.maxResults,
        maxDetails: config.maxDetails,
        runId: context.runId
    });

    try {
        // Initialize HTTP client
        const httpClient = new HttpClient(
            BASE_URL,
            {
                maxRetries: 3,
                retryDelayMs: 1000,
                connectTimeout: 30000,
                requestTimeout: 60000
            },
            rootLogger,
            rootMetrics,
            context
        );

        // Execute flow
        const flowResults = await executeJurisprudSearchFlow({
            httpClient,
            logger: rootLogger,
            metrics: rootMetrics,
            searchTerm: config.searchTerm,
            filter: config.filter,
            maxResults: config.maxResults,
            maxDetails: config.maxDetails
        });

        // Write results
        const resultsPath = getResultsPath(context.runId);
        const casesPath = getCasesPath(context.runId);

        writeJson(resultsPath, flowResults.searchResults.map(item => item.toJSON()));
        writeJson(casesPath, flowResults.caseDetails.map(detail => detail.toJSON()));

        logger.info('Results written', {
            resultsPath,
            casesPath,
            resultsCount: flowResults.searchResults.length,
            casesCount: flowResults.caseDetails.length
        });

        // Calculate coverage
        const coverage = calculateCoverage(flowResults.caseDetails);

        // Generate summary
        const metricsSummary = rootMetrics.toSummary({
            runConfig: {
                searchTerm: config.searchTerm,
                filter: config.filter,
                maxResults: config.maxResults,
                maxDetails: config.maxDetails
            },
            flowResults: {
                totalResultsFound: flowResults.stats.totalResultsFound,
                resultsCollected: flowResults.stats.resultsCollected,
                detailsCollected: flowResults.stats.detailsCollected,
                errors: flowResults.stats.errors
            },
            coverage: {
                fieldCounts: coverage.fieldCounts,
                coverage: coverage.coverage,
                blockedCount: coverage.blockedCount,
                totalDetails: coverage.total
            },
            errors: flowResults.errors
        });

        // Write summary
        const summaryPath = getSummaryPath(context.runId);
        writeJson(summaryPath, {
            ...metricsSummary,
            context: {
                runId: context.runId,
                startedAt: context.startedAt,
                finishedAt: new Date().toISOString()
            }
        });

        logger.info('Summary written', { summaryPath });

        Object.entries(coverage.coverage).forEach(([field, pct]) => {
            console.log(`  ${field}: ${pct}`);
        });
        console.log(`\nOutput Directory: ${runDir}`);

        process.exit(0);

    } catch (error) {
        logger.error('CLI error', {
            error: error.message,
            errorCode: error.code,
            stack: error.stack
        });
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});

export { main };

