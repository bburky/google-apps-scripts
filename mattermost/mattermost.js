/*
Write a scraper written in google apps script that parses this public JSON data feed and serves it as an ATOM feed.
JSON URL: https://securityupdates.mattermost.com/security_updates.json
The url for the website is https://mattermost.com/security-updates/

`updated` of each `entry` is set based on the JSON data, or is undefined if no date is avaliable. Parse the date and convert with toISOString().
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
  // Default to HTML view unless atom param specified
  if (e?.parameter && e.parameter.feed != 'atom') {
    return outputHTML(
      `<!doctype html>
      <a href="https://feedly.com/i/subscription/feed/${encodeURIComponent(scriptURL + "?feed=atom")}" target="_top">Subscribe with Feedly</a><br>
      <a href="${scriptURL}?feed=atom" target="_top">Raw ATOM feed</a>`
    );
  }

  const feedMetadata = {
    dataUrl: 'https://securityupdates.mattermost.com/security_updates.json',
    title: 'Mattermost Security Updates',
    link: 'https://mattermost.com/security-updates/',
    updated: new Date().toISOString(),
    id: scriptURL,
  }

  let responseText;
  try {
    responseText = fetchText(feedMetadata.dataUrl);
    const updates = JSON.parse(responseText);

    let entries = updates.map(update => {
      if (!update.issue_id) {
        throw new Error(`Missing issue_id in update: ${JSON.stringify(update)}`);
      }

      if (update.issue_id == "Issue Identifier") {
        // skip this bad value in data
        return;
      }

      let summary = '';

      // Build summary from available fields
      if (update.severity) {
        summary += `Severity: ${update.severity}\n\n`;
      }
      if (update.affected_versions) {
        summary += `Affected versions: ${update.affected_versions.join(', ')}\n\n`;
      }
      if (update.fix_versions) {
        const versions = Array.isArray(update.fix_versions) ?
          update.fix_versions.join(', ') :
          update.fix_versions;
        summary += `Fix versions: ${versions}\n\n`;
      }
      if (update.details) {
        summary += update.details.replace(/\n\t+/g, ' ').trim();
      }
      if (update.platform) {
        summary += `\n\nPlatform: ${update.platform}`;
      }

      let updated;
      if (update.fix_release_date) {
        const date = new Date(update.fix_release_date);
        if (!isNaN(date.getTime())) {
          updated = date.toISOString();
        }
      }

      const ALL_FIELDS = ['issue_id', 'cve_id', 'severity', 'affected_versions', 'fix_release_date', 'fix_versions', 'details', 'platform'];
      const unexpectedFields = Object.keys(update).filter(f => !ALL_FIELDS.includes(f));
      const missingFields = ALL_FIELDS.filter(f => !Object.keys(update).includes(f));

      if (unexpectedFields.length || missingFields.length) {
        summary += `\n\nSchema changes detected:\nUnexpected fields: ${unexpectedFields.join(', ')}\nMissing fields: ${missingFields.join(', ')}`;
      }

      return {
        title: update.issue_id + (update.cve_id ? ` (${update.cve_id})` : ''),
        id: `${scriptURL}#${encodeURIComponent(update.issue_id + '_' + updated)}`,
        updated,
        summary
      };
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
    // Return error as feed entry
    return outputText(atomfeed(feedMetadata, [{
      title: 'Error',
      id: scriptURL + '#error',
      summary: `Error generating feed from ${feedMetadata.dataUrl}\n\n${error.stack || error.message}\n\n${responseText || ""}`,
    }]));
  }
}

if (globalThis?.process?.env?.NODE_ENV === 'development') {
  console.log(doGet());
}