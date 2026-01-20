import path from 'path';
import { readFileSync } from 'fs';
import Bottleneck from 'bottleneck';
import { createContext } from '../observability/Context.js';
import { createLogger, createLogSink } from '../observability/Logger.js';
import { createMetricsCore, createMetrics } from '../observability/Metrics.js';
import { executeJurisprudSearchFlow } from '../flows/jurisprudSearch.js';
import { getRunDir, getLogPath, getSummaryPath, getResultsPath, getCasesPath } from '../storage/runPaths.js';
import { ensureDir, writeJson, writeJsonl } from '../storage/runWriters.js';

function loadScenarios(scenariosPath) {
    const scenarios = JSON.parse(readFileSync(scenariosPath, 'utf8'));
    return scenarios;
}

// Initialize Bottleneck - Create a rate limiter for http requests
function initializeBottleneck(options = {}) {
    const {
        maxConcurrent = 10,
        minTime = 250,
        reservoir = 10,
        reservoirRefreshAmount = 10,
        reservoirRefreshInterval = 6000,
    } = options;

    return new Bottleneck({
        maxConcurrent,
        minTime,
        reservoir,
        reservoirRefreshAmount,
        reservoirRefreshInterval,
    });
}

// Main function to run the scenarios
export async function runScenarios(scenariosPath, bottleneckOptions = {}) {
    const scenarios = loadScenarios(scenariosPath);
    const context = createContext();

    // Rate limiter configuration
    const rateLimiter = initializeBottleneck(bottleneckOptions);

    // Initialize logging
    const logPath = getLogPath(context.runId);
    const logSink = createLogSink({
        runId: context.runId,
        logFilePath: logPath,
        alsoConsole: true
    });
    const logger = createLogger(logSink, { runId: context.runId });

    // Initialize metrics
    const metricsCore = createMetricsCore();
    const metrics = createMetrics(metricsCore, { runId: context.runId });

    // Initialize results
    const results = {
        runId: context.runId,
        startedAt: context.startedAt,
        scenarios: [],
        concurrency: bottleneckOptions
    };

    logger.info('Starting scenarios runner', {
        totalScenarios: scenarios.scenarios.length,
        concurrency: bottleneckOptions
    });

    // Track limiter events
    rateLimiter.on('success', (context) => {
        logger.info('Rate limiter success', { context: context });
    });
    rateLimiter.on('error', (error) => {
        logger.error('Rate limiter error', { error: error.message });
    });
    rateLimiter.on('depleted', () => {
        logger.warn('Rate limiter reservoir depleted - waiting for refresh');
    });

    // Run scenarios concurrently
    const scenarioPromises = scenarios.scenarios.map((scenario, index) => {
        return rateLimiter.schedule(() => {
            logger.info(`Queued scenario: ${scenario.name}`, {
                queuePosition: index + 1,
                queueLength: scenarios.scenarios.length
            });
            return runScenario(scenario, context, logger, metrics);
        });
    });

    // Wait for all scenarios to complete
    const scenarioResults = await Promise.allSettled(scenarioPromises);
    
    // Process results
    results.scenarios = scenarioPromises.map((promise, index) => {
        const result = scenarioResults[index];

        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            logger.error('Scenario promise rejected', {
                scenario: scenarios.scenarios[index].name,
                error: result.reason?.message
            });
            return {
                scenario: scenarios.scenarios[index].name,
                success: false,
                error: result.reason?.message || 'Unknown error',
                errorCode: result.reason?.code || 'UNKNOWN',
            };
        }
    });

    // Get rate limiter stats
    const rateLimiterStats = {
        running: rateLimiter.running(),
        done: rateLimiter.done(),
        queued: rateLimiter.queued()
    };
    logger.info('Rate limiter stats', rateLimiterStats);

    // Update results
    results.completedAt = new Date().toISOString();
    results.summary = calculateSummary(results.scenarios);
    results.rateLimiterStats = rateLimiterStats;

    // Write results
    await writeResults(results);

    logger.info('Scenarios runner completed', {
        summary: results.summary,
        duration: new Date(results.completedAt) - new Date(results.startedAt)
    });

    await rateLimiter.disconnect();

    console.log('runId', results.runId);
    return results;
}

// Run a single scenario
async function runScenario(scenario, baseContext, baseLogger, baseMetrics) {
    const logger = baseLogger.child({ scenario: scenario.name });
    const metrics = baseMetrics.child({ scenario: scenario.name });

    // Create child context
    const childContext = {
        ...baseContext,
        scenarioId: `${baseContext.runId}-${scenario.name}`,
        nextRequestId: () => baseContext.nextRequestId()
    };

    logger.info(`Running scenario: ${scenario.name}`);

    try {
        const scenarioResults = await executeJurisprudSearchFlow({
            logger: baseLogger,
            metrics: baseMetrics,
            context: childContext,
            searchTerm: scenario.searchTerm,
            filter: scenario.filter,
            maxResults: scenario.maxResults,
            maxDetails: scenario.maxDetails
        });

        // Validate results

        const duration = new Date() - new Date(baseContext.startedAt);
        logger.info(`Scenario ${scenario.name} completed`, {
            duration: duration,
            resultsCount: scenarioResults.stats.resultsCollected,
            detailsCount: scenarioResults.stats.detailsCollected,
            errors: scenarioResults.stats.errors
        });
        return {
            scenario: scenario.name,
            success: true,
            duration,
            scenarioResults,
            // validationResults,
            errors: scenarioResults.errors
        };
    }
    catch (error) {
        const duration = new Date() - new Date(baseContext.startedAt);
        logger.error(`Scenario ${scenario.name} failed`, { error: error.message, errorCode: error.code, duration 
        });
        return {
            scenario: scenario.name,
            success: false,
            duration,
            error: error.message,
            errorCode: error.code,
            errorStack: error.stack
        };
    }
}

// Calculate summary of scenarios
function calculateSummary(scenarios) {
    const successCount = scenarios.filter(scenario => scenario.success).length;
    const totalCount = scenarios.length;

    return {
        totalCount,
        successCount,
        failureCount: totalCount - successCount,
        successRate: ((successCount / totalCount) * 100).toFixed(1) + '%'
    };
}

// Write results
async function writeResults(results) {
    const resultsPath = getResultsPath(results.runId);
    ensureDir(path.dirname(resultsPath));
    writeJsonl(resultsPath, results);

    const summaryPath = getSummaryPath(results.runId);
    ensureDir(path.dirname(summaryPath));
    writeJsonl(summaryPath, results.summary);
}

// Main entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
    const scenariosPath = process.argv[2] || 'src/test/scenarios.json';
    const tempPoweredBottleneckOptions = {
        maxConcurrent: 15,
        minTime: 150,
        reservoir: 15,
        reservoirRefreshAmount: 10,
        reservoirRefreshInterval: 6000
    };
    runScenarios(scenariosPath, tempPoweredBottleneckOptions).catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}