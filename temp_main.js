import { HttpClient } from './http/HttpClient.js';

const BASE_URL = 'https://example.com';

async function main() {
    const http = new HttpClient(BASE_URL);

    const homeRes = await http.get('/');

    console.log('Home response status:', homeRes.status);
    console.log('Home response page title:', homeRes.html('title').text());
}

main();