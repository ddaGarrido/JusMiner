import { randomUUID } from 'crypto';

function createContext(overrides = {}) {
    const runId = overrides.runId || randomUUID();

    return {
        runId,
        startedAt: new Date().toISOString(),
        nextRequestId() {
            return randomUUID();
        }
    };
}

export { createContext };