import { Request } from './Request.js';
import { Response } from './Response.js';
import { HttpTransport } from './HttpTransport.js';
import { HttpSession } from './HttpSession.js';
import { Decompressor } from './Decompressor.js';

export class HttpClient {
    constructor(baseURL, options = {}, logger, metrics, context) {
        this.baseURL = new URL(baseURL);
        this.transport = new HttpTransport(this.baseURL.origin, options);
        this.session = new HttpSession(options);

        this.lastURL = null;
        this.maxRetries = options.maxRetries ?? 3;
        this.retryDelayMs = options.retryDelayMs ?? 1000;
        this.retryableStatusCodes = options.retryableStatusCodes ?? [408, 429, 500, 502, 503, 504];

        this.logger = logger.child({ component: 'HttpClient' });
        this.metrics = metrics.child({ component: 'HttpClient' });
        this.context = context;
    }

    async sendRequest({ method, url, headers = {}, body = null, stage = "http", attempt = 1, maxRetries = null }) {
        const requestId = this.context.nextRequestId();
        const start = Date.now();
        const effectiveMaxRetries = maxRetries ?? this.maxRetries;

        const mergedHeaders = this.handleHeaders(headers);

        const request = new Request({
            method,
            url: this.resolveURL(url),
            headers: mergedHeaders,
            body
        });

        let response;

        try {
            response = await this.transport.send(request);
        } catch (error) {
            const elapsedMs = Date.now() - start;
            const isRetryable = this._isRetryableError(error);
            
            if (isRetryable && attempt <= effectiveMaxRetries) {
                return this._handleRetry({ message: "HTTP Request Failed, Retrying", requestId, stage, attempt, maxRetries: effectiveMaxRetries, method, url, headers, body, error });
            }
            
            this._recordFailure({ requestId, stage, attempt, method, url, elapsedMs, error });
            throw error;
        }

        const elapsedMs = Date.now() - start;
        
        // Track redirects
        if (response.statusCode >= 300 && response.statusCode < 400) {
            this.metrics.incrementRedirects();
        }

        // Handle HTTP errors (retryable status codes)
        if (this.retryableStatusCodes.includes(response.statusCode) && attempt <= effectiveMaxRetries) {
            return this._handleRetry({ message: "HTTP Request Returned Retryable Status, Retrying", requestId, stage, attempt, maxRetries: effectiveMaxRetries, method, url, headers, body, error: null });
        }

        this._recordSuccess({ requestId, stage, attempt, method, url, elapsedMs, response });

        this.lastURL = request.url;

        return this._handleResponse(response);
    }

    async _handleRetry({ message, requestId, stage, attempt, maxRetries, method, url, headers, body, error }) {
        const delayMs = this._calculateBackoff(attempt, this.retryDelayMs);
        this.logger.warn(message, {
            requestId,
            stage,
            attempt,
            maxRetries,
            nextAttempt: attempt + 1,
            delayMs,
            method,
            url,
            errorCode: error.code || 'UNKNOWN',
            errorMessage: error.message || 'UNKNOWN'
        });
        
        await this._sleep(delayMs);
        return this.sendRequest({ method, url, headers, body, stage, attempt: attempt + 1, maxRetries });
    }

    _isRetryableError(error) {
        // Network errors, timeouts, and connection errors are retryable
        const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'];
        if (error === null || error.code === undefined) return false;

        return retryableCodes.includes(error.code) || 
               error.message?.includes('timeout') ||
               error.message?.includes('ECONN');
    }

    _calculateBackoff(attempt, baseDelayMs) {
        // Exponential backoff: baseDelayMs * 2^(attempt-1)
        // With jitter: add random 0-25% of the delay
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.25 * exponentialDelay;
        return Math.floor(exponentialDelay + jitter);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleHeaders(headers = {}) {
        if (this.lastURL) {
            headers.referer = this.lastURL.href;
        }
        
        // Build merged headers, filtering out invalid values
        const mergedHeaders = {};
        
        // Add session default headers
        for (const [key, value] of Object.entries(this.session.defaultHeaders || {})) {
            if (value != null && value !== '') {
                mergedHeaders[key.toLowerCase()] = String(value);
            }
        }
        
        // Add request headers (override defaults)
        for (const [key, value] of Object.entries(headers || {})) {
            if (value != null && value !== '') {
                mergedHeaders[key.toLowerCase()] = String(value);
            }
        }
        
        // Add cookie header only if not empty
        const cookieHeader = this.session.getCookieHeader();
        if (cookieHeader && cookieHeader.trim() !== '') {
            mergedHeaders.cookie = cookieHeader;
        }

        return mergedHeaders;
    }

    resolveURL(url) {
        if (url instanceof URL) return url;

        if (/^https?:\/\//.test(url)) {
            return new URL(url);
        }

        return new URL(url, this.baseURL);
    }

    get(url, headers = {}, options = {}) {
        return this.sendRequest({ method: 'GET', url, headers, ...options });
    }

    post(url, body, headers = {}, options = {}) {
        return this.sendRequest({ method: 'POST', url, body, headers, ...options });
    }

    postForm(url, formData, headers = {}, options = {}) {
        // URL-encoded form submission
        const body = typeof formData === 'string' 
            ? formData 
            : new URLSearchParams(formData).toString();
        
        const formHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...headers
        };

        return this.sendRequest({ 
            method: 'POST', 
            url, 
            body, 
            headers: formHeaders, 
            ...options 
        });
    }

    postMultipart(url, formData, headers = {}, options = {}) {
        // Multipart form submission
        // formData can be:
        // - Object with string values: { field: "value" }
        // - Object with file objects: { file: { name: "file.txt", data: Buffer, type: "text/plain" } }
        const boundary = `----formdata-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        const parts = [];

        for (const [key, value] of Object.entries(formData)) {
            if (value && typeof value === 'object' && (Buffer.isBuffer(value.data) || value.data)) {
                // File upload - expects { name, data, type? }
                const filename = value.name || 'file';
                const fileData = Buffer.isBuffer(value.data) ? value.data : Buffer.from(value.data);
                const contentType = value.type || 'application/octet-stream';
                
                parts.push(
                    Buffer.from(`--${boundary}\r\n`, 'utf8'),
                    Buffer.from(`Content-Disposition: form-data; name="${key}"; filename="${filename}"\r\n`, 'utf8'),
                    Buffer.from(`Content-Type: ${contentType}\r\n\r\n`, 'utf8'),
                    fileData,
                    Buffer.from(`\r\n`, 'utf8')
                );
            } else {
                // Regular field
                const fieldValue = String(value);
                parts.push(
                    Buffer.from(`--${boundary}\r\n`, 'utf8'),
                    Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`, 'utf8'),
                    Buffer.from(fieldValue, 'utf8'),
                    Buffer.from(`\r\n`, 'utf8')
                );
            }
        }
        parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));

        const body = Buffer.concat(parts);

        const formHeaders = {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length.toString(),
            ...headers
        };

        return this.sendRequest({ 
            method: 'POST', 
            url, 
            body, 
            headers: formHeaders, 
            ...options 
        });
    }

    _recordFailure({ requestId, stage, attempt, method, url, elapsedMs, error }) {
        // Determine error type for better metrics
        let statusCode = 0;
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            statusCode = -1; // Timeout
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            statusCode = -2; // Connection error
        } else if (error.code === 'ECONNRESET') {
            statusCode = -3; // Connection reset
        }

        this.metrics.recordHttp({
            statusCode,
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
            errorMessage: error.message,
            errorType: this._getErrorType(error)
        });
    }

    _getErrorType(error) {
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            return 'TIMEOUT';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return 'CONNECTION_ERROR';
        } else if (error.code === 'ECONNRESET') {
            return 'CONNECTION_RESET';
        }
        return 'NETWORK_ERROR';
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