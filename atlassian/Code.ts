declare const Cheerio: typeof import('cheerio');

function doGet() {
  // JSON Feed https://jsonfeed.org/version/1
  const feed = {
    "version": "https://jsonfeed.org/version/1",
    "title": "Atlassian Security Advisories",
    "home_page_url": "https://www.atlassian.com/trust/security/advisories",
    //"feed_url": "https://example.org/feed.json",
    "items": []
    // [
    //     {
    //         "id": "2",
    //         "content_text": "This is a second item.",
    //         "title": "foo",
    //         "url": "https://unsat.cs.washington.edu/news/"
    //     },
    //     {
    //         "id": "1",
    //         "content_html": "<p>Hello, world!</p>",
    //         "url": "https://example.org/initial-post"
    //     }
    // ]
  }

  const content = UrlFetchApp.fetch(feed.home_page_url).getContentText();
  const $ = Cheerio.load(content);
  const posts = $(".component--textblock a");
  feed.items = posts.map(function(i, el) {
    const $el = $(el);
    const url = $el.attr('href')
    return {
      "id": url,
      "url": url,
      "title": "Atlassian " + $el.text(),
      "content_text":  $el.text(),
    }
  }).toArray();
  
  return ContentService.createTextOutput(JSON.stringify(feed)).setMimeType(ContentService.MimeType.JSON);
}
