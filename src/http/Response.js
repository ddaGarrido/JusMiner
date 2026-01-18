import * as cheerio from 'cheerio';

export class Response {
    constructor({ status, headers, body }) {
        this.status = status;
        this.headers = headers;
        this.body = body;
    }

    text () {
        return this.body.toString('utf-8');
    }

    json () {
        return JSON.parse(this.text());
    }

    html (selector = null) {
        const $ = cheerio.load(this.text());
        if (selector) {
            return $(selector);
        }
        return $;
    }
}