import { JSONFeed, JSONFeedItem } from '../jsonschema'
import { fetch, outputJSON } from '../mocks'

export default function doGet(e) {
  if (!e || !e.parameter || !e.parameter.package || !e.queryString) {
    throw "Bad parameters";
  }

  const feed: JSONFeed = {
    "version": "https://jsonfeed.org/version/1",
    "title": `RedHat ${e.parameter.package} CVEs`,
    "home_page_url": "https://access.redhat.com/hydra/rest/securitydata/cve.json",
    "items": []
  }

  const content = fetch(feed.home_page_url+"?"+e.queryString);
  const json = JSON.parse(content);
  feed.items = json.map(item => {
    return {
        "id": item.CVE,
        "url": `https://access.redhat.com/security/cve/${item.CVE}`,
        "title": item.bugzilla_description,
        "content_text": item.bugzilla_description,
        "date_published": item.public_date,
    } as JSONFeedItem
  });

  return outputJSON(feed);
}
