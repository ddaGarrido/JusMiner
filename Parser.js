import * as cheerio from 'cheerio';

export class Parser {
  constructor(html) {
    this.$ = cheerio.load(html);
  }

  getResultCountText() {
    return this.$('.result-count-subtitle_resultCountPhrase__EO1bC')
      .first()
      .text()
      .trim();
  }

  getPaginationInfo() {
    const text = this.$('.pagination_legend___rr1_')
      .first()
      .text()
      .trim();

    // Example: "Página 1 de 50"
    // console.log('Pagination text:', text);
    const match = text.match(/Página\s+(\d+)\s+de\s+(\d+)/i);

    if (!match) return null;

    return {
      currentPage: Number(match[1]),
      totalPages: Number(match[2]),
    };
  }

  getResults(limit = null) {
    const results = [];

    // console.log('Results:', this.$('li.search-snippet-list_listItem__h6wUS'));
    console.log('Results length:', this.$('li.search-snippet-list_listItem__h6wUS').length);

    this.$('li.search-snippet-list_listItem__h6wUS').each((_, el) => {
      const container = this.$(el);

      const article = container.find('[data-doc-id]').first();

      const linkEl = article.find('h2 a').first();

      const result = {
        docId: article.attr('data-doc-id'),
        artifact: article.attr('data-doc-artifact'),
        title: linkEl.text().trim(),
        url: linkEl.attr('href'),
        snippet: article.find('blockquote').text().trim(),
      };

      results.push(result);
      if (limit && results.length >= limit) return false;
    });

    return results;
  }

  getFirstResultLink() {
    const link = this.$('li.search-snippet-list_listItem__h6wUS h2 a')

    // console.log('First result link:', link);
    // console.log('First result link text:', link.text());
    // console.log('First result link href:', link.attr('href'));
    return this.$('li.search-snippet-list_listItem__h6wUS h2 a')
      .first()
      .attr('href');
  }
}
