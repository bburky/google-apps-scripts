//Cheeriogs library 1ReeQ6WO8kKNxoaA_O0XEQ589cIrRvEBA9qcWpNqdOP17i47u6N9M5Xh0

function doGet() {
  // JSON Feed https://jsonfeed.org/version/1
  const feed = {
    "version": "https://jsonfeed.org/version/1",
    "title": "Sonatype Security Advisories",
    "home_page_url": "https://support.sonatype.com/hc/en-us/sections/203012668-Security-Advisories",
    "items": []
  }

  const content = UrlFetchApp.fetch(feed.home_page_url).getContentText();
  const $ = Cheerio.load(content);
  const posts = $(".article-list a");
  feed.items = posts.map(function(i, el) {
    const $el = $(el);
    const url = "https://support.sonatype.com" + $el.attr('href');
    const match = /.* - (\d{4}-\d\d-\d\d)/.exec($el.text());
    return {
      "id": url,
      "url": url,
      "date_published": match[1],
      "title": $el.text(),
      "content_text": $el.text(),
    }
  }).toArray();
  
  return ContentService.createTextOutput(JSON.stringify(feed)).setMimeType(ContentService.MimeType.JSON);
}
