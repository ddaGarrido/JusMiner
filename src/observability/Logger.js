import fs from 'fs';
import path from 'path';

function createLogSink({ runId, logFilePath, alsoConsole = true }) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    const stream = fs.createWriteStream(logFilePath, { flags: "a" });

    function write(level, event) {
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            level,
            runId,
            ...event,
        });
        stream.write(line + "\n");
        if (alsoConsole) console.log(line);
    }

    return {
        runId,
        write,
        close: () => stream.end(),
    };
}

function createLogger(sink, bindings = {}) {
    function normalizeEvent(msgOrObj, maybeObj) {
        if (typeof msgOrObj === "string") {
            return { msg: msgOrObj, ...(maybeObj || {}) };
        }
        return msgOrObj || {};
    }

    function log(level, msgOrObj, maybeObj) {
        const event = normalizeEvent(msgOrObj, maybeObj);
        sink.write(level, { ...bindings, ...event });
    }

    return {
        debug: (a, b) => log("debug", a, b),
        info: (a, b) => log("info", a, b),
        warn: (a, b) => log("warn", a, b),
        error: (a, b) => log("error", a, b),

        child: (moreBindings = {}) => createLogger(sink, { ...bindings, ...moreBindings }),
        close: () => sink.close(),
    };
}

export { createLogSink, createLogger };