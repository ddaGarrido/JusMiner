import { randomUUID } from 'crypto';

function createContext(overrides = {}) {
    const runId = overrides.runId || randomUUID();

    return {
        runId,
        startedAt: Date.now().toString(),
        nextRequestId() {
            return randomUUID();
        }
    };
}

export { createContext };