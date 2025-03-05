/*
Write a scraper written in google apps script that parses this public JSON data feed and serves it as an ATOM feed.
JSON URL: https://api.github.com/repos/${owner}/${repo}/security-advisories
The url for the website is https://github.com/${owner}/${repo}/security/advisories

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
  fetchText = (url, params) => syncRequest("GET", url, {
    headers: {
      'user-agent': 'repository-ghsa.js',
    },
    ...params,
  }).getBody().toString();
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
          const owner = document.getElementById('owner').value;
          const repo = document.getElementById('repo').value;
          const url = '${scriptURL}?feed=atom&owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repo);
          document.getElementById('feedly').href = 'https://feedly.com/i/subscription/feed/' + encodeURIComponent(url);
          document.getElementById('atom').href = url;
        }
      </script>
      <input type="text" id="owner" placeholder="owner" oninput="updateUrls()">
      <input type="text" id="repo" placeholder="repo" oninput="updateUrls()">
      <br>
      <a id="feedly" href="#" target="_top">Subscribe with Feedly</a><br>
      <a id="atom" href="#" target="_top">Raw ATOM feed</a>
    `);
  }

  const owner = e?.parameter?.owner
  const repo = e?.parameter?.repo
  const feedMetadata = {
    dataUrl: `https://api.github.com/repos/${owner}/${repo}/security-advisories`,
    title: `Security Advisories for ${owner}/${repo}`,
    link: `https://github.com/${owner}/${repo}/security/advisories`,
    updated: new Date().toISOString(),
    id: scriptURL,
  }

  let responseText;
  try {
    if (!owner || !repo) {
      throw new Error('Missing required parameters: owner, repo');
    }

    responseText = fetchText(feedMetadata.dataUrl);
    const data = JSON.parse(responseText);
    const dataEntries = data;

    let entries = dataEntries.map(dataEntry => {
      // Check if entry has required fields
      if (!dataEntry || typeof dataEntry !== 'object') {
        throw new Error(`Invalid entry: ${JSON.stringify(dataEntry)}`);
      }

      let title = `${owner}/${repo} ${dataEntry.ghsa_id}`;
      if (typeof dataEntry.summary === 'string' && dataEntry.summary) {
        title = `${title}: ${dataEntry.summary}`;
      }

      const id = `https://github.com/${owner}/${repo}/security/advisories/${dataEntry.ghsa_id}`;

      const link = dataEntry.html_url

      // Parse date fields for 'updated'
      let updated;
      const dateFields = ['updated_at', 'published_at', 'created_at'];
      for (const field of dateFields) {
        if (typeof dataEntry[field] === 'string' && dataEntry[field]) {
          const parsedDate = new Date(dataEntry[field]);
          if (!isNaN(parsedDate.getTime())) {
            updated = parsedDate.toISOString();
            break;
          }
        }
      }

      // Build a comprehensive summary from all available fields
      let summary = '';
      
      // Most important fields first
      if (typeof dataEntry.summary === 'string' && dataEntry.summary) {
        summary += `Summary: ${dataEntry.summary}\n\n`;
      }
      
      if (typeof dataEntry.description === 'string' && dataEntry.description) {
        summary += `Description: ${dataEntry.description}\n\n`;
      }
      
      if (typeof dataEntry.severity === 'string' && dataEntry.severity) {
        summary += `Severity: ${dataEntry.severity}\n`;
      }
      // Add CVSS information if available
      if (dataEntry.cvss && typeof dataEntry.cvss === 'object') {
        if (typeof dataEntry.cvss.score === 'number') {
          summary += `CVSS Score: ${dataEntry.cvss.score}\n`;
        }
      }

      if (typeof dataEntry.cve_id === 'string' && dataEntry.cve_id) {
        summary += `${dataEntry.cve_id}\n`;
      }

      // Check for schema changes
      const ALL_EXPECTED_FIELDS = [
        'ghsa_id', 'cve_id', 'url', 'html_url', 'summary', 'description', 'severity', 
        'author', 'publisher', 'identifiers', 'state', 'created_at', 'updated_at', 
        'published_at', 'closed_at', 'withdrawn_at', 'submission', 'vulnerabilities',
        'cvss_severities', 'cwes', 'cwe_ids', 'credits', 'credits_detailed',
        'collaborating_users', 'collaborating_teams', 'private_fork', 'cvss'
      ];
      
      const unexpectedFields = Object.keys(dataEntry).filter(field => !ALL_EXPECTED_FIELDS.includes(field));
      const missingFields = ALL_EXPECTED_FIELDS.filter(field => !Object.keys(dataEntry).includes(field));
      
      if (unexpectedFields.length || missingFields.length) {
        summary += '\n\n';
        if (unexpectedFields.length) {
          summary += `Unexpected fields: ${unexpectedFields.join(', ')}\n`;
        }
        if (missingFields.length) {
          summary += `Missing fields: ${missingFields.join(', ')}\n`;
        }
      }

      return {
        title,
        link,
        id,
        updated,
        summary,
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
    parameter: { feed: 'atom', owner: 'envoyproxy', repo: 'envoy' },
    pathInfo: '',
    contextPath: '',
    contentLength: 0,
    queryString: '',
    parameters: {}
  }));
}