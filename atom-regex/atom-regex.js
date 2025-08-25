// @ts-check
/// <reference types="@types/google-apps-script"/>
"use strict";

// Mock some Google Apps Scripts functions when running locally

/** @type string */
let scriptURL;
/** @type {function(String, {headers?: Record<String, String>}=): string} */
let fetchText;
/** @type {function(String): string | any} */
let outputText
/** @type {function(String): string | any} */
let outputHTML;

if (globalThis?.process?.env?.NODE_ENV === 'development') {
  // Won't work due to no XmlService for local testing.
  // TODO find a XmlService mock library?

  // const syncRequest = require('sync-request');
  // fetchText = (url, params) => syncRequest("GET", url, params).getBody().toString();
  // outputText = (data) => data;
  // outputHTML = (html) => html;
  // scriptURL = 'https://example.com';
} else {
  fetchText = (url, params) => UrlFetchApp.fetch(url, params ?? {}).getContentText();
  outputText = (data) => { console.log(data); return ContentService.createTextOutput(data).setMimeType(ContentService.MimeType.ATOM) };
  outputHTML = (html) => HtmlService.createHtmlOutput(html);
  scriptURL = ScriptApp.getService().getUrl();
}

/** @param {GoogleAppsScript.Events.DoGet=} e */
function doGet(e) {
  // default to atom for local testing, but in a webpp deployment default to HTML
  if (e?.parameter && e.parameter.feed != 'atom') {
    return outputHTML(
      `<!doctype html>
      <script>
        function updateUrls() {
          const url = document.getElementById('url').value;
          const regex = document.getElementById('regex').value;
          const flags = document.getElementById('flags').value;
          let q = '${scriptURL}?feed=atom&url=' + encodeURIComponent(url) + '&regex=' + encodeURIComponent(regex);
          if (flags) {
            q += '&flags=' + encodeURIComponent(flags);
          }
          document.getElementById('feedly').href = 'https://feedly.com/i/subscription/feed/' + encodeURIComponent(q);
          document.getElementById('atom').href = q;
        }
      </script>
      <label>Feed URL: <input type="text" id="url" required value="https://github.com/cli/cli/releases.atom" oninput="updateUrls()"></label>
      <label>Regex: <input type="text" id="regex" required oninput="updateUrls()"></label>
      <label>Flags: <input type="text" id="flags" value="i" oninput="updateUrls()"></label>
      <a id="feedly" href="#" target="_top">Subscribe with Feedly</a>
      <a id="atom" href="#" target="_top">Raw ATOM feed</a>`
    );
  }

  const feedUrl = e?.parameter?.url;
  const regex = e?.parameter?.regex;
  const flags = e?.parameter?.flags;

  if (!feedUrl || !regex) {
    return outputText('Missing required parameters: url, regex');
  }

  let responseText;
  try {
    responseText = fetchText(feedUrl);
    const document = XmlService.parse(responseText);
    const root = document.getRootElement();
    const atomNs = XmlService.getNamespace('http://www.w3.org/2005/Atom');

    // Update the feed title to indicate this is a filtered feed.
    try {
      const titleElem = root.getChild('title', atomNs);
      const originalTitle = titleElem ? titleElem.getText() : '';
      const flagsText = flags || '';
      const newTitleText = `/${regex}/${flagsText} Filtered Feed: ${originalTitle}`;
      if (titleElem) {
        titleElem.setText(newTitleText);
      } else {
        // create a namespaced title element and insert at the top
        const newTitle = XmlService.createElement('title', atomNs).setText(newTitleText);
        root.addContent(0, newTitle);
      }
    } catch (e) {
      // If updating title fails, continue without blocking the feed generation.
      // (e.g., malformed XML or unexpected namespace usage)
      // eslint-disable-next-line no-console
      console.error('Failed to update feed title:', e && e.stack ? e.stack : e);
    }

    if (regex) {
      const re = new RegExp(regex, flags);
      const entries = root.getChildren('entry', atomNs);
      const rawFormat = XmlService.getRawFormat();

      for (const entry of entries) {
        const entryXml = rawFormat.format(entry);
        if (!re.test(entryXml)) {
          entry.detach();
        }
      }
    }

    return outputText(XmlService.getPrettyFormat().format(document));
  } catch (error) {
    return outputText(`Error processing feed from ${feedUrl}\n\n${error.stack || error.message}\n\n${responseText || ""}`);
  };
}

if (globalThis?.process?.env?.NODE_ENV === 'development') {
  console.log(doGet({
    parameter: { feed: 'atom', url: 'https://github.com/cli/cli/releases.atom', regex: 'v1', flags: 'i' },
    pathInfo: '',
    contextPath: '',
    contentLength: 0,
    queryString: '',
    parameters: {}
  }));
}