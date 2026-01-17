export class Request {
    constructor({
        method = 'GET',
        url,
        headers = {},
        body = null,
        followRedirects = true,
    }) {
        if (!(url instanceof URL)) {
            throw new Error('URL must be an instance of URL');
        }
        this.method = method;
        this.url = new URL(url);
        this.headers = headers;
        this.body = body;
        this.followRedirects = followRedirects;
    }
}