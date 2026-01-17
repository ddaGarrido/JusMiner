import { Request } from './Request.js';
import { Response } from './Response.js';
import { HttpTransport } from './HttpTransport.js';
import { HttpSession } from './HttpSession.js';
import { Decompressor } from './Decompressor.js';

export class HttpClient {
    constructor(baseURL, options = {}) {
        this.baseURL = new URL(baseURL);
        this.transport = new HttpTransport(this.baseURL.origin);
        this.session = new HttpSession(options);
        this.lastURL = null;
    }

    async request(config) {
        const resolvedURL = this.resolveURL(config.url);

        const request = new Request({
            ...config,
            url: resolvedURL
        });

        const headers = {
            ...this.session.defaultHeaders,
            ...request.headers,
            cookie: this.session.getCookieHeader()
        };

        if (this.lastURL) {
            headers.referer = this.lastURL.href;
        }

        const raw = await this.transport.send({ 
            ...request, 
            headers 
        });

        const buffer = Buffer.from(await raw.body.arrayBuffer());
        const decompressed = Decompressor.decompress(
            buffer,
            raw.headers['content-encoding']
        );

        this.session.updateFromResponse(raw.headers);

        this.lastURL = request.url;

        return new Response({
            status: raw.statusCode,
            headers: raw.headers,
            body: decompressed
        });
    }

    resolveURL(url) {
        if (url instanceof URL) return url;

        if (/^https?:\/\//.test(url)) {
            return new URL(url);
        }

        return new URL(url, this.baseURL);
    }

    get(url, headers = {}) {
        return this.request({ method: 'GET', url, headers });
    }

    post(url, body, headers = {}) {
        return this.request({ method: 'POST', url, body, headers });
    }
}