import { JSONFeed, JSONFeedItem } from '../jsonschema'
import { fetch, outputJSON } from '../mocks'
import cheerio from 'cheerio';

export default function doGet() {
  const feed: JSONFeed = {
    "version": "https://jsonfeed.org/version/1",
    "title": "Mattermost Security Updates",
    "home_page_url": "https://mattermost.com/security-updates/",
    "items": [],
  }

  const content = fetch(feed.home_page_url);
  const $ = cheerio.load(content);
  const posts = $("table:last-of-type tbody tr");
  feed.items = posts.map(function(i, el) {
    const $el = $(el);
    const id = $el.children().eq(0).text();
    const description = $el.children().eq(5).text();
    const date = $el.children().eq(3).text();
    return {
      "id": id,
      "url": feed.home_page_url,
      "title": `${id}: ${description}`,
      "content_text": $el.text(),
      "date_published": date,
    } as JSONFeedItem;
  }).toArray();

  console.log(`Fetched ${feed.items.length} items`);
  return outputJSON(feed);
}
