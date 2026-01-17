import zlib from 'zlib';

export class Decompressor {
    static async decompress(rawBody, encoding) {
        let buffer;
        try {
            buffer = Buffer.from(await rawBody.arrayBuffer());

            switch (encoding) {
                case 'gzip':
                    return zlib.gunzipSync(buffer);
                case 'deflate':
                    return zlib.inflateSync(buffer);
                case 'br':
                    return zlib.brotliDecompressSync(buffer);
                default:
                    return buffer;
            }
        } catch (error) {
            console.error('Error decompressing body:', error);
            return buffer || Buffer.from('');
        }
    }
}