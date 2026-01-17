// import axios from 'axios';
// import { CookieJar } from 'tough-cookie';
// import * as cheerio from 'cheerio';

// const BASE_URL = 'https://www.jusbrasil.com.br/';

// /**
//  * HTTP Client class to handle requests with proper cookie management
//  */
// class HttpClient {
//   constructor(baseURL) {
//     this.baseURL = baseURL;
//     this.cookieJar = new CookieJar();
//     this.client = wrapper(
//       axios.create({
//         baseURL,
//         timeout: 30000,
//         withCredentials: true,
//         jar: this.cookieJar,
//         validateStatus: (status) => status < 500, // Don't throw on 4xx errors
//       })
//     );

//     // Set default headers
//     this.setDefaultHeaders();
//   }

//   /**
//    * Configure default headers to mimic a real browser
//    */
//   setDefaultHeaders() {
//     this.client.defaults.headers.common = {
//       'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
//       'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
//       'Cache-Control': 'max-age=0',
//       'Sec-Ch-Ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
//       'Sec-Ch-Ua-Mobile': '?0',
//       'Sec-Ch-Ua-Platform': '"Windows"',
//       'Sec-Fetch-Dest': 'document',
//       'Sec-Fetch-Mode': 'navigate',
//       'Sec-Fetch-Site': 'none',
//       'Sec-Fetch-User': '?1',
//       'Upgrade-Insecure-Requests': '1',
//       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
//     };
//   }

//   /**
//    * Make a GET request
//    * @param {string} url - URL to fetch (relative or absolute)
//    * @param {Object} options - Additional request options
//    * @returns {Promise<axios.Response>}
//    */
//   async get(url, options = {}) {
//     const config = {
//       ...options,
//       headers: {
//         ...this.client.defaults.headers.common,
//         ...options.headers,
//       },
//     };

//     // Add Referer if provided
//     if (options.referer) {
//       config.headers['Referer'] = options.referer;
//       config.headers['Sec-Fetch-Site'] = 'same-origin';
//     }

//     try {
//       const response = await this.client.get(url, config);
//       return response;
//     } catch (error) {
//       if (error.response) {
//         // Request made and server responded with error status
//         return error.response;
//       } else if (error.request) {
//         // Request made but no response received
//         throw new Error(`No response received: ${error.message}`);
//       } else {
//         // Error setting up request
//         throw new Error(`Request setup error: ${error.message}`);
//       }
//     }
//   }

//   /**
//    * Wait for a specified amount of time (to mimic human behavior)
//    * @param {number} ms - Milliseconds to wait
//    */
//   async delay(ms = 500) {
//     return new Promise(resolve => setTimeout(resolve, ms));
//   }
// }

// /**
//  * Scraper class to handle web scraping logic
//  */
// class JusBrasilScraper {
//   constructor() {
//     this.httpClient = new HttpClient(BASE_URL);
//   }

//   /**
//    * Log response details for debugging
//    * @param {string} label - Label for the log
//    * @param {axios.Response} response - Axios response object
//    */
//   logResponse(label, response) {
//     console.log(`\n=== ${label} ===`);
//     console.log('Status:', response.status);
//     console.log('URL:', response.request.res.responseUrl || response.config.url);
//     console.log('Response Headers:', response.headers);
    
//     if (response.status === 403) {
//       console.error('❌ 403 Forbidden - Server is blocking the request');
//       console.log('Response Body (first 500 chars):', response.data?.substring(0, 500));
//     } else if (response.status >= 200 && response.status < 300) {
//       console.log('✅ Success');
//       console.log('Response Body length:', response.data?.length || 0);
//     }
//   }

//   /**
//    * Scrape the main page and extract the pesquisa-juridica link
//    * @returns {Promise<string|null>} - The pesquisa-juridica URL or null if not found
//    */
//   async scrapeMainPage() {
//     try {
//       console.log('Making initial request to:', BASE_URL);
      
//       const response = await this.httpClient.get('/');
//       this.logResponse('Initial Request', response);

//       if (response.status === 403) {
//         return null;
//       }

//       // Load the HTML into Cheerio
//       const $ = cheerio.load(response.data);
      
//       // Find the pesquisa-juridica link
//       const jusSearch = $('a[href="/pesquisa-juridica"]');
//       const jusSearchLink = jusSearch.attr('href');
      
//       if (!jusSearchLink) {
//         console.error('Could not find pesquisa-juridica link');
//         return null;
//       }

//       console.log('Found pesquisa-juridica link:', jusSearchLink);
//       console.log('Link text:', jusSearch.text());

//       // Resolve relative URL to absolute URL
//       return new URL(jusSearchLink, BASE_URL).href;
//     } catch (error) {
//       console.error('Error scraping main page:', error.message);
//       throw error;
//     }
//   }

//   /**
//    * Scrape the pesquisa-juridica page
//    * @param {string} url - URL of the pesquisa-juridica page
//    * @returns {Promise<cheerio.CheerioAPI|null>} - Cheerio instance or null on error
//    */
//   async scrapePesquisaJuridica(url) {
//     try {
//       // Small delay to mimic human behavior
//       await this.httpClient.delay(500);
      
//       console.log('Making request to pesquisa-juridica:', url);
      
//       const response = await this.httpClient.get(url, {
//         referer: BASE_URL,
//       });
      
//       this.logResponse('Pesquisa Juridica Request', response);

//       if (response.status === 403) {
//         return null;
//       }

//       // Load the HTML into Cheerio
//       const $ = cheerio.load(response.data);
      
//       // Find the search form
//       const jusSearchForm = $('form[id="jusSearchResponse"]');
//       console.log('Found search form:', jusSearchForm.length > 0 ? 'Yes' : 'No');
//       console.log('Form text:', jusSearchForm.text().substring(0, 200));

//       return $;
//     } catch (error) {
//       console.error('Error scraping pesquisa-juridica:', error.message);
//       throw error;
//     }
//   }

//   /**
//    * Main scraping method
//    */
//   async scrape() {
//     try {
//       // Step 1: Scrape main page and get the pesquisa-juridica link
//       const pesquisaUrl = await this.scrapeMainPage();
      
//       if (!pesquisaUrl) {
//         console.error('Failed to get pesquisa-juridica URL');
//         return;
//       }

//       // Step 2: Scrape the pesquisa-juridica page
//       const $ = await this.scrapePesquisaJuridica(pesquisaUrl);
      
//       if (!$) {
//         console.error('Failed to scrape pesquisa-juridica page');
//         return;
//       }

//       console.log('\n✅ Scraping completed successfully!');
//     } catch (error) {
//       console.error('❌ Scraper failed:', error);
//       if (error.cause) {
//         console.error('Error cause:', error.cause);
//       }
//     }
//   }
// }

// // Run the scraper
// const scraper = new JusBrasilScraper();
// scraper.scrape();


// import { HttpClient } from './HttpClient.js';
// import { SearchFlow } from './SearchFlows.js';
// // import { saveHtmlSnapshot } from './saveHtmlSnapshot.js';

  

// async function scrape() {
//     const http = new HttpClient('https://www.jusbrasil.com.br');
  
//     const searchFlow = new SearchFlow(http);

//     const result = await searchFlow.search('direito penal');
    
    
    
//     console.log('Result count:', result.resultCountText);
//     console.log('Pagination:', result.pagination);
//     // console.log('First result link:', result.firstResultLink.length);
//     console.log('First result object:', result.results[0]);

//     const result2 = await searchFlow.search('direito penal OpenAI');
    
    
    
//     console.log('Result count:', result2.resultCountText);
//     console.log('Pagination:', result2.pagination);
//     // console.log('First result link:', result.firstResultLink.length);
//     console.log('First result object:', result2.results[0]);
    
  
//     // // Second request on same connection
//     // const res2 = await httpClient.get('/');
//     // console.log('Second status:', res2.status);
//   }
  
//   scrape();



import { HttpClient } from './http/HttpClient.js';

// const BASE_URL = 'https://www.jusbrasil.com.br';
const BASE_URL = 'https://example.com';

async function scrape() {

  const http = new HttpClient(
    BASE_URL,
    {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept-encoding': 'gzip, deflate, br',
        'upgrade-insecure-requests': '1'
      }
    }
  );

  // const result = await http.get('/');

  // console.log('Request to :', BASE_URL, 'status:', result.status);

  // const result2 = await http.get('/jurisprudencia/busca?q=direito+penal&p=1');

  // console.log('Request to :', BASE_URL + '/jurisprudencia/busca?q=direito+penal&p=1', 'status:', result2.status);

  // const result3 = await http.get('/jurisprudencia/busca?q=direito+penal+OpenAI&p=1');

  // console.log('Request to :', BASE_URL + '/jurisprudencia/busca?q=direito+penal+OpenAI&p=1', 'status:', result3.status);


  const homeRes = await http.get('/');

  // example: extract a hidden token or search endpoint
  const searchAction = homeRes.html('p a').first().attr('href');
  const testHtml = homeRes.html();
  console.log('Test html:', testHtml('p a').first().attr('href'));

  console.log('Search action:', searchAction);

  const searchRes = await http.get(searchAction);

  console.log('Search parser:', searchRes);


}

scrape();