
function percentile(sorted, p) {
    if (sorted.length === 0) return null;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function createMetricsCore() {
    return {
        counters: new Map(),
        latenciesMs: [],

        http: {
            totalRequests: 0,
            success: 0,
            fail: 0,
            retries: 0,
            redirects: 0,
            statusCodeBreakdown: new Map(),
            blockSignals: {
                http403: 0,
                http429: 0,
                interstitialHtml: 0,
            },
        },
    };
}

function stableKeys(name, tags) {
    if (!tags || Object.keys(tags).length === 0) return name;
  const entries = Object.entries(tags).sort(([a], [b]) => a.localeCompare(b));
  return `${name}|${JSON.stringify(entries)}`;
}

function createMetrics(core, defaultTags = {}) {
    function inc(name, tags = {}, value = 1) {
        const key = stableKeys(name, { ...defaultTags, ...tags });
        core.counters.set(key, (core.counters.get(key) || 0) + value);
    }

    function observeLatency(elapsedMs) {
        core.latenciesMs.push(elapsedMs);
    }

    function recordHttp( { statusCode, elapsedMs, attempt = 1 }) {
        core.http.totalRequests++;
        observeLatency(elapsedMs);

        if (statusCode >= 200 && statusCode < 400) core.http.success++;
        else core.http.fail++;

        if (statusCode === 403) core.http.blockSignals.http403++;
        else if (statusCode === 429) core.http.blockSignals.http429++;
        // else if (statusCode >= 500 && statusCode < 600) core.http.blockSignals.http500++;

        const k = String(statusCode);
        core.http.statusCodeBreakdown.set(k, (core.http.statusCodeBreakdown.get(k) || 0) + 1);
        core.http.statusCodeBreakdown.set(statusCode, (core.http.statusCodeBreakdown.get(statusCode) || 0) + 1);

        if (attempt > 1) core.http.retries++;
    }

    function toSummary(extra = {}) {
        const arr = [...core.latenciesMs].sort((a, b) => a - b);
        const avg = arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

        const counters = {};
        for (const [k, v] of core.counters.entries()) counters[k] = v;

        return {
            ...extra,
            counters,
            http: core.http,
            latenciesMs: {
                count: arr.length,
                avg,
                max: arr.length ? arr[arr.length - 1] : null,
                p50: percentile(arr, 50),
                p95: percentile(arr, 95),
            },
        };
    }

    return {
        inc,
        observeLatency,
        recordHttp,
        toSummary,
        child: (moreTags = {}) => createMetrics(core, { ...defaultTags, ...moreTags }),
    };
}

export { createMetricsCore, createMetrics };
