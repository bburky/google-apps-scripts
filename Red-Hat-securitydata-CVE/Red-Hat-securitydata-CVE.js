/*
Write a scraper written in google apps script that parses this public JSON data feed and serves it as an ATOM feed.
JSON URL: https://access.redhat.com/hydra/rest/securitydata/cve.json?package=${package_name_comma_separated}
The url for the website is https://access.redhat.com/security/cve/${item.CVE} where item is a record from the API response.

`updated` of each `entry` is set based on the JSON data, or is undefined if no date is available. Parse the date and convert with toISOString().
Ensure data from all fields are included in the `summary` text.

Handle schema changes in the json as gracefully as possible (handle missing fields in data, check types of data fields)
*/


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
  const syncRequest = require('sync-request');
  fetchText = (url, params) => syncRequest("GET", url, params).getBody().toString();
  outputText = (data) => data;
  outputHTML = (html) => html;
  scriptURL = 'https://example.com';
} else {
  fetchText = (url, params) => UrlFetchApp.fetch(url, params ?? {}).getContentText();
  outputText = (data) => { console.log(data); return ContentService.createTextOutput(data) };
  outputHTML = (html) => HtmlService.createHtmlOutput(html);
  scriptURL = ScriptApp.getService().getUrl();
}

/**
 * Generates an Atom feed XML string.
 *
 * @param {Object} metadata - The feed metadata.
 * @param {string} metadata.title - The title of the feed.
 * @param {string} metadata.link - The link to the feed.
 * @param {string} metadata.updated - The last updated date of the feed in ISO 8601 format.
 * @param {string} metadata.id - The unique identifier for the feed.
 * @param {Object[]} entries - An array of entry objects for the feed.
 * @param {string} entries[].title - The title of the entry.
 * @param {string} [entries[].link] - The URL of the entry.
 * @param {string} entries[].id - The unique identifier for the entry.
 * @param {string} [entries[].updated] - The last updated date of the entry in ISO 8601 format.
 * @param {string} [entries[].summary] - The summary or description of the entry.
 * @returns {string} The generated Atom feed XML string.
 */
function atomfeed(metadata, entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <author>
       <name>Generated</name>
    </author>
    <title>${xmlescape(metadata.title)}</title>
    <link rel="self" type="application/atom+xml" href="${xmlescape(scriptURL)}" />
    <link rel="alternate" type="text/html" href="${xmlescape(metadata.link)}" />
    <updated>${xmlescape(metadata.updated)}</updated>
    <id>${xmlescape(metadata.id)}</id>
    ${entries.map(entry => `
      <entry>
        <id>${xmlescape(entry.id)}</id>
        <title>${xmlescape(entry.title)}</title>
        <updated>${xmlescape(entry.updated || metadata.updated)}</updated>
        <link href="${xmlescape(entry.link || metadata.link)}" />
        ${entry.summary ? `<summary>${xmlescape(entry.summary)}</summary>` : ''}
      </entry>
    `).join('')}
  </feed>
  `;
}

/** @type {function(String): String} */
function xmlescape(text) {
  return text.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return '';
    }
  });
}
/** @param {GoogleAppsScript.Events.DoGet=} e */
function doGet(e) {
  if (e?.parameter && e.parameter.feed != 'atom') {
    return outputHTML(`
      <!doctype html>
      <script>
        function updateUrls() {
          const package = document.getElementById('package').value;
          const url = '${scriptURL}?feed=atom&package=' + encodeURIComponent(package);
          document.getElementById('feedly').href = 'https://feedly.com/i/subscription/feed/' + encodeURIComponent(url);
          document.getElementById('atom').href = url;
        }
      </script>
      <input type="text" id="package" placeholder="Package name" oninput="updateUrls()">
      <br>
      <a id="feedly" href="#" target="_top">Subscribe with Feedly</a><br>
      <a id="atom" href="#" target="_top">Raw ATOM feed</a>
    `);
  }

  const pkg = e?.parameter?.package
  const feedMetadata = {
    dataUrl: `https://access.redhat.com/hydra/rest/securitydata/cve.json?package=${encodeURIComponent(pkg)}`,
    title: `Red Hat Security Data API - CVEs for ${pkg}`,
    link: 'https://access.redhat.com/security/security-updates/cve',
    updated: new Date().toISOString(),
    id: scriptURL,
  }

  let responseText;
  try {
    if (!pkg) {
      throw new Error('Missing required package parameter');
    }

    responseText = fetchText(feedMetadata.dataUrl);
    const data = JSON.parse(responseText);
    const dataEntries = data;  // Top level is array

    let entries = dataEntries.map(dataEntry => {

      if (!dataEntry.CVE) {
        throw new Error(`Missing required CVE ID: ${JSON.stringify(dataEntry)}`);
      }

      let summary = '';
      if (dataEntry.severity) summary += `Severity: ${dataEntry.severity}\n`;
      if (dataEntry.bugzilla_description) summary += `Description: ${dataEntry.bugzilla_description}\n`;
      if (Array.isArray(dataEntry.advisories) && dataEntry.advisories.length) {
        summary += `Advisories: ${dataEntry.advisories.join(', ')}\n`;
      }
      if (Array.isArray(dataEntry.affected_packages) && dataEntry.affected_packages.length) {
        summary += `Affected Packages:\n${dataEntry.affected_packages.map(pkg => `- ${pkg}`).join('\n')}\n`;
      }

      let updated;
      const parsedDate = new Date(dataEntry.public_date);
      if (parsedDate && !isNaN(parsedDate.getTime())) {
        updated = parsedDate.toISOString();
      }

      // 'cvss3_scoring_vector' and 'cvss3_score' are optional (missing in old CVEs)
      const ALL_EXPECTED_FIELDS = ['CVE', 'severity', 'public_date', 'advisories', 'bugzilla', 'bugzilla_description',
        'cvss_score', 'cvss_scoring_vector', 'CWE', 'affected_packages', 'package_state', 'resource_url'];
      const unexpectedFields = Object.keys(dataEntry).filter(field =>
        !ALL_EXPECTED_FIELDS.includes(field) &&
        field !== 'cvss3_scoring_vector' &&
        field !== 'cvss3_score'
      );
      const missingFields = ALL_EXPECTED_FIELDS.filter(field => !Object.keys(dataEntry).includes(field));
      if (unexpectedFields.length || missingFields.length) {
        summary += `\n\nUnexpected fields: ${unexpectedFields.join(', ')}\nMissing fields: ${missingFields.join(', ')}`;
      }

      return {
        title: `${dataEntry.CVE}: ${dataEntry.bugzilla_description || 'No description available'}`,
        link: `https://access.redhat.com/security/cve/${dataEntry.CVE}`,
        id: `https://access.redhat.com/security/cve/${dataEntry.CVE}`,
        updated,
        summary: summary.trim(),
      }
    });

    entries = entries.filter(Boolean);
    entries.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

    const seenIds = new Set();
    const duplicateIds = new Set();
    for (const entry of entries) {
      if (!entry.id) {
        throw new Error(`Missing entry ID: ${JSON.stringify(entry)}`);
      }
      if (seenIds.has(entry.id)) {
        duplicateIds.add(entry.id);
      } else {
        seenIds.add(entry.id);
      }
    }
    if (duplicateIds.size > 0) {
      throw new Error(`Duplicate entry IDs found: ${Array.from(duplicateIds).join(', ')}`);
    }

    return outputText(atomfeed(feedMetadata, entries));
  } catch (error) {
    return outputText(atomfeed(feedMetadata, [{
      title: 'Error',
      id: scriptURL + '#error',
      summary: `Error generating feed from ${feedMetadata.dataUrl}\n\n${error.stack || error.message}\n\n${responseText || ""}`,
    }]));
  };
}

if (globalThis?.process?.env?.NODE_ENV === 'development') {
  console.log(doGet({
    parameter: { feed: 'atom', package: 'keycloak' },
    pathInfo: '',
    contextPath: '',
    contentLength: 0,
    queryString: '',
    parameters: {}
  }));
}