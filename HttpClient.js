import { Client } from 'undici';
import zlib from 'zlib';

export class HttpClient {
  constructor(baseURL) {
    this.client = new Client(baseURL, {
      connect: {
        timeout: 30_000
      }
    });
  }

  async get(path) {
    const res = await this.client.request({
      path,
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept-encoding': 'gzip, deflate, br',
        'upgrade-insecure-requests': '1'
      }
    });

    let buffer = await res.body.arrayBuffer();
    let data;

    const encoding = res.headers['content-encoding'];

    if (encoding === 'gzip') {
      data = zlib.gunzipSync(Buffer.from(buffer)).toString('utf-8');
    } else if (encoding === 'deflate') {
      data = zlib.inflateSync(Buffer.from(buffer)).toString('utf-8');
    } else if (encoding === 'br') {
      data = zlib.brotliDecompressSync(Buffer.from(buffer)).toString('utf-8');
    } else {
      data = Buffer.from(buffer).toString('utf-8');
    }


    // console.log('Http Request for path:', path, 'status:', res.statusCode);

    return {
        status: res.statusCode,
        headers: res.headers,
        data: data,
    }
  }
}
