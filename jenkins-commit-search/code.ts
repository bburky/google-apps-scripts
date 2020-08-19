function doGet() {
  // JSON Feed https://jsonfeed.org/version/1
  const feed = {
    "version": "https://jsonfeed.org/version/1",
    "title": "Jenkins Security Commit Search",
    "home_page_url": "https://github.com/search?o=desc&q=org%3Ajenkinsci+security&s=committer-date&type=Commits",
    "items": []
  }
  const url = "https://api.github.com/search/commits?sort=committer-date&order=desc&q=org:jenkinsci%20security";
  const options = {
      "headers": {
          "Accept": "application/vnd.github.cloak-preview",
      },
  }
  const content = UrlFetchApp.fetch(url, options).getContentText();
  const json = JSON.parse(content);
  feed.items = json.items.map(item => {
    return {
        "id": item.html_url,
        "url": item.html_url,
        "title": `${item.repository.full_name}: ${item.commit.message.split("\n", 1)[0]}`,
        "content_text": item.commit.message,
        "date_published": item.commit.committer.date,
    }
  });
  
  return ContentService.createTextOutput(JSON.stringify(feed)).setMimeType(ContentService.MimeType.JSON);
}
