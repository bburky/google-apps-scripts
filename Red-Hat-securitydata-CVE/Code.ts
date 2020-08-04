function doGet(e) {
  // JSON Feed https://jsonfeed.org/version/1
  const feed = {
    "version": "https://jsonfeed.org/version/1",
    "title": `RedHat ${e.parameter.package} CVEs`,
    "home_page_url": "https://access.redhat.com/hydra/rest/securitydata/cve.json",
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

  const content = UrlFetchApp.fetch(feed.home_page_url+"?"+e.queryString).getContentText();
  const json = JSON.parse(content);
  feed.items = json.map(item => {
    return {
        "id": item.CVE,
        "url": `https://access.redhat.com/security/cve/${item.CVE}`,
        "title": item.bugzilla_description,
        "content_text": item.bugzilla_description,
        "date_published": item.public_date,
    }
  });

  return ContentService.createTextOutput(JSON.stringify(feed)).setMimeType(ContentService.MimeType.JSON);
}
