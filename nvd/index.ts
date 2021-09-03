import { JSONFeed, JSONFeedItem } from '../jsonschema'
import { fetch, outputJSON } from '../mocks'

export default function doGet(e) {
  if (!e || !e.parameter || !e.parameter.cpeMatchString || !e.queryString) {
    throw "Bad parameters";
  }

  const feed: JSONFeed = {
    "version": "https://jsonfeed.org/version/1",
    "title": `NVD ${e.parameter.cpeMatchString} CVEs`,
    "home_page_url": "https://services.nvd.nist.gov/rest/json/cves/1.0",
    "items": []
  }

  const content = fetch(feed.home_page_url+"?"+e.queryString);
  const json = JSON.parse(content);
  feed.items = json.result.CVE_Items.map(item => {
    const CVE = item.cve.CVE_data_meta.ID;
    const description = item.cve.description.description_data[0].value;
    return {
        "id": CVE,
        "url": `https://nvd.nist.gov/vuln/detail/${CVE}`,
        "title": `${CVE}: ${description}`,
        "content_text": description,
        "date_published": item.lastModifiedDate,
    } as JSONFeedItem
  });

  return outputJSON(feed);
}
