declare const Cheerio: typeof import('cheerio');

function doGet() {
  // JSON Feed https://jsonfeed.org/version/1
  const feed = {
    "version": "https://jsonfeed.org/version/1",
    "title": "Argo CD Security Considerations",
    "home_page_url": "https://argoproj.github.io/argo-cd/security_considerations/",
    "items": []
  }

  const content = UrlFetchApp.fetch(feed.home_page_url).getContentText();
  const $ = Cheerio.load(content);
  const headings = $("h3");
  feed.items = headings.map(function(i, el) {
    const $el = $(el);
    const url = `${feed.home_page_url}#${$el.attr('id')}`
    const $content = $el.nextUntil('h1, h2, h3')
    return {
      "id": url,
      "url": url,
      // "date_published" Available in table, not heading
      "title": $el.text()
      "content_html": $.html($content), // outerHTML
    }
  }).toArray();

  return ContentService.createTextOutput(JSON.stringify(feed)).setMimeType(ContentService.MimeType.JSON);
}
