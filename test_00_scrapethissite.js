import { HttpClient } from './http/HttpClient.js';
import { createContext } from './observability/Context.js';
import { createMetricsCore, createMetrics } from './observability/Metrics.js';
import { createLogSink, createLogger } from './observability/Logger.js';
import { getRunDir, getLogPath, getSummaryPath } from './storage/runPaths.js';
import { ensureDir, writeJson } from './storage/runWriters.js';

const BASE_URL = 'https://www.scrapethissite.com';

function uniq(arr) {
    return [...new Set(arr)];
}

async function main() {
    const context = createContext();

    ensureDir(getRunDir(context.runId));

    const logSink = createLogSink({
        runId: context.runId,
        logFilePath: getLogPath(context.runId),
        alsoConsole: true
    });

    const rootLogger = createLogger(logSink, { runId: context.runId });
    const metricsCore = createMetricsCore();
    const rootMetrics = createMetrics(metricsCore, { runId: context.runId });

    const http = new HttpClient(BASE_URL, {}, rootLogger, rootMetrics, context);

    const logger = rootLogger.child({ component: 'main' });
    const metrics = rootMetrics.child({ component: 'main' });

    logger.info("Starting test_00_scrapethissite");
    metrics.inc('test_00_scrapethissite.start');

    const homeRes = await http.get('/');

    const pagesIndex = await http.get("/pages/", {}, { stage: "pages-index" });

    const $ = pagesIndex.html();
    const hrefs = $("a[href]")
        .map((_, el) => $(el).attr("href"))
        .get()
        .filter(Boolean);

    // find candidate pages under /pages/
    const candidates = uniq(
        hrefs
            .filter((h) => h.startsWith("/pages/"))
            .filter((h) => h !== "/pages/")
            .map((h) => h.split("#")[0])
    );

    logger.info("pages.discovered", {
        count: candidates.length,
        examples: candidates.slice(0, 10),
    });

    const results = [];

    for (const path of candidates) {
        const res = await http.get(path, {}, { stage: "page" });

        const $$ = res.html();
        const title = $$("title").text().trim();
        const h1 = $$("h1").first().text().trim();
        const internalLinks = $$('a[href^="/"]')
            .map((_, el) => $$(el).attr("href"))
            .get().length;

        const contentLength =
            Number(res.headers["content-length"]) || Buffer.byteLength(res.text(), "utf8");

        logger.info("page.visited", {
            path,
            status: res.status,
            title: title || null,
            h1: h1 || null,
            contentLength,
            internalLinks,
        });

        metrics.inc("pages.visited", 1, { status: String(res.status) });

        results.push({
            path,
            status: res.status,
            title: title || null,
            h1: h1 || null,
            contentLength,
            internalLinks,
        });
    }

    const summary = metrics.toSummary({
        runId: context.runId,
        startedAt: context.startedAt,
        finishedAt: new Date().toISOString(),
        test: {
            baseUrl: BASE_URL,
            pagesDiscovered: candidates.length,
            pagesVisited: results.length,
        },
    });

    // optional: write pages output
    writeJson(`runs/${context.runId}/pages.json`, results);
    writeJson(getSummaryPath(context.runId), summary);

    logSink.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
