declare const Cheerio: typeof import('cheerio');

function doGet() {
  // JSON Feed https://jsonfeed.org/version/1
  const feed = {
    "version": "https://jsonfeed.org/version/1",
    "title": "RancherOS Security Advisories",
    "home_page_url": "https://rancher.com/docs/os/v1.x/en/about/security/",
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
  const posts = $("thead+ tbody tr");
  feed.items = posts.map(function(i, el) {
    const $el = $(el);
    const url = $el.find("a").attr('href')
    const date = new Date($el.children().eq(2).text())
    return {
      "id": url,
      "url": url,
      "date_published": date.toISOString(),
      "title": "RancherOS " + $el.children().eq(0).text(),
      "content_html": $el.children().toArray().map(el => $(el).html()).join("<br><br>\n"),
    }
  }).toArray();
  
  return ContentService.createTextOutput(JSON.stringify(feed)).setMimeType(ContentService.MimeType.JSON);
}
