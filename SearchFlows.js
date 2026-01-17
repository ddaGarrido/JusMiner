import { Parser } from './Parser.js';
import { saveHtmlSnapshot } from './saveHtmlSnapshot.js';

export class SearchFlow {
  constructor(httpClient) {
    this.http = httpClient;
  }

  async search(query, page = 1) {
    const params = new URLSearchParams({
      q: query,
      p: page,
    });

    const response = await this.http.get(`/jurisprudencia/busca?${params.toString()}`);


    // console.log('Search response:', response.data);
    const filePath = saveHtmlSnapshot(
        response.data,
        'https://www.jusbrasil.com.br/busca'
      );
      console.log('HTML snapshot saved at:', filePath);
    const parser = new Parser(response.data);

    return {
      query,
      page,
      resultCountText: parser.getResultCountText(),
      pagination: parser.getPaginationInfo(),
      firstResultLink: parser.getFirstResultLink(),
      results: parser.getResults(),
    };
  }
}
