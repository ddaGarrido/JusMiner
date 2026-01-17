import { Client } from 'undici';

export class HttpTransport {
    constructor(baseURL, options = {}) {
        const connectTimeout = options.connectTimeout ?? 30_000;
        const requestTimeout = options.requestTimeout ?? 60_000;
        
        this.client = new Client(baseURL, {
            connect: { timeout: connectTimeout }
        });
        this.requestTimeout = requestTimeout;
    }

    async send(request) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, this.requestTimeout);

        try {
            const response = await this.client.request({
                path: request.url.pathname + request.url.search,
                method: request.method,
                headers: request.headers,
                body: request.body,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (controller.signal.aborted) {
                const timeoutError = new Error(`Request timeout after ${this.requestTimeout}ms`);
                timeoutError.code = 'ETIMEDOUT';
                throw timeoutError;
            }
            throw error;
        }
    }
}