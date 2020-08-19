//Cheeriogs library 1ReeQ6WO8kKNxoaA_O0XEQ589cIrRvEBA9qcWpNqdOP17i47u6N9M5Xh0

function doGet() {
  // JSON Feed https://jsonfeed.org/version/1
  const feed = {
    "version": "https://jsonfeed.org/version/1",
    "title": "Rancher Security Advisories",
    "home_page_url": "https://rancher.com/docs/rancher/v2.x/en/security/",
    "items": []
  }

  const content = UrlFetchApp.fetch(feed.home_page_url).getContentText();
  const $ = Cheerio.load(content);
  const posts = $("table:last-of-type tbody tr");
  feed.items = posts.map(function(i, el) {
    const $el = $(el);
    const url = $el.find("a").attr('href')
    const date = new Date($el.children().eq(2).text())
    return {
      "id": url,
      "url": url,
      "date_published": date.toISOString(),
      "title": "Rancher " + $el.children().eq(0).text(),
      "content_html": $el.children().toArray().map(el => $(el).html()).join("<br><br>\n"),
    }
  }).toArray();
  
  return ContentService.createTextOutput(JSON.stringify(feed)).setMimeType(ContentService.MimeType.JSON);
}
