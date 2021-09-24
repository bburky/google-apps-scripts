import { JSONFeed, JSONFeedItem } from '../jsonschema'
import { fetch, outputJSON } from '../mocks'
import cheerio from 'cheerio';

export default function doGet(e) {
  if (!e || !e.parameter || !e.parameter.repo || !e.queryString) {
    throw "Bad parameters";
  }

  const repo: string = e.parameter.repo;
  const feed: JSONFeed = {
    "version": "https://jsonfeed.org/version/1",
    "title": `${repo} GitHub Security Advisories`,
    "home_page_url": `https://github.com/${repo}/security/advisories`,
    "items": []
  }

  const content = fetch(`${feed.home_page_url}?${repo}`, {
    headers: {
      "x-pjax": "true",
      "x-pjax-container": "#repo-content-pjax-container",
    }
  });
  const $ = cheerio.load(content);
  feed.items = $('ul[data-pjax="#repo-content-pjax-container"] li').map(function(i, el) {
    const $link = $('.Link--primary', el);
    const url = `https://github.com/${$link.attr("href")}`;
    const id = $link.attr("href").split('/').pop();
    const date_published = $('relative-time', el).attr("datetime");
    const content_text = $link.text().trim();
    return {
        id,
        url,
        content_text,
        date_published,
        title: `${id}: ${content_text}`,
    } as JSONFeedItem;
  }).toArray();

  return outputJSON(feed);
}
