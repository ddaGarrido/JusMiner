import { Request } from './Request.js';
import { Response } from './Response.js';
import { HttpTransport } from './HttpTransport.js';
import { HttpSession } from './HttpSession.js';
import { Decompressor } from './Decompressor.js';

export class HttpClient {
    constructor(baseURL, options = {}, logger, metrics, context) {
        this.baseURL = new URL(baseURL);
        this.transport = new HttpTransport(this.baseURL.origin);
        this.session = new HttpSession(options);

        this.lastURL = null;

        this.logger = logger.child({ component: 'HttpClient' });
        this.metrics = metrics.child({ component: 'HttpClient' });
        this.context = context;
    }

    async sendRequest({ method, url, headers = {}, body = null, stage = "http", attempt = 1 }) {
        const requestId = this.context.nextRequestId();
        const start = Date.now();

        if (this.lastURL) {
            headers.referer = this.lastURL.href;
        }
        const mergedHeaders = {
            ...this.session.defaultHeaders,
            ...headers,
            cookie: this.session.getCookieHeader()
        };

        const request = new Request({
            method,
            url: this.resolveURL(url),
            headers: mergedHeaders,
            body
        });

        let response;

        try {
            this.metrics.totalRequests++;
            response = await this.transport.send(request);
        } catch (error) {
            const elapsedMs = Date.now() - start;
            this._recordFailure({ requestId, stage, attempt, method, url, elapsedMs, error });
            throw error;
        }

        const elapsedMs = Date.now() - start;
        this._recordSuccess({ requestId, stage, attempt, method, url, elapsedMs, response });

        this.lastURL = request.url;

        return this._handleResponse(response);
    }

    resolveURL(url) {
        if (url instanceof URL) return url;

        if (/^https?:\/\//.test(url)) {
            return new URL(url);
        }

        return new URL(url, this.baseURL);
    }

    get(url, headers = {}) {
        return this.sendRequest({ method: 'GET', url, headers });
    }

    post(url, body, headers = {}) {
        return this.sendRequest({ method: 'POST', url, body, headers });
    }

    _recordFailure({ requestId, stage, attempt, method, url, elapsedMs, error }) {
        this.metrics.recordHttp({
            statusCode: 0,
            elapsedMs,
            attempt
        });

        this.logger.error("HTTP Request Failed", {
            requestId,
            stage,
            attempt,
            method,
            url,
            elapsedMs,
            errorCode: error.code || 'UNKNOWN',
            errorMessage: error.message
        });
    }

    _recordSuccess({ requestId, stage, attempt, method, url, elapsedMs, response }) {
        this.metrics.recordHttp({
            statusCode: response.statusCode,
            elapsedMs,
            attempt
        });

        this.logger.info("HTTP Request Succeeded", {
            requestId,
            stage,
            attempt,
            method,
            url,
            statusCode: response.statusCode,
            elapsedMs,
            contentType: response.headers['content-type'],
            contentLength: response.headers['content-length'],
        });

        this.session.updateFromResponse(response.headers);
    }

    async _handleResponse(response) {
        const decompressed = await Decompressor.decompress(
            response.body,
            response.headers['content-encoding']
        );

        return new Response({
            status: response.statusCode,
            headers: response.headers,
            body: decompressed
        });
    }
}