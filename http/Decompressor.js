import zlib from 'zlib';

export class Decompressor {
    static decompress(buffer, encoding) {
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
    }
}