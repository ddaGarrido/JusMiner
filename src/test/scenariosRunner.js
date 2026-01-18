import path from 'path';
import { readFileSync } from 'fs';
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

// Main function to run the scenarios
export async function runScenarios(scenariosPath) {
    const scenarios = loadScenarios(scenariosPath);
    const context = createContext();

    // Initialize logging
    const logPath = getLogPath(context.runId);
    const logSink = createLogSink({
        runId: context.runId,
        logFilePath: logPath,
        alsoConsole: false
    });
    const logger = createLogger(logSink, { runId: context.runId });

    // Initialize metrics
    const metricsCore = createMetricsCore();
    const metrics = createMetrics(metricsCore, { runId: context.runId });

    // Initialize results
    const results = {
        runId: context.runId,
        startedAt: context.startedAt,
        scenarios: []
    };

    logger.info('Starting scenarios runner');

    // Run scenarios
    for (const scenario of scenarios.scenarios) {
        logger.info(`Running scenario: ${scenario.name}`);
        const scenarioResults = await runScenario(scenario, context, logger, metrics);
        results.scenarios.push(scenarioResults);

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    results.completedAt = new Date().toISOString();

    // Calculate summary
    results.summary = calculateSummary(results.scenarios);

    // Write results
    await writeResults(results);

    logger.info('Scenarios runner completed');
    return results;
}

// Run a single scenario
async function runScenario(scenario, baseContext, baseLogger, baseMetrics) {
    const logger = baseLogger.child({ scenario: scenario.name });
    const metrics = baseMetrics.child({ scenario: scenario.name });

    // Create child context
    const childContext = {
        ...baseContext,
        scenarioId: `${baseContext.runId}-${scenario.name}`
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

        return {
            scenario: scenario.name,
            success: true,
            scenarioResults,
            // validationResults,
            errors: scenarioResults.errors
        };
    }
    catch (error) {
        logger.error(`Scenario ${scenario.name} failed`, { error: error.message });
        return {
            scenario: scenario.name,
            success: false,
            error: error.message,
            errorCode: error.code,
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
    writeJson(resultsPath, results);

    const summaryPath = getSummaryPath(results.runId);
    ensureDir(path.dirname(summaryPath));
    writeJson(summaryPath, results.summary);
}

// Main entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
    const scenariosPath = process.argv[2] || 'src/test/scenarios.json';
    runScenarios(scenariosPath).catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}