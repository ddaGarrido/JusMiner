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
            const equalIndex = pair.indexOf('=');
            if (equalIndex === -1) {
                // Malformed cookie - no '=' found, skip it
                continue;
            }
            const key = pair.substring(0, equalIndex).trim();
            const value = pair.substring(equalIndex + 1).trim();
            if (key && value !== undefined) {
                this.cookies.set(key, value);
            }
        }
    }
}