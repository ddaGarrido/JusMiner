// Example configuration file
// Copy this to config.js and add your proxy details

export const PROXY_CONFIG = {
  // Single proxy
  // proxy: 'http://username:password@proxy.example.com:8080',
  
  // Multiple proxies for rotation (recommended)
  proxies: [
    // 'http://username:password@proxy1.example.com:8080',
    // 'http://username:password@proxy2.example.com:8080',
    // 'socks5://username:password@proxy3.example.com:1080',
  ],
  
  // Proxy types supported:
  // - http://host:port
  // - https://host:port
  // - http://username:password@host:port
  // - socks5://host:port
  // - socks5://username:password@host:port
};

// Recommended proxy services for Cloudflare bypass:
// - Bright Data (formerly Luminati)
// - Smartproxy
// - Oxylabs
// - ProxyMesh
// - Residential proxies work best for Cloudflare

