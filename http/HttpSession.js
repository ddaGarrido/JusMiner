export class HttpSession {
    constructor({
        headers = {},
        cookies = new Map(),
        fingerprint = null,
    } = {}) {
        this.defaultHeaders = headers;
        this.cookies = cookies;
        this.fingerprint = fingerprint;
    }

    getCookieHeader() {
        return [...this.cookies.entries()]
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
    }

    updateFromResponse(headers) {
        const setCookie = headers['set-cookie'];
        if (!setCookie) return;

        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
        for (const cookie of cookies) {
            const [pair] = cookie.split(';');
            const [key, value] = pair.split('=');
            this.cookies.set(key.trim(), value.trim());
        }
    }
}