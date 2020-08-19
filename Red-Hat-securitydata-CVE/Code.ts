function doGet(e) {
  // JSON Feed https://jsonfeed.org/version/1
  const feed = {
    "version": "https://jsonfeed.org/version/1",
    "title": `RedHat ${e.parameter.package} CVEs`,
    "home_page_url": "https://access.redhat.com/hydra/rest/securitydata/cve.json",
    "items": []
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
