import { Client } from 'undici';

export class HttpTransport {
    constructor(baseURL) {
        this.client = new Client(baseURL, {
            connect: { timeout: 30_000 }
        });
    }

    async send(request) {
        return this.client.request({
            path: request.url.pathname + request.url.search,
            method: request.method,
            headers: request.headers,
            body: request.body
        });
    }
}